import { BlurEffect, Layer, PatternFill, PatternSwatch, VectorPath } from '../types/vector';
import { pathToSvgD } from './bezier';

/**
 * Blur and pattern paint are rendering effects: they change how an object is
 * painted and never where its geometry sits, so selection, snapping, booleans
 * and export all keep working on the same points.
 */

const sanitizeId = (id: string) => id.replace(/[^a-zA-Z0-9_-]/g, '_');

export function blurFilterId(pathId: string): string {
  return `pentix-blur-${sanitizeId(pathId)}`;
}

/**
 * The scratch rectangle that shows a pattern tiling on the canvas. It is a
 * preview, not artwork: it must never export, never be captured into another
 * swatch, and never be mistaken for something the user drew.
 */
export function isPatternPreviewPath(path: VectorPath): boolean {
  return path.name === 'Pattern preview';
}

export function patternIdFor(pathId: string): string {
  return `pentix-pattern-${sanitizeId(pathId)}`;
}

export function textPathSourceId(pathId: string): string {
  return `pentix-textpath-${sanitizeId(pathId)}`;
}

export function hasVisibleBlur(blur?: BlurEffect | null): boolean {
  return !!blur && Number.isFinite(blur.amount) && blur.amount > 0.05;
}

/** A circle of spread for gaussian, a directional ellipse for motion. */
export function blurStdDeviation(blur: BlurEffect): { stdX: number; stdY: number } {
  const amount = Math.max(0, Math.min(80, blur.amount));
  if (blur.kind === 'motion') {
    const rad = ((blur.angle || 0) * Math.PI) / 180;
    return {
      stdX: Math.max(0.01, amount * Math.abs(Math.cos(rad))),
      stdY: Math.max(0.01, amount * Math.abs(Math.sin(rad))),
    };
  }
  return { stdX: Math.max(0.01, amount), stdY: Math.max(0.01, amount) };
}

/** Filter markup for the exported file; the editor builds the same filter. */
export function blurFilterMarkup(path: VectorPath): string {
  if (!path.blur || !hasVisibleBlur(path.blur)) return '';
  const { stdX, stdY } = blurStdDeviation(path.blur);
  return `    <filter id="${blurFilterId(path.id)}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${stdX.toFixed(
    2
  )} ${stdY.toFixed(2)}" /></filter>`;
}

export interface PatternSettings {
  scale: number;
  rotation: number;
  tileType?: PatternFill['tileType'];
  spacing?: number;
  offsetX?: number;
  offsetY?: number;
}

/** Builds an object's fill from a library swatch. */
export function patternFromSwatch(
  swatch: PatternSwatch,
  settings: Partial<Pick<PatternFill, 'scale' | 'rotation' | 'offsetX' | 'offsetY' | 'tileType' | 'spacing'>> = {}
): PatternFill {
  return {
    swatchId: swatch.id,
    paths: swatch.paths,
    tileW: swatch.tileW,
    tileH: swatch.tileH,
    scale: settings.scale ?? 1,
    rotation: settings.rotation ?? 0,
    tileType: swatch.tileType ?? 'grid',
    spacing: swatch.spacing ?? 0,
    offsetX: settings.offsetX ?? 0,
    offsetY: settings.offsetY ?? 0,
  };
}

/**
 * Re-stamps every fill that follows a swatch. Editing a swatch updates the
 * objects using it; deleting one clears their pattern so they fall back to
 * their fill colour instead of painting a ghost tile.
 */
export function syncPatternInstances(layers: Layer[], swatches: PatternSwatch[]): Layer[] {
  const byId = new Map(swatches.map((swatch) => [swatch.id, swatch] as const));
  return layers.map((layer) => ({
    ...layer,
    paths: layer.paths.map((path) => {
      const pattern = path.pattern;
      if (!pattern?.swatchId) return path;
      const swatch = byId.get(pattern.swatchId);
      if (!swatch) {
        const rest = { ...path };
        delete rest.pattern;
        return rest;
      }
      return {
        ...path,
        pattern: {
          ...pattern,
          paths: swatch.paths,
          tileW: swatch.tileW,
          tileH: swatch.tileH,
          tileType: swatch.tileType ?? 'grid',
          spacing: swatch.spacing ?? 0,
        },
      };
    }),
  }));
}

export interface PatternLayout {
  /** Repeating cell of the pattern def, after scaling */
  width: number;
  height: number;
  /** The tile artwork is drawn at this scale inside the def */
  scale: number;
  /** Where each copy of the motif sits, in unscaled tile units */
  copies: { dx: number; dy: number }[];
  /** Rotation pivot: the middle of the def box */
  centerX: number;
  centerY: number;
  /** Motif origin inside the padded cell, in unscaled tile units */
  artOffsetX: number;
  artOffsetY: number;
  /** Unscaled cell size */
  cellW: number;
  cellH: number;
}

const round3 = (n: number) => Number(n.toFixed(3));
const clampScale = (value: number) => Math.max(0.05, Math.min(8, value || 1));

/**
 * The tiling, built the way SVG patterns actually work.
 *
 * Three rules drive this and each one fixes a visible defect:
 *
 * 1. Spacing PADS the cell; it never moves the art. Moving tiles apart leaves
 *    the background bleeding through and lets the neighbouring tile clip the
 *    motif, which reads as a broken pattern rather than a gap.
 * 2. The cell holds whole repeats only. Brick is a w × 2h cell with a second
 *    copy half a tile along; hex is w × 2·(√3/2)h. Staggering cannot be faked
 *    by shifting a single motif, which is why brick and hex looked like a plain
 *    grid with holes.
 * 3. Anything crossing a cell edge is cloned on the opposite edge (and corner),
 *    because <pattern> clips with overflow:hidden and overflow:visible is
 *    undefined. Without this every motif near a tile boundary is cut off.
 */
