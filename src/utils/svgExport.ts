import { Layer, PressureConfig, VectorPath } from '../types/vector';
import { saveBlob } from './fileSave';
import type { SaveOutcome } from './fileSave';
import { CANVAS } from '../theme';
import { textLineHeight, textLines, textMatrixCss, textWorldBox } from './textGeometry';
import { warpTextGlyphs } from './textWarp';
import { warpPathsInBox } from './warp';
import { textPathDy, textPathSource } from './textPath';
import { pathToSvgD, generateVariableStrokePolygon } from './bezier';
import { gradientMarkup } from './gradients';
import { expandTextToVectorPaths } from './contourTracer';
import { outlineLayoutText } from './textOutlineConversion';
import {
  extrusionFaces,
  extrusionFrontPath,
  extrusionShadow,
  extrusionSheen,
} from './extrusion';
import {
  clipPathIdFor,
  clippingUrlFor,
  collectClippingMasks,
  imageClipIdFor,
} from './clipping';
import { computePathsBoundingBox } from './transform';
import {
  blurFilterId,
  blurFilterMarkup,
  hasVisibleBlur,
  isPatternPreviewPath,
  patternIdFor,
  patternMarkup,
  textPathSourceId,
} from './effects';

/** Gradient paint id used by both the editor and the exported markup. */
export function gradientIdFor(pathId: string): string {
  return `pentix-grad-${pathId}`;
}

export interface SvgExportOptions {
  width: number;
  height: number;
  includeBackground: boolean;
  backgroundColor: string;
  prettify?: boolean;
  /** Paints every fill and stroke in one flat colour — the one-colour logo */
  monoColor?: string;
  /** Export only these object ids, in their normal paint order */
  pathIds?: string[];
  /** Crops the viewBox to a region (selection-only export) */
  crop?: { x: number; y: number; width: number; height: number };
  /** Converts live text to outlines so the file does not depend on fonts */
  outlineText?: boolean;
}

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const isVisible = (path: VectorPath): boolean => path.visible !== false;

/**
 * Generates an SVG string representation of all visible layers.
 * Grid, rulers and guides live outside this tree and can never reach it.
 */
