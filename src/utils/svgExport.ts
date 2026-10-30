import { Layer, PressureConfig, VectorPath } from '../types/vector';
import { CANVAS } from '../theme';
import { pathToSvgD, generateVariableStrokePolygon } from './bezier';
import { gradientMarkup } from './gradients';

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
  const { width, height, includeBackground, backgroundColor, monoColor, pathIds, crop } = options;
  const onlyIds = pathIds ? new Set(pathIds) : null;

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
  if (gradientDefs.length) {
    content += `  <defs>\n${gradientDefs.join('\n')}\n  </defs>\n`;
  }

  for (const layer of layers) {
    if (!layer.visible) continue;

    content += `  <g id="layer-${layer.id}" opacity="${layer.opacity.toFixed(2)}">\n`;

    for (const path of layer.paths) {
      if (!isVisible(path)) continue;
      if (onlyIds && !onlyIds.has(path.id)) continue;
      if (path.points.length === 0) continue;

      const objectAlpha = path.opacity ?? 1;

      // Live text objects export as <text> so the string stays editable
      if (path.text) {
        const origin = path.points[0];
        const fillValue = monoColor
          ? monoColor
          : path.fillGradient && path.fillGradient.stops.length >= 2
            ? `url(#${gradientIdFor(path.id)})`
            : path.fill === 'none'
              ? 'none'
              : path.fill;
        const attrs = [
          `x="${origin.x.toFixed(2)}"`,
          `y="${origin.y.toFixed(2)}"`,
          `font-family="${escapeXml(path.fontFamily || 'sans-serif')}"`,
          `font-size="${path.fontSize || 64}"`,
          `font-weight="${path.fontWeight || 'bold'}"`,
          `fill="${fillValue}"`,
          `fill-opacity="${(monoColor ? 1 : (path.fillOpacity ?? 1) * objectAlpha).toFixed(2)}"`,
          path.stroke !== 'none' && path.strokeWidth > 0
            ? `stroke="${monoColor ?? path.stroke}" stroke-width="${path.strokeWidth}"`
            : '',
        ]
          .filter(Boolean)
          .join(' ');
        content += `    <text id="path-${path.id}" ${attrs}>${escapeXml(path.text)}</text>\n`;
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
          content += `    <path d="${ribbonD}" fill="${ribbonFill}" opacity="${ribbonAlpha.toFixed(2)}" />\n`;
          continue;
        }
      }

      const d = pathToSvgD(path);
      if (!d) continue;

      const fillAttr = monoColor
        ? path.closed
          ? `fill="${monoColor}" fill-opacity="1"`
          : `fill="none"`
        : path.closed && path.fillGradient && path.fillGradient.stops.length >= 2
          ? `fill="url(#${gradientIdFor(path.id)})" fill-opacity="${(path.fillOpacity * objectAlpha).toFixed(2)}"`
          : path.closed && path.fill !== 'none'
            ? `fill="${path.fill}" fill-opacity="${(path.fillOpacity * objectAlpha).toFixed(2)}"`
            : `fill="none"`;

      const strokeAttr =
        path.stroke !== 'none' && path.strokeWidth > 0
          ? `stroke="${monoColor ?? path.stroke}" stroke-width="${path.strokeWidth}" stroke-opacity="${(monoColor ? 1 : path.strokeOpacity * objectAlpha).toFixed(2)}" stroke-linecap="${path.strokeCap}" stroke-linejoin="${path.strokeJoin}"`
          : `stroke="none"`;

      content += `    <path id="path-${path.id}" d="${d}" fill-rule="evenodd" ${fillAttr} ${strokeAttr} />\n`;
    }

    content += `  </g>\n`;
  }

  content += `</svg>\n`;
  return content;
}

/**
 * Downloads SVG file to user's device
 */
export function downloadSvg(svgString: string, filename = 'pentix-logo.svg'): void {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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
        const pngUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = pngUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(pngUrl);
        resolve();
      }, 'image/png');
    };

    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };

    img.src = url;
  });
}
