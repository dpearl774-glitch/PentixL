import type opentype from 'opentype.js';

/**
 * opentype.js is ~3.5 MB of parser that only matters once a font is registered,
 * which happens after first paint. Loading it lazily keeps it out of the shell,
 * so the editor opens without paying for font parsing.
 */
type OpenTypeModule = { parse: (data: ArrayBuffer) => opentype.Font };
let opentypeModule: Promise<OpenTypeModule> | null = null;

function loadOpenType(): Promise<OpenTypeModule> {
  if (!opentypeModule) {
    opentypeModule = import('opentype.js').then((mod) => {
      const candidate = (mod as unknown as { default?: unknown }).default ?? mod;
      return candidate as OpenTypeModule;
    });
  }
  return opentypeModule;
}
import { AnchorPoint, Point, VectorPath } from '../types/vector';
import { pathToPolygon, simplifyPath } from './bezier';
import {
  TextMatrix,
  applyTextMatrix,
  textLineHeight,
  textLines,
} from './textGeometry';

/**
 * Exact glyph outlines.
 *
 * Tracing a rendered glyph can only ever approximate it: the raster edge sits
 * half a pixel off the design, stems gain a wobble, and a sharp apex rounds
 * over. An imported font, though, is stored as its own bytes, so its real
 * Bézier contours can be read straight out of the file — the conversion keeps
 * the design's own nodes, handles and counters, with nothing refitted.
 *
 * Only imported faces can do this. A system font (Arial, Impact, the Google
 * face behind the default) renders through the browser and never hands over
 * its files, so those fall back to tracing.
 */

interface RegisteredFont {
  font: opentype.Font;
  /** OS/2 weight class of the file, e.g. 400 or 700 */
  weightClass: number;
}

/** Every readable face of a family, lightest first. */
const registry = new Map<string, RegisteredFont[]>();
/** Families whose bytes parsed badly — do not retry on every conversion */
const rejected = new Set<string>();

/** The registered face closest to the requested weight, if any. */
function faceFor(key: string, weight?: string | number): RegisteredFont | null {
  const faces = registry.get(key);
  if (!faces || !faces.length) return null;
  const wanted = weightClassOf(weight);
  let best = faces[0];
  for (const face of faces) {
    if (Math.abs(face.weightClass - wanted) < Math.abs(best.weightClass - wanted)) best = face;
  }
  return best;
}

