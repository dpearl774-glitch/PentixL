import polygonClipping, { MultiPolygon } from 'polygon-clipping';
import type { VectorPath } from '../types/vector';
import { vectorPathToClippingPolygon } from './shapeBuilder';
import { polygonToSvgPathD } from './shapeBuilderRegions';

function multiPolygonToSvgD(multi: MultiPolygon): string {
  return multi.map((polygon) => polygonToSvgPathD(polygon)).filter(Boolean).join(' ');
}

/**
 * The visible outline of one path after its clip chain is applied. A missing
 * source resolves to no geometry, never to the unclipped original.
 */
function visibleGeometry(
  path: VectorPath,
  byId: Map<string, VectorPath>,
  seen: Set<string>
): MultiPolygon {
  if (seen.has(path.id)) return [];
  const polygon = vectorPathToClippingPolygon(path);
  if (!polygon.length || polygon[0].length < 3) return [];
  if (!path.clipPathId) return [polygon];

  const source = byId.get(path.clipPathId);
  if (!source || !source.closed || source.text || source.points.length < 3) return [];
  const nextSeen = new Set(seen).add(path.id);
  const sourceGeometry = visibleGeometry(source, byId, nextSeen);
  if (!sourceGeometry.length) return [];
  return polygonClipping.intersection([polygon], sourceGeometry);
}

/**
 * The union of every pairwise intersection between the visible parts of the
 * selected closed shapes. This is feedback only: the paths are not modified.
 */
export function computeSelectionOverlapD(
  paths: VectorPath[],
  allPaths: VectorPath[] = []
): string | null {
  const closed = paths.filter(
    (path) => path.closed && !path.text && path.points.length >= 3
  );
  if (closed.length < 2) return null;

  const byId = new Map(allPaths.map((path) => [path.id, path]));
  const polygons = closed
    .map((path) => visibleGeometry(path, byId, new Set()))
    .filter((geometry) => geometry.length > 0);
  if (polygons.length < 2) return null;

  try {
    let overlap: MultiPolygon = [];
    for (let i = 0; i < polygons.length; i += 1) {
      for (let j = i + 1; j < polygons.length; j += 1) {
        const intersection = polygonClipping.intersection(polygons[i], polygons[j]);
        if (!intersection.length) continue;
        overlap = overlap.length
          ? polygonClipping.union(overlap, intersection)
          : intersection;
      }
    }
    return overlap.length ? multiPolygonToSvgD(overlap) : null;
  } catch {
    // Self-intersecting artwork can defeat polygon clipping; feedback should
    // never make selection or dragging fail.
    return null;
  }
}