export function patternLayout(pattern: PatternFill): PatternLayout {
  const scale = clampScale(pattern.scale || 1);
  const artW = Math.max(1, pattern.tileW || 1);
  const artH = Math.max(1, pattern.tileH || 1);
  // Spacing is applied as padding, so it is divided by scale to stay in tile units.
  const gap = Math.max(0, pattern.spacing ?? 0) / scale;
  const unitW = artW + gap;
  const unitH = artH + gap;
  const artOffsetX = gap / 2;
  const artOffsetY = gap / 2;

  const type = pattern.tileType ?? 'grid';
  let cellW = unitW;
  let cellH = unitH;
  let base: { dx: number; dy: number }[] = [{ dx: 0, dy: 0 }];

  if (type === 'brick-row') {
    cellH = unitH * 2;
    base = [
      { dx: 0, dy: 0 },
      { dx: unitW / 2, dy: unitH },
    ];
  } else if (type === 'brick-column') {
    cellW = unitW * 2;
    base = [
      { dx: 0, dy: 0 },
      { dx: unitW, dy: unitH / 2 },
    ];
  } else if (type === 'hex') {
    // Hex lattice: rows stagger half a tile and sit √3/2 of a tile apart.
    const rowH = unitH * (Math.sqrt(3) / 2);
    cellH = rowH * 2;
    base = [
      { dx: 0, dy: 0 },
      { dx: unitW / 2, dy: rowH },
    ];
  }

  // Wrap copies onto the opposite edges, but only where the art actually
  // crosses a boundary, so a plain grid stays one path per motif.
  const copies: { dx: number; dy: number }[] = [];
  for (const placement of base) {
    const xs = [-cellW, 0, cellW].filter(
      (shift) => placement.dx + shift < cellW && placement.dx + shift + artW > 0
    );
    const ys = [-cellH, 0, cellH].filter(
      (shift) => placement.dy + shift < cellH && placement.dy + shift + artH > 0
    );
    for (const x of xs) {
      for (const y of ys) copies.push({ dx: placement.dx + x, dy: placement.dy + y });
    }
  }

  const width = cellW * scale;
  const height = cellH * scale;
  return {
    width,
    height,
    scale,
    copies,
    centerX: width / 2,
    centerY: height / 2,
    artOffsetX,
    artOffsetY,
    cellW,
    cellH,
  };
}

/**
 * Where the pattern's phase starts: the object's own top-left, so the motif
 * belongs to the shape instead of drifting with the artboard origin.
 */
export function patternOriginFor(path: VectorPath): { x: number; y: number } {
  if (!path.points.length) return { x: 0, y: 0 };
  let minX = Infinity;
  let minY = Infinity;
  for (const point of path.points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    for (const handle of [point.handleIn, point.handleOut]) {
      if (!handle) continue;
      minX = Math.min(minX, handle.x);
      minY = Math.min(minY, handle.y);
    }
  }
  return Number.isFinite(minX) ? { x: minX, y: minY } : { x: 0, y: 0 };
}

/**
 * Rotation and nudge for the fill. Spinning around the tile's own middle keeps
 * the pattern on the object instead of throwing it across the artboard.
 */
export function patternTransform(
  pattern: PatternFill,
  origin: { x: number; y: number } = { x: 0, y: 0 }
): string {
  const layout = patternLayout(pattern);
  const x = round3((pattern.offsetX ?? 0) + origin.x);
  const y = round3((pattern.offsetY ?? 0) + origin.y);
  // Translate first: patternTransform is applied about the pattern origin, so a
  // rotation before the translate orbits (0,0) and throws the fill off the shape.
  return `translate(${x} ${y}) rotate(${round3(
    pattern.rotation || 0
  )} ${round3(layout.centerX)} ${round3(layout.centerY)})`;
}

const escapeAttr = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Tiled artwork as a paint server, shared with the exported file. */
export function patternMarkup(path: VectorPath): string {
  const pattern = path.pattern;
  if (!pattern || !pattern.paths.length) return '';
  const layout = patternLayout(pattern);
  const origin = patternOriginFor(path);
  const tileMarkup = (tile: VectorPath, dx: number, dy: number) => {
    const d = pathToSvgD(tile);
    if (!d) return '';
    const stroke =
      tile.stroke && tile.stroke !== 'none' && tile.strokeWidth > 0
        ? ` stroke="${escapeAttr(tile.stroke)}" stroke-width="${tile.strokeWidth}"`
        : '';
    return `        <path d="${d}" transform="translate(${(dx + layout.artOffsetX).toFixed(2)} ${(dy + layout.artOffsetY).toFixed(
      2
    )})" fill="${escapeAttr(tile.fill || 'none')}" fill-opacity="${(tile.fillOpacity ?? 1).toFixed(
      2
    )}" fill-rule="evenodd"${stroke} />`;
  };
  const tiles = layout.copies
    .flatMap((copy) => pattern.paths.map((tile) => tileMarkup(tile, copy.dx, copy.dy)))
    .filter(Boolean)
    .join('\n');
  if (!tiles) return '';
  const scale = layout.scale.toFixed(4);
  return `    <pattern id="${patternIdFor(path.id)}" patternUnits="userSpaceOnUse" width="${layout.width.toFixed(
    2
  )}" height="${layout.height.toFixed(2)}" patternTransform="${patternTransform(pattern, origin)}">
      <g transform="scale(${scale})">
${tiles}
      </g>
    </pattern>`;
}
