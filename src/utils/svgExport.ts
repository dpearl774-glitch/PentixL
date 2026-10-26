import { Layer, PressureConfig, VectorPath } from '../types/vector';
import { pointsToSvgPath, generateVariableStrokePolygon } from './bezier';

export interface SvgExportOptions {
  width: number;
  height: number;
  includeBackground: boolean;
  backgroundColor: string;
  prettify?: boolean;
}

/**
 * Generates an SVG string representation of all visible layers
 */
export function generateSvgCode(
  layers: Layer[],
  options: SvgExportOptions,
  pressureConfig: PressureConfig
): string {
  const { width, height, includeBackground, backgroundColor } = options;

  let content = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  content += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">\n`;
  content += `  <!-- Created with Pentix Mobile Vector Logo Studio -->\n`;

  if (includeBackground && backgroundColor && backgroundColor !== 'transparent') {
    content += `  <rect width="100%" height="100%" fill="${backgroundColor}" />\n`;
  }

  for (const layer of layers) {
    if (!layer.visible) continue;

    content += `  <g id="layer-${layer.id}" opacity="${layer.opacity.toFixed(2)}">\n`;

    for (const path of layer.paths) {
      if (path.points.length === 0) continue;

      // Check if path uses variable pressure profile
      if (path.pressureProfile !== 'uniform') {
        const ribbonD = generateVariableStrokePolygon(path.points, pressureConfig);
        if (ribbonD) {
          content += `    <path d="${ribbonD}" fill="${path.stroke || '#00E5FF'}" opacity="${path.strokeOpacity.toFixed(2)}" />\n`;
          continue;
        }
      }

      const d = pointsToSvgPath(path.points, path.closed);
      if (!d) continue;

      const fillAttr = path.closed && path.fill !== 'none'
        ? `fill="${path.fill}" fill-opacity="${path.fillOpacity.toFixed(2)}"`
        : `fill="none"`;

      const strokeAttr = path.stroke !== 'none' && path.strokeWidth > 0
        ? `stroke="${path.stroke}" stroke-width="${path.strokeWidth}" stroke-opacity="${path.strokeOpacity.toFixed(2)}" stroke-linecap="${path.strokeCap}" stroke-linejoin="${path.strokeJoin}"`
        : `stroke="none"`;

      content += `    <path id="path-${path.id}" d="${d}" ${fillAttr} ${strokeAttr} />\n`;
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