export function generateSvgCode(
  layers: Layer[],
  options: SvgExportOptions,
  pressureConfig: PressureConfig
): string {
  const { width, height, includeBackground, backgroundColor, monoColor, pathIds, crop, outlineText = false } = options;
  const onlyIds = pathIds ? new Set(pathIds) : null;

  // The pattern preview rectangle is scaffolding for looking at a tiling. It is
  // on the canvas, not in the artwork, so it never reaches a file.
  layers = layers.map((layer) =>
    layer.paths.some((path) => isPatternPreviewPath(path))
      ? { ...layer, paths: layer.paths.filter((path) => !isPatternPreviewPath(path)) }
      : layer
  );

  const viewX = crop ? crop.x : 0;
  const viewY = crop ? crop.y : 0;
  const viewW = crop ? crop.width : width;
  const viewH = crop ? crop.height : height;

  let content = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  content += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewX} ${viewY} ${viewW} ${viewH}" width="${viewW}" height="${viewH}">\n`;
  content += `  <!-- Created with Pentix Mobile Vector Logo Studio -->\n`;

  if (includeBackground && backgroundColor && backgroundColor !== 'transparent') {
    content += `  <rect x="${viewX}" y="${viewY}" width="${viewW}" height="${viewH}" fill="${backgroundColor}" />\n`;
  }

  // A mask source does not paint, but it still has to exist in <defs> when one
  // of the included objects references it.
  const clippingMasks = collectClippingMasks(layers);
  const includedMaskIds = new Set<string>();
  for (const layer of layers) {
    if (!layer.visible) continue;
    for (const path of layer.paths) {
      if (!isVisible(path)) continue;
      if (onlyIds && !onlyIds.has(path.id)) continue;
      if (path.clipPathId) includedMaskIds.add(path.clipPathId);
    }
  }
  const masksById = new Map(clippingMasks.map((mask) => [mask.id, mask]));
  const clipDefs: string[] = [];
  for (const id of includedMaskIds) {
    const mask = masksById.get(id);
    const d = mask ? pathToSvgD(mask) : '';
    clipDefs.push(
      d
        ? `    <clipPath id="${clipPathIdFor(id)}" clipPathUnits="userSpaceOnUse"><path d="${d}" fill-rule="evenodd" /></clipPath>`
        : `    <clipPath id="${clipPathIdFor(id)}" clipPathUnits="userSpaceOnUse"></clipPath>`
    );
  }

  // An image-painted object carries its own clip: the photo is cropped to the
  // outline, and then to whatever mask the object also references.
  const imageClipDefs: string[] = [];
  for (const layer of layers) {
    if (!layer.visible) continue;
    for (const path of layer.paths) {
      if (!path.image || !isVisible(path)) continue;
      if (onlyIds && !onlyIds.has(path.id)) continue;
      const d = pathToSvgD(path);
      if (!d) continue;
      imageClipDefs.push(
        `    <clipPath id="${imageClipIdFor(path.id)}" clipPathUnits="userSpaceOnUse"><path d="${d}" fill-rule="evenodd" /></clipPath>`
      );
    }
  }

  // Blur filters and tiled pattern paints, per object.
  const effectDefs: string[] = [];
  for (const layer of layers) {
    if (!layer.visible) continue;
    for (const path of layer.paths) {
      if (!isVisible(path)) continue;
      if (onlyIds && !onlyIds.has(path.id)) continue;
      const blur = blurFilterMarkup(path);
      if (blur) effectDefs.push(blur);
      const pattern = patternMarkup(path);
      if (pattern) effectDefs.push(pattern);
    }
  }

  // A one-colour export is flattened paint, so gradients are left out entirely.
  const gradientDefs: string[] = [];
  if (!monoColor) {
    for (const layer of layers) {
      if (!layer.visible) continue;
      for (const path of layer.paths) {
        if (!isVisible(path)) continue;
        if (onlyIds && !onlyIds.has(path.id)) continue;
        if (path.fillGradient && path.fillGradient.stops.length >= 2) {
          gradientDefs.push(`  ${gradientMarkup(path.fillGradient, gradientIdFor(path.id))}`);
        }
      }
    }
  }
  if (gradientDefs.length || clipDefs.length || imageClipDefs.length || effectDefs.length) {
    content += `  <defs>\n${[...clipDefs, ...imageClipDefs, ...effectDefs, ...gradientDefs].join('\n')}\n  </defs>\n`;
  }

  for (const layer of layers) {
    if (!layer.visible) continue;

    content += `  <g id="layer-${layer.id}" opacity="${layer.opacity.toFixed(2)}">\n`;

    for (const path of layer.paths) {
      if (!isVisible(path)) continue;
      if (path.isClippingMask) continue;
      if (onlyIds && !onlyIds.has(path.id)) continue;
      if (path.points.length === 0) continue;

      const objectAlpha = path.opacity ?? 1;
      const clipUrl = clippingUrlFor(path);
      const clipAttr = clipUrl ? `clip-path="${clipUrl}"` : '';
      const filterAttr = hasVisibleBlur(path.blur)
        ? ` filter="url(#${blurFilterId(path.id)})"`
        : '';

      // Live text objects export as <text> so the string stays editable
      if (path.text) {
        const origin = path.points[0];
        const fillValue = monoColor
          ? monoColor
          : path.fillGradient && path.fillGradient.stops.length >= 2
            ? `url(#${gradientIdFor(path.id)})`
            : path.fill === 'none'
              ? 'none'
              : path.fill;        // A baked label on a path has to be laid along that path; when the
        // type is not being baked it exports as live <textPath> instead.
        const bakedLayout = outlineText
          ? outlineLayoutText(
              path,
              (id) =>
                layers.flatMap((layer) => layer.paths).find((candidate) => candidate.id === id) ??
                null
            )
          : null;
        // Type on a path exports as <textPath> over the outline it follows.
        if (path.textPath && !bakedLayout) {
          const target = layers
            .flatMap((layer) => layer.paths)
            .find((candidate) => candidate.id === path.textPath!.pathId);
          const targetD = target ? pathToSvgD(textPathSource(path, target)) : '';
          if (targetD) {
            content += `    <defs><path id="${textPathSourceId(path.id)}" d="${targetD}" transform="translate(${(
              -origin.x
            ).toFixed(2)} ${(-origin.y).toFixed(2)})" /></defs>\n`;
            content += `    <text id="text-${path.id}" transform="translate(${origin.x.toFixed(
              2
            )} ${origin.y.toFixed(2)})${textMatrixCss(path.textMatrix).startsWith('matrix(') ? ' ' : ''}" font-family="${escapeXml(
              path.fontFamily || 'sans-serif'
            )}" font-size="${path.fontSize || 64}" font-weight="${path.fontWeight || 'bold'}"${
              path.letterSpacing ? ` letter-spacing="${path.letterSpacing.toFixed(2)}"` : ''
            } fill="${escapeXml(fillValue)}" fill-opacity="${(monoColor ? 1 : (path.fillOpacity ?? 1) * objectAlpha).toFixed(
              2
            )}">${textPathDy(path) ? ` dy="${textPathDy(path).toFixed(2)}"` : ''}<textPath href="#${textPathSourceId(path.id)}" startOffset="${(
              path.textPath.offset ?? 0
            ).toFixed(2)}%">${escapeXml(path.text)}</textPath></text>\n`;
            continue;
          }
        }
        if (outlineText) {
          let outlined = bakedLayout ?? expandTextToVectorPaths(path.text, {
            fontSize: path.fontSize,
            fontFamily: path.fontFamily,
            fontWeight: path.fontWeight,
            letterSpacing: path.letterSpacing,
            fillColor: monoColor ?? path.fill,
            strokeColor: monoColor ?? path.stroke,
            strokeWidth: path.strokeWidth,
            originX: origin.x,
            originY: origin.y,
            matrix: path.textMatrix,
          });
          if (path.warp) {
            // A live warp only becomes geometry when the export has to outline
            // the type, so the curves bend exactly like the screen.
            const warpBox = textWorldBox(path);
            if (warpBox) outlined = warpPathsInBox(outlined, warpBox, path.warp);
          }
          for (const outline of outlined) {
            const d = pathToSvgD(outline);
            if (!d) continue;
            content += `    <path d="${d}" fill-rule="${outline.fillRule ?? 'evenodd'}" fill="${escapeXml(
              monoColor ?? outline.fill
            )}" fill-opacity="${(monoColor ? 1 : (outline.fillOpacity ?? 1) * objectAlpha).toFixed(2)}" stroke="${escapeXml(
              monoColor ?? outline.stroke
            )}" stroke-width="${outline.strokeWidth}"${clipAttr ? ` ${clipAttr}` : ''} />\n`;
          }
          continue;
        }
        // A warped label keeps its type: one <text> per glyph, placed along the
        // bend, so the exported file stays editable and crisp.
        const warpGlyphs = warpTextGlyphs(path);
        if (warpGlyphs) {
          const glyphPaint = [
            `font-family="${escapeXml(path.fontFamily || 'sans-serif')}"`,
            `font-size="${path.fontSize || 64}"`,
            `font-weight="${path.fontWeight || 'bold'}"`,
            `fill="${escapeXml(fillValue)}"`,
            `fill-opacity="${(monoColor ? 1 : (path.fillOpacity ?? 1) * objectAlpha).toFixed(2)}"`,
            path.stroke !== 'none' && path.strokeWidth > 0
              ? `stroke="${escapeXml(monoColor ?? path.stroke)}" stroke-width="${path.strokeWidth}"`
              : '',
            clipAttr,
          ]
            .filter(Boolean)
            .join(' ');
          for (const glyph of warpGlyphs) {
            content += `    <text transform="${glyph.transform}" ${glyphPaint}>${escapeXml(glyph.char)}</text>\n`;
          }
          continue;
        }

        const attrs = [
          `x="0"`,
          `y="0"`,
          `transform="translate(${origin.x.toFixed(2)} ${origin.y.toFixed(2)}) ${textMatrixCss(path.textMatrix)}"`,
          `font-family="${escapeXml(path.fontFamily || 'sans-serif')}"`,
          `font-size="${path.fontSize || 64}"`,
          `font-weight="${path.fontWeight || 'bold'}"`,
          path.letterSpacing ? `letter-spacing="${path.letterSpacing.toFixed(2)}"` : '',
          `fill="${escapeXml(fillValue)}"`,
          `fill-opacity="${(monoColor ? 1 : (path.fillOpacity ?? 1) * objectAlpha).toFixed(2)}"`,
          path.stroke !== 'none' && path.strokeWidth > 0
            ? `stroke="${escapeXml(monoColor ?? path.stroke)}" stroke-width="${path.strokeWidth}"`
            : '',
          clipAttr,
        ]
          .filter(Boolean)
          .join(' ');
        const lineHeight = textLineHeight(path.fontSize);
        const body = textLines(path.text)
          .map(
            (line, index) =>
              `<tspan x="${path.textLineX?.[index] ?? 0}" dy="${index === 0 ? 0 : lineHeight.toFixed(2)}">${escapeXml(line || ' ')}</tspan>`
          )
          .join('');
        content += `    <text id="path-${path.id}" ${attrs}>${body}</text>\n`;
        continue;
      }

      // Check if path uses variable pressure profile
      if (path.pressureProfile !== 'uniform') {
        const ribbonD = generateVariableStrokePolygon(path.points, pressureConfig);
        if (ribbonD) {
          const ribbonFill = monoColor
            ? monoColor
            : path.stroke && path.stroke !== 'none'
              ? path.stroke
              : CANVAS.accent;
          const ribbonAlpha = monoColor ? 1 : path.strokeOpacity * objectAlpha;
          content += `    <path d="${ribbonD}" fill="${ribbonFill}" opacity="${ribbonAlpha.toFixed(2)}"${clipAttr ? ` ${clipAttr}` : ''} />\n`;
          continue;
        }
      }

      const d = pathToSvgD(path);
      if (!d) continue;

      // Image paint exports as a raster element cropped to the geometry.
      if (path.image) {
        const imageBox = computePathsBoundingBox([path]);
        if (imageBox) {
          const alpha = path.opacity ?? 1;
          const tag = `    <image href="${escapeXml(path.image.url)}" x="${imageBox.minX.toFixed(
            2
          )}" y="${imageBox.minY.toFixed(2)}" width="${imageBox.width.toFixed(
            2
          )}" height="${imageBox.height.toFixed(2)}" preserveAspectRatio="xMidYMid slice" clip-path="url(#${imageClipIdFor(
            path.id
          )})"${alpha < 1 ? ` opacity="${alpha.toFixed(2)}"` : ''}${
            clipAttr ? ` ${clipAttr}` : ''
          }${filterAttr} />`;
          content += `${tag}\n`;
        }
        continue;
      }

      // A tilted solid paints its projected face, exactly as the editor does.
      const faceD = extrusionFrontPath(path) ?? d;

      if (!monoColor) {
        const shadow = extrusionShadow(path);
        if (shadow) {
          content += `    <defs><filter id="${shadow.id}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${shadow.blur.toFixed(2)}" /></filter></defs>\n`;
          content += `    <g id="extrude-shadow-${path.id}" transform="translate(${shadow.dx.toFixed(2)} ${shadow.dy.toFixed(2)})" filter="url(#${shadow.id})" opacity="${shadow.opacity}"><path d="${faceD}" fill="#000" /><path d="${shadow.d}" fill="#000" /></g>\n`;
        }
        const faces = extrusionFaces(path);
        if (faces.length > 0) {
          content += `    <g id="extrude-${path.id}"${clipAttr ? ` ${clipAttr}` : ''}>\n`;
          for (const face of faces) {
            // A hairline of the face's own colour closes antialiasing seams
            // between neighbouring wall facets without drawing a visible edge.
            content += `      <path d="${face.d}" fill="${face.fill}" fill-opacity="${(path.fillOpacity ?? 1).toFixed(2)}" fill-rule="nonzero" stroke="${face.fill}" stroke-width="0.5" />\n`;
          }
          content += '    </g>\n';
        }
      }

      const fillAttr = monoColor
        ? path.closed
          ? `fill="${monoColor}" fill-opacity="1"`
          : `fill="none"`
        : path.closed && path.pattern
          ? `fill="url(#${patternIdFor(path.id)})" fill-opacity="${(path.fillOpacity * objectAlpha).toFixed(2)}"`
          : path.closed && path.fillGradient && path.fillGradient.stops.length >= 2
          ? `fill="url(#${gradientIdFor(path.id)})" fill-opacity="${(path.fillOpacity * objectAlpha).toFixed(2)}"`
          : path.closed && path.fill !== 'none'
            ? `fill="${path.fill}" fill-opacity="${(path.fillOpacity * objectAlpha).toFixed(2)}"`
            : `fill="none"`;

      const strokeAttr =
        path.stroke !== 'none' && path.strokeWidth > 0
          ? `stroke="${monoColor ?? path.stroke}" stroke-width="${path.strokeWidth}" stroke-opacity="${(monoColor ? 1 : path.strokeOpacity * objectAlpha).toFixed(2)}" stroke-linecap="${path.strokeCap}" stroke-linejoin="${path.strokeJoin}"`
          : `stroke="none"`;

      content += `    <path id="path-${path.id}" d="${faceD}" fill-rule="${path.fillRule ?? 'evenodd'}" ${fillAttr} ${strokeAttr}${clipAttr ? ` ${clipAttr}` : ''}${filterAttr} />\n`;

      // The lit side of an extruded front face, matching the editor exactly.
      if (!monoColor) {
        const sheen = extrusionSheen(path);
        if (sheen) {
          content += `    <defs><radialGradient id="${sheen.id}" cx="${sheen.cx}" cy="${sheen.cy}" r="${sheen.r}"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.55" /><stop offset="100%" stop-color="#ffffff" stop-opacity="0" /></radialGradient></defs>\n`;
          content += `    <path d="${faceD}" fill="url(#${sheen.id})" opacity="${sheen.opacity}" pointer-events="none"${clipAttr ? ` ${clipAttr}` : ''} />\n`;
        }
      }
    }

    content += `  </g>\n`;
  }

  content += `</svg>\n`;
  return content;
}