/** A family list keys on its first name: `Inter, sans-serif` → `inter`. */
export function outlineFamilyKey(family?: string): string {
  return (family ?? '')
    .split(',')[0]
    .replace(/["']/g, '')
    .trim()
    .toLowerCase();
}

/** Strips a weight down to a class number: 'bold' → 700, '500' → 500. */
export function weightClassOf(weight?: string | number): number {
  if (typeof weight === 'number') return weight;
  const value = (weight ?? '').trim().toLowerCase();
  if (!value) return 400;
  if (value === 'bold' || value === 'bolder') return 700;
  if (value === 'normal' || value === 'regular' || value === 'lighter') return 400;
  const numeric = parseInt(value, 10);
  return Number.isFinite(numeric) ? numeric : 400;
}

/**
 * Parses a font file and remembers its outlines. Called when a font is
 * imported and again on boot, so conversion never has to wait on storage.
 */
export async function registerOutlineFont(
  family: string,
  data: ArrayBuffer
): Promise<RegisteredFont | null> {
  const key = outlineFamilyKey(family);
  if (!key) return null;
  try {
    const parser = await loadOpenType();
    const font = parser.parse(data);
    const os2 = (font.tables as Record<string, { usWeightClass?: number }>).os2;
    const weightClass = Number(os2?.usWeightClass) || 400;
    const entry: RegisteredFont = { font, weightClass };
    // A family can ship several faces, so bold labels convert from the bold
    // file instead of from the regular one.
    const faces = (registry.get(key) ?? []).filter((face) => face.weightClass !== weightClass);
    faces.push(entry);
    faces.sort((a, b) => a.weightClass - b.weightClass);
    registry.set(key, faces);
    rejected.delete(key);
    return entry;
  } catch {
    // WOFF2 needs a Brotli decoder opentype.js does not ship; that font still
    // renders, it just falls back to tracing when it is converted.
    rejected.add(key);
    return null;
  }
}

export function unregisterOutlineFont(family: string): void {
  const key = outlineFamilyKey(family);
  registry.delete(key);
  rejected.delete(key);
}

/** The file's own weight, or null when its bytes are unavailable. */
export function outlineFontWeight(family?: string, weight?: string | number): number | null {
  return faceFor(outlineFamilyKey(family), weight)?.weightClass ?? null;
}

/**
 * True when the label can be converted from the font file itself.
 *
 * This used to demand that the requested weight matched the file's own weight.
 * Browsers fake bold by stroking the same face, and a label is bold by default,
 * so almost every conversion of an imported font fell through to the tracer —
 * the reason converted type arrived as hundreds of traced nodes instead of the
 * font's own handful of curves. A readable file always wins now; the outline it
 * produces is the real drawing of that face.
 */
export function matchesOutlineWeight(family: string | undefined, weight?: string | number): boolean {
  return faceFor(outlineFamilyKey(family), weight) !== null;
}

export interface FontOutlineOptions {
  text: string;
  fontFamily?: string;
  fontSize?: number;
  letterSpacing?: number;
  fontWeight?: string;
  fillColor?: string;
  strokeColor?: string;
  strokeWidth?: number;
  originX?: number;
  originY?: number;
  matrix?: TextMatrix;
  /** Area type: each line starts at its own left edge, like SVG tspan x. */
  lineX?: number[];
}

/** 'font' when the real outlines are available, otherwise 'trace'. */
export function textOutlineSource(options: {
  fontFamily?: string;
  fontWeight?: string;
}): 'font' | 'trace' {
  const key = outlineFamilyKey(options.fontFamily);
  if (!registry.has(key) || rejected.has(key)) return 'trace';
  return matchesOutlineWeight(options.fontFamily, options.fontWeight) ? 'font' : 'trace';
}

interface Contour {
  anchors: AnchorPoint[];
}

const round = (value: number) => Math.round(value * 1000) / 1000;

/** Shoelace area — also the winding sign, which tells holes from outlines. */
function signedArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function pointInPolygon(pt: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const crosses =
      a.y > pt.y !== b.y > pt.y &&
      pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

/**
 * Turns one glyph's path commands into anchored contours, converting the
 * quadratic segments of a TrueType outline into the cubic handles the editor
 * stores. The conversion is exact — a quadratic is a cubic with control points
 * placed two thirds of the way to its own control point.
 */
function contoursFromCommands(commands: opentype.PathCommand[], prefix: string): Contour[] {
  const contours: Contour[] = [];
  let anchors: AnchorPoint[] = [];
  let open = false;

  const anchor = (x: number, y: number, type: AnchorPoint['type'] = 'corner'): AnchorPoint => ({
    id: '',
    x: round(x),
    y: round(y),
    type,
  });

  /**
   * Coincident nodes from the file itself.
   *
   * A TrueType contour routinely repeats a point as a zero-length line right
   * before the curve that leaves it. Each repeat used to become its own anchor,
   * so one spot carried two nodes — the first holding the incoming handle, its
   * twin holding the outgoing one. The curve drew correctly, but the glyph
   * arrived with roughly twice the nodes it needs and clusters of handles that
   * could not be dragged apart. Merging a repeated point onto one node keeps
   * both handles and leaves the shape untouched.
   */
  const coalesce = (points: AnchorPoint[]): AnchorPoint[] => {
    const merged: AnchorPoint[] = [];
    for (const point of points) {
      const last = merged[merged.length - 1];
      if (last && Math.hypot(last.x - point.x, last.y - point.y) <= 0.05) {
        if (!last.handleIn && point.handleIn) last.handleIn = point.handleIn;
        if (!last.handleOut && point.handleOut) last.handleOut = point.handleOut;
        if (point.type === 'smooth') last.type = 'smooth';
        continue;
      }
      merged.push(point);
    }
    // The seam is the same case: a closing point written on top of the first.
    const first = merged[0];
    const last = merged[merged.length - 1];
    if (merged.length > 2 && Math.hypot(last.x - first.x, last.y - first.y) <= 0.05) {
      if (!first.handleIn && last.handleIn) first.handleIn = last.handleIn;
      if (!first.handleOut && last.handleOut) first.handleOut = last.handleOut;
      merged.pop();
    }
    return merged;
  };

  const close = (): void => {
    if (!open) return;
    if (anchors.length >= 2) {
      const first = anchors[0];
      const end = anchors[anchors.length - 1];
      // An explicit final point on top of the start would be a zero-length edge.
      if (anchors.length > 2 && Math.hypot(end.x - first.x, end.y - first.y) < 1e-4) {
        if (end.handleIn) first.handleIn = end.handleIn;
        anchors.pop();
      }
      const laid = coalesce(anchors);
      if (laid.length >= 2) contours.push({ anchors: laid });
    }
    anchors = [];
    open = false;
  };

  for (const command of commands) {
    if (command.type === 'M') {
      close();
      anchors = [anchor(command.x, command.y)];
      open = true;
      continue;
    }
    if (command.type === 'Z') {
      close();
      continue;
    }
    if (!open) {
      anchors = [anchor(0, 0)];
      open = true;
    }
    const from = anchors[anchors.length - 1];

    if (command.type === 'L') {
      anchors.push(anchor(command.x, command.y));
      continue;
    }

    if (command.type === 'C') {
      from.handleOut = { x: round(command.x1), y: round(command.y1) };
      if (from.type === 'corner') from.type = 'smooth';
      const next = anchor(command.x, command.y, 'smooth');
      next.handleIn = { x: round(command.x2), y: round(command.y2) };
      anchors.push(next);
      continue;
    }

    // Q — lift the quadratic into cubics without moving the curve at all: the
    // control points sit two thirds of the way from each end to the original.
    const qx = command.x1;
    const qy = command.y1;
    from.handleOut = {
      x: round(from.x + (2 / 3) * (qx - from.x)),
      y: round(from.y + (2 / 3) * (qy - from.y)),
    };
    if (from.type === 'corner') from.type = 'smooth';
    const next = anchor(command.x, command.y, 'smooth');
    next.handleIn = {
      x: round(command.x + (2 / 3) * (qx - command.x)),
      y: round(command.y + (2 / 3) * (qy - command.y)),
    };
    anchors.push(next);
  }

  close();

  let index = 0;
  for (const contour of contours) {
    for (const point of contour.anchors) point.id = `${prefix}-${index++}`;
  }
  return contours;
}

/**
 * Sorts a glyph's contours into painted outlines and their counters. A contour
 * belongs to the outermost contour that encloses it; even depth paints, odd
 * depth is a hole — the same nesting rule the tracer uses, except the test
 * point comes from the contour itself, which is unambiguous for font outlines
 * because a counter never crosses its parent.
 */
function nestContours(contours: Contour[]): { anchors: AnchorPoint[]; holes: AnchorPoint[][] }[] {
  if (contours.length === 1) return [{ anchors: contours[0].anchors, holes: [] }];

  const rings = contours.map((contour) => {
    const polygon: Point[] = pathToPolygon(
      { points: contour.anchors, closed: true } as VectorPath,
      10
    ).map(([x, y]) => ({ x, y }));
    return { polygon, area: Math.abs(signedArea(polygon)) };
  });

  const depth = contours.map(() => 0);
  const parent = contours.map(() => -1);

  for (let i = 0; i < contours.length; i++) {
    const probe = rings[i].polygon[0];
    if (!probe) continue;
    for (let j = 0; j < contours.length; j++) {
      if (i === j || rings[j].area <= rings[i].area) continue;
      if (!pointInPolygon(probe, rings[j].polygon)) continue;
      depth[i]++;
      if (parent[i] < 0 || rings[j].area < rings[parent[i]].area) parent[i] = j;
    }
  }

  const regions: { anchors: AnchorPoint[]; holes: AnchorPoint[][] }[] = [];
  const regionOf = new Map<number, number>();

  for (let i = 0; i < contours.length; i++) {
    if (depth[i] % 2 !== 0) continue;
    regionOf.set(i, regions.length);
    regions.push({ anchors: contours[i].anchors, holes: [] });
  }
  for (let i = 0; i < contours.length; i++) {
    if (depth[i] % 2 === 0) continue;
    const owner = regionOf.get(parent[i]);
    if (owner !== undefined) regions[owner].holes.push(contours[i].anchors);
  }

  return regions.length ? regions : [{ anchors: contours[0].anchors, holes: [] }];
}


/**
 * Reduce redundant font-command nodes only when the fitted curves stay faithful
 * to the source contour. Some font files include needless points along smooth
 * runs, while others use points to hold real corners; measuring both outlines
 * prevents the latter from being rounded away.
 */
function simplifyGlyphOutline(path: VectorPath, fontSize: number): VectorPath {
  const fitted = simplifyPath(path, 0.1);
  if (fitted === path) return path;

  const originalRings = [path.points, ...(path.holes ?? [])];
  const fittedRings = [fitted.points, ...(fitted.holes ?? [])];
  if (originalRings.length !== fittedRings.length) return path;

  const sampled = (ring: AnchorPoint[]) =>
    pathToPolygon({ points: ring, closed: true } as VectorPath, 32).map(([x, y]) => ({ x, y }));
  const distanceToSegment = (point: Point, a: Point, b: Point) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    const t = lengthSquared > 0
      ? Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared))
      : 0;
    return Math.hypot(point.x - a.x - dx * t, point.y - a.y - dy * t);
  };
  const directedError = (from: Point[], to: Point[]) => {
    if (from.length < 3 || to.length < 3) return Infinity;
    let worst = 0;
    for (const point of from) {
      let nearest = Infinity;
      for (let index = 0; index < to.length; index++) {
        nearest = Math.min(nearest, distanceToSegment(point, to[index], to[(index + 1) % to.length]));
      }
      worst = Math.max(worst, nearest);
    }
    return worst;
  };

  // A small font-unit-scaled budget allows gentle fitting at any size, while
  // retaining sharp terminals or corners the fitter cannot reproduce cleanly.
  const maxError = Math.max(0.25, fontSize * 0.008);
  for (let index = 0; index < originalRings.length; index++) {
    const original = sampled(originalRings[index]);
    const candidate = sampled(fittedRings[index]);
    if (
      Math.sign(signedArea(original)) !== Math.sign(signedArea(candidate)) ||
      Math.max(directedError(original, candidate), directedError(candidate, original)) > maxError
    ) {
      return path;
    }
  }
  return fitted;
}

