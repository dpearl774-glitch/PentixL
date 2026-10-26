import { Layer, VectorPath } from '../types/vector';
import { pointsToSvgPath } from './bezier';
import { gradientIdFor } from './svgExport';
import { gradientMarkup } from './gradients';

/**
 * Generates standalone SVG markup string for a thumbnail preview of layers
 */
export function generateProjectThumbnailSvg(
  layers: Layer[],
  width: number = 600,
  height: number = 600,
  backgroundColor: string = '#0e1013'
): string {
  const visibleLayers = layers.filter((l) => l.visible !== false);
  const allPaths: { path: VectorPath; layerOpacity: number }[] = [];

  for (const layer of visibleLayers) {
    const opacity = layer.opacity ?? 1;
    for (const path of layer.paths) {
      allPaths.push({ path, layerOpacity: opacity });
    }
  }

  const defs: string[] = [];
  const pathsSvg = allPaths
    .map(({ path, layerOpacity }) => {
      const gradId =
        path.fillGradient && path.fillGradient.stops.length >= 2
          ? gradientIdFor(path.id)
          : null;
      if (gradId) defs.push(gradientMarkup(path.fillGradient!, gradId));
      // Live text needs a real <text> node — a one-point path draws nothing
      if (path.text) {
        const origin = path.points[0];
        if (!origin) return '';
        const safe = path.text
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        const textFill = gradId ? `url(#${gradId})` : path.fill === 'none' ? '#fff' : path.fill;
        return `<text x="${origin.x}" y="${origin.y}" fill="${textFill}" fill-opacity="${(path.fillOpacity ?? 1) * layerOpacity}" font-family="${path.fontFamily || 'sans-serif'}" font-size="${path.fontSize || 64}" font-weight="${path.fontWeight || 'bold'}">${safe}</text>`;
      }

      const d = pointsToSvgPath(path.points, path.closed);
      if (!d) return '';

      const fill = gradId
        ? `url(#${gradId})`
        : path.closed && path.fill !== 'none'
          ? path.fill
          : 'none';
      const fillOpacity = (path.fillOpacity ?? 1) * layerOpacity;
      const stroke = path.stroke !== 'none' ? path.stroke : 'none';
      const strokeWidth = path.strokeWidth || 2;
      const strokeOpacity = (path.strokeOpacity ?? 1) * layerOpacity;
      const strokeCap = path.strokeCap || 'round';
      const strokeJoin = path.strokeJoin || 'round';

      return `<path d="${d}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-opacity="${strokeOpacity}" stroke-linecap="${strokeCap}" stroke-linejoin="${strokeJoin}" />`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
    <rect width="100%" height="100%" fill="${backgroundColor}"/>
    ${defs.length ? `<defs>${defs.join('')}</defs>` : ''}
    <g>
      ${pathsSvg}
    </g>
  </svg>`;
}