/**
 * Downloads SVG file to user's device
 */
export function downloadSvg(
  svgString: string,
  filename = 'pentix-logo.svg'
): Promise<SaveOutcome> {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  return saveBlob(blob, filename);
}

/**
 * Renders SVG to canvas and exports high-res PNG at 1x, 2x, or 4x scale
 */
export function exportToPng(
  svgString: string,
  width: number,
  height: number,
  scale = 2,
  filename = 'pentix-logo.png'
): Promise<void> {
  return new Promise((resolve, reject) => {
    if (width * scale > 16384 || height * scale > 16384) {
      reject(new Error('PNG is too large for this device. Use a smaller scale.'));
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    ctx.scale(scale, scale);

    const img = new Image();
    const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);

      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('PNG export failed'));
          return;
        }
        saveBlob(blob, filename).then(
          () => resolve(),
          (err) => reject(err)
        );
      }, 'image/png');
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}

/** Rasterises the SVG to a PNG Blob without triggering a download. */
export function renderPngBlob(
  svgString: string,
  width: number,
  height: number,
  scale = 2
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (width * scale > 16384 || height * scale > 16384) {
      reject(new Error('PNG is too large for this device. Use a smaller scale.'));
      return;
    }
    const canvas = document.createElement('canvas');
    canvas.width = width * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }
    ctx.scale(scale, scale);
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (!blob) reject(new Error('PNG export failed'));
        else resolve(blob);
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not rasterise the PNG'));
    };
    img.src = url;
  });
}