/**
 * Lays a line out glyph by glyph and returns each one's own outline.
 *
 * opentype's `getPaths` runs the font's shaping tables, and a font whose GPOS
 * uses a lookup it has not implemented (the bundled Plus Jakarta Sans included)
 * throws there — which used to empty the whole conversion without a word. This
 * reads only what the browser also reads to draw the label: the glyf outline,
 * the advance width, and pair kerning when the file can supply it.
 */
interface LaidGlyph {
  glyph: opentype.Glyph;
  /** Where the glyph starts along the line, in artboard px. */
  pen: number;
  /** How much room it takes, tracking and pair kerning included. */
  advance: number;
}

/**
 * Lays a line out glyph by glyph, keeping each one's distance along the line.
 * A straight label only needs the paths, but type on a path has to know where
 * every glyph sits so it can be turned to the tangent at that point.
 */
function layoutGlyphs(
  font: opentype.Font,
  line: string,
  fontSize: number,
  letterSpacing: number
): LaidGlyph[] {
  const scale = fontSize / (font.unitsPerEm || 1000);
  const chars = Array.from(line);
  const laid: LaidGlyph[] = [];
  let pen = 0;
  for (let index = 0; index < chars.length; index++) {
    const glyph = font.charToGlyph(chars[index]);
    if (!glyph) continue;
    const advance = (glyph.advanceWidth ?? 0) * scale + letterSpacing;
    laid.push({ glyph, pen, advance });
    pen += advance;
    const next = index + 1 < chars.length ? font.charToGlyph(chars[index + 1]) : null;
    if (next) {
      try {
        // Fonts that keep their kerning in GPOS can throw here; the advance
        // width alone still places the glyph correctly.
        pen += (font.getKerningValue(glyph, next) || 0) * scale;
      } catch {
        /* kerning unavailable, spacing stays on advances */
      }
    }
  }
  return laid;
}

