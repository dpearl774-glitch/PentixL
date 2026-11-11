import { Layer, VectorPath } from '../types/vector';
import { pathToSvgD } from './bezier';
import { isPatternPreviewPath } from './effects';
import { gradientIdFor } from './svgExport';
import { gradientMarkup } from './gradients';
import { textLineHeight, textLines, textMatrixCss } from './textGeometry';
import { warpTextGlyphs } from './textWarp';
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
} from './clipping';

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Generates standalone SVG markup string for a thumbnail preview of layers
 */
export function generateProjectThumbnailSvg(
  layers: Layer[],
  width: number = 600,
  height: number = 600,
  backgroundColor: string = '#0e1013'
): string {
  const visibleLayers = layers
    .filter((l) => l.visible !== false)
    // A project's card shows its artwork; the pattern preview is scaffolding.
    .map((layer) => ({
      ...layer,
      paths: layer.paths.filter((path) => !isPatternPreviewPath(path)),
    }));
  const clippingMasks = collectClippingMasks(layers);
  const allPaths: { path: VectorPath; layerOpacity: number }[] = [];

  for (const layer of visibleLayers) {
    const opacity = layer.opacity ?? 1;
    for (const path of layer.paths) {
      allPaths.push({ path, layerOpacity: opacity });
    }
  }

  const masksById = new Map(clippingMasks.map((mask) => [mask.id, mask]));
  const clipIds = new Set(
    allPaths.map(({ path }) => path.clipPathId).filter((id): id is string => !!id)
  );
  const defs: string[] = [
    ...clippingMasks.map((mask) => {
      const d = pathToSvgD(mask);
      return d
        ? `<clipPath id="${clipPathIdFor(mask.id)}" clipPathUnits="userSpaceOnUse"><path d="${d}" fill-rule="evenodd" /></clipPath>`
        : '';
    }),
    ...[...clipIds]
      .filter((id) => !masksById.has(id))
      .map(
        (id) =>
          `<clipPath id="${clipPathIdFor(id)}" clipPathUnits="userSpaceOnUse"></clipPath>`
      ),
  ].filter(Boolean);
  const pathsSvg = allPaths
    .filter(({ path }) => !path.isClippingMask)
    .map(({ path, layerOpacity }) => {
      const clipUrl = clippingUrlFor(path);
      const clipAttr = clipUrl ? ` clip-path="${clipUrl}"` : '';
      const gradId =
        path.fillGradient && path.fillGradient.stops.length >= 2
          ? gradientIdFor(path.id)
          : null;
      if (gradId) defs.push(gradientMarkup(path.fillGradient!, gradId));
      // Live text needs a real <text> node — a one-point path draws nothing
      if (path.text) {
        const origin = path.points[0];
        if (!origin) return '';
        const textFill = gradId ? `url(#${gradId})` : path.fill === 'none' ? '#fff' : path.fill;
        // Warped labels draw one glyph at a time, so the card matches the canvas.
        const warpGlyphs = warpTextGlyphs(path);
        if (warpGlyphs) {
          return warpGlyphs
            .map(
              (glyph) =>
                `<text transform="${glyph.transform}" fill="${escapeXml(textFill)}" fill-opacity="${(path.fillOpacity ?? 1) * layerOpacity}" font-family="${escapeXml(path.fontFamily || 'sans-serif')}" font-size="${path.fontSize || 64}" font-weight="${escapeXml(path.fontWeight || 'bold')}"${clipAttr}>${escapeXml(glyph.char)}</text>`
            )
            .join('');
        }
        const lineHeight = textLineHeight(path.fontSize);
        const body = textLines(path.text)
          .map(
            (line, index) =>
              `<tspan x="${path.textLineX?.[index] ?? 0}" dy="${index === 0 ? 0 : lineHeight}">${escapeXml(line || ' ')}</tspan>`
          )
          .join('');
        return `<text x="0" y="0" transform="translate(${origin.x} ${origin.y}) ${textMatrixCss(path.textMatrix)}" fill="${escapeXml(textFill)}" fill-opacity="${(path.fillOpacity ?? 1) * layerOpacity}" font-family="${escapeXml(path.fontFamily || 'sans-serif')}" font-size="${path.fontSize || 64}" font-weight="${escapeXml(path.fontWeight || 'bold')}" letter-spacing="${path.letterSpacing ?? 0}"${clipAttr}>${body}</text>`;
      }

      const d = pathToSvgD(path);
      if (!d) return '';
      // The card matches the editor: a tilted solid shows its projected face.
      const faceD = extrusionFrontPath(path) ?? d;

      const shadow = extrusionShadow(path);
      const shadowMarkup = shadow
        ? `<filter id="${shadow.id}" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${shadow.blur.toFixed(2)}"/></filter><g transform="translate(${shadow.dx.toFixed(2)} ${shadow.dy.toFixed(2)})" filter="url(#${shadow.id})" opacity="${shadow.opacity}"><path d="${faceD}" fill="#000"/><path d="${shadow.d}" fill="#000"/></g>`
        : '';
      const faces = extrusionFaces(path);
      const extrusionMarkup = shadowMarkup + (faces.length
        ? `<g id="extrude-${path.id}"${clipAttr}>${faces
            .map(
              (face) =>
                `<path d="${face.d}" fill="${escapeXml(face.fill)}" fill-opacity="${path.fillOpacity ?? 1}" fill-rule="nonzero" stroke="${escapeXml(face.fill)}" stroke-width="0.5" />`
            )
            .join('')}</g>`
        : '');

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

      const sheen = extrusionSheen(path);
      const sheenMarkup = sheen
        ? `<defs><radialGradient id="${sheen.id}" cx="${sheen.cx.toFixed(3)}" cy="${sheen.cy.toFixed(3)}" r="${sheen.r}"><stop offset="0%" stop-color="#ffffff" stop-opacity="0.55"/><stop offset="100%" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><path d="${d}" fill="url(#${sheen.id})" opacity="${sheen.opacity}" pointer-events="none"${clipAttr} />`
        : '';

      return `${extrusionMarkup}<path d="${faceD}" fill-rule="${path.fillRule ?? 'evenodd'}" fill="${escapeXml(fill)}" fill-opacity="${fillOpacity}" stroke="${escapeXml(stroke)}" stroke-width="${strokeWidth}" stroke-opacity="${strokeOpacity}" stroke-linecap="${strokeCap}" stroke-linejoin="${strokeJoin}"${clipAttr} />${sheenMarkup}`;
    })
    .join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="100%" height="100%">
    <rect width="100%" height="100%" fill="${escapeXml(backgroundColor)}"/>
    ${defs.length ? `<defs>${defs.join('')}</defs>` : ''}
    <g>
      ${pathsSvg}
    </g>
  </svg>`;
}
