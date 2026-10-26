import { Layer, VectorPath } from '../types/vector';
import { pointsToSvgPath } from './bezier';

/**
 * Generates standalone SVG markup string for a thumbnail preview of layers
 */
export function generateProjectThumbnailSvg(
  layers: Layer[],
  width: number = 600,
  height: number = 600
): string {
  const visibleLayers = layers.filter((l) => l.visible !== false);
  const allPaths: { path: VectorPath; layerOpacity: number }[] = [];

  for (const layer of visibleLayers) {
    const opacity = layer.opacity ?? 1;
    for (const path of layer.paths) {
      allPaths.push({ path, layerOpacity: opacity });
    }
  }

  const pathsSvg = allPaths
    .map(({ path, layerOpacity }) => {
      const d = pointsToSvgPath(path.points, path.closed);
      if (!d) return '';

      const fill = path.closed && path.fill !== 'none' ? path.fill : 'none';
      const fillOpacity = (path.fillOpacity ?? 1) * layerOpacity;
      const stroke = path.stroke !== 'none' ? path.stroke : 'none';
      const strokeWidth = path.strokeWidth || 2;
      const strokeOpacity = (path.strokeOpacity ?? 1) * layerOpacity;
      const strokeCap = path.strokeCap || 'round';
      const strokeJoin = path.strokeJoin || 'round';

      return `<path d="${d}" fill="${fill}" fill-opacity="${fillOpacity}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-opacity="${strokeOpacity}" stroke-linecap="${strokeCap}" stroke-linejoin="${strokeJoin}" />`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%" style="background-color: #0b1120;">
    <defs>
      <pattern id="grid-pattern" width="30" height="30" patternUnits="userSpaceOnUse">
        <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#1e293b" stroke-width="0.75" stroke-opacity="0.5"/>
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="#0b1120"/>
    <rect width="100%" height="100%" fill="url(#grid-pattern)"/>
    <g>
      ${pathsSvg}
    </g>
  </svg>`;
}