/**
 * The label's glyph outlines as editable paths, in artboard space. Returns null
 * when the family has no readable file (system and WOFF2 fonts), leaving the
 * caller on the tracer.
 */
export function fontOutlinePaths(options: FontOutlineOptions): VectorPath[] | null {
  const { text } = options;
  if (!text || !text.trim()) return null;
  const key = outlineFamilyKey(options.fontFamily);
  const entry = faceFor(key, options.fontWeight);
  if (!entry) return null;

  const fontSize = Math.max(1, options.fontSize || 64);
  const letterSpacing = options.letterSpacing ?? 0;
  const fillColor = options.fillColor ?? '#4C8DFF';
  const strokeColor = options.strokeColor ?? 'none';
  const strokeWidth = options.strokeWidth ?? 0;
  const originX = options.originX ?? 0;
  const originY = options.originY ?? 0;
  const lineHeight = textLineHeight(fontSize);

  const toWorld = (point: Point): Point => {
    const mapped = options.matrix ? applyTextMatrix(options.matrix, point) : point;
    return { x: mapped.x + originX, y: mapped.y + originY };
  };

  const mapAnchor = (anchor: AnchorPoint): AnchorPoint => {
    const at = toWorld(anchor);
    return {
      ...anchor,
      x: round(at.x),
      y: round(at.y),
      ...(anchor.handleIn ? { handleIn: toWorld(anchor.handleIn) } : {}),
      ...(anchor.handleOut ? { handleOut: toWorld(anchor.handleOut) } : {}),
    };
  };

  const out: VectorPath[] = [];
  textLines(text).forEach((line, lineIndex) => {
    if (!line.trim()) return;
    // Area type moves each line to the shape's own left edge on that row.
    const lineOffset = options.lineX?.[lineIndex] ?? 0;
    const glyphs = layoutGlyphs(entry.font, line, fontSize, letterSpacing);

    glyphs.forEach((laid, glyphIndex) => {
      const commands = laid.glyph.getPath(
        laid.pen + lineOffset,
        lineIndex * lineHeight,
        fontSize
      ).commands;
      const contours = contoursFromCommands(commands, `glyph-${lineIndex}-${glyphIndex}`);
      if (!contours.length) return;
      nestContours(contours).forEach((region, regionIndex) => {
        const outline: VectorPath = {
          id: `outline-${Date.now()}-${lineIndex}-${glyphIndex}-${regionIndex}-${Math.random()
            .toString(36)
            .slice(2, 6)}`,
          name: `Glyph “${line.trim()}” ${glyphIndex + 1}`,
          points: region.anchors.map(mapAnchor),
          ...(region.holes.length ? { holes: region.holes.map((hole) => hole.map(mapAnchor)) } : {}),
          closed: true,
          // Glyph contours touch and overlap; the file's winding, not the
          // even-odd rule, is what makes counters read as holes.
          fillRule: 'nonzero',
          fill: fillColor,
          fillOpacity: 1,
          stroke: strokeColor,
          strokeWidth,
          strokeOpacity: strokeColor === 'none' ? 0 : 1,
          strokeCap: 'round',
          strokeJoin: 'round',
          pressureProfile: 'uniform',
        };
        out.push(simplifyGlyphOutline(outline, fontSize));
      });
    });
  });

  return out.length ? out : null;
}

/* ------------------------------------------------------------------------ *
 * Type that is not a straight line
 *
 * A label can follow another object's outline or wrap inside a shape. Both are
 * laid out by the routines the canvas draws with, so baking the type has to use
 * the same geometry — otherwise the letters convert to a different shape than
 * the one on screen.
 * ------------------------------------------------------------------------ */

interface ArcTable {
  points: Point[];
  lengths: number[];
  total: number;
}

/** Samples an open path and accumulates its length, so distance maps to a point. */
function arcTable(path: VectorPath): ArcTable {
  const points = pathToPolygon(path, 24).map(([x, y]) => ({ x, y }));
  const lengths = [0];
  for (let index = 1; index < points.length; index++) {
    lengths.push(
      lengths[index - 1] +
        Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y)
    );
  }
  return { points, lengths, total: lengths[lengths.length - 1] || 0 };
}

/** The point at one distance along the path, and the tangent there. */
function pointAlong(table: ArcTable, distance: number): { point: Point; angle: number } | null {
  const { points, lengths } = table;
  if (points.length < 2) return null;
  const walk = Math.min(Math.max(0, distance), table.total);
  for (let index = 1; index < points.length; index++) {
    if (lengths[index] < walk) continue;
    const from = points[index - 1];
    const to = points[index];
    const span = lengths[index] - lengths[index - 1];
    const t = span > 0 ? (walk - lengths[index - 1]) / span : 0;
    return {
      point: { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t },
      angle: Math.atan2(to.y - from.y, to.x - from.x),
    };
  }
  const last = points[points.length - 1];
  const before = points[points.length - 2];
  return { point: last, angle: Math.atan2(last.y - before.y, last.x - before.x) };
}

/**
 * Outlines for type that runs along another object. Every glyph travels the
 * path by its own advance and turns to the tangent where its centre lands;
 * `dy` is the baseline shift of the align mode, measured across the path.
 */
export function fontOutlinePathsOnPath(
  options: FontOutlineOptions & { target: VectorPath; offsetPercent?: number; dy?: number }
): VectorPath[] | null {
  const { text } = options;
  if (!text || !text.trim()) return null;
  const entry = faceFor(outlineFamilyKey(options.fontFamily), options.fontWeight);
  if (!entry) return null;

  const table = arcTable(options.target);
  if (table.points.length < 2 || table.total <= 0) return null;

  const fontSize = Math.max(1, options.fontSize || 64);
  const letterSpacing = options.letterSpacing ?? 0;
  const dy = options.dy ?? 0;
  const fillColor = options.fillColor ?? '#4C8DFF';
  const strokeColor = options.strokeColor ?? 'none';
  const strokeWidth = options.strokeWidth ?? 0;
  const start = (Math.min(100, Math.max(0, options.offsetPercent ?? 0)) / 100) * table.total;
  const line = textLines(text)[0] ?? '';
  const out: VectorPath[] = [];

  layoutGlyphs(entry.font, line, fontSize, letterSpacing).forEach((laid, glyphIndex) => {
    const middle = start + laid.pen + laid.advance / 2;
    const at = pointAlong(table, middle);
    if (!at) return;
    const cos = Math.cos(at.angle);
    const sin = Math.sin(at.angle);
    const toWorld = (point: Point): Point => ({
      x: cos * (point.x - middle) - sin * (point.y + dy) + at.point.x,
      y: sin * (point.x - middle) + cos * (point.y + dy) + at.point.y,
    });
    const mapAnchor = (anchor: AnchorPoint): AnchorPoint => {
      const mapped = toWorld(anchor);
      return {
        ...anchor,
        x: round(mapped.x),
        y: round(mapped.y),
        ...(anchor.handleIn ? { handleIn: toWorld(anchor.handleIn) } : {}),
        ...(anchor.handleOut ? { handleOut: toWorld(anchor.handleOut) } : {}),
      };
    };

    const contours = contoursFromCommands(
      laid.glyph.getPath(laid.pen, 0, fontSize).commands,
      `glyphpath-${glyphIndex}`
    );
    if (!contours.length) return;
    nestContours(contours).forEach((region, regionIndex) => {
      const outline: VectorPath = {
        id: `outline-path-${Date.now()}-${glyphIndex}-${regionIndex}-${Math.random()
          .toString(36)
          .slice(2, 6)}`,
        name: `Glyph “${line.trim()}” ${glyphIndex + 1}`,
        points: region.anchors.map(mapAnchor),
        ...(region.holes.length ? { holes: region.holes.map((hole) => hole.map(mapAnchor)) } : {}),
        closed: true,
        fillRule: 'nonzero',
        fill: fillColor,
        fillOpacity: 1,
        stroke: strokeColor,
        strokeWidth,
        strokeOpacity: strokeColor === 'none' ? 0 : 1,
        strokeCap: 'round',
        strokeJoin: 'round',
        pressureProfile: 'uniform',
      };
      out.push(simplifyGlyphOutline(outline, fontSize));
    });
  });

  return out.length ? out : null;
}
