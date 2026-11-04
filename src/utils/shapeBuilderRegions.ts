import polygonClipping, { MultiPolygon, Polygon, Ring } from 'polygon-clipping';
import { AnchorPoint, Point, VectorPath } from '../types/vector';
import { pathToPolygon } from './bezier';
import { ringToVectorPath, visibleClippingGeometry } from './shapeBuilder';

export interface SubRegion {
  id: string;
  polygon: Polygon;
  sourcePathIds: string[];
  pathD: string;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  centroid: Point;
  fill: string;
  stroke: string;
}

/**
 * Converts a polygon-clipping Polygon to an SVG path data string
 */
export function polygonToSvgPathD(poly: Polygon): string {
  let d = '';
  for (const ring of poly) {
    if (ring.length < 3) continue;
    d += `M ${ring[0][0]} ${ring[0][1]} `;
    for (let i = 1; i < ring.length; i++) {
      d += `L ${ring[i][0]} ${ring[i][1]} `;
    }
    d += 'Z ';
  }
  return d.trim();
}

/**
 * Computes bounding box and centroid of a Polygon
 */
function computePolygonStats(poly: Polygon): {
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  centroid: Point;
} {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let sumX = 0;
  let sumY = 0;
  let count = 0;

  for (const ring of poly) {
    for (const [x, y] of ring) {
      if (x < minX) minX = x;
      if (y < minY) minY = y;
      if (x > maxX) maxX = x;
      if (y > maxY) maxY = y;
      sumX += x;
      sumY += y;
      count++;
    }
  }

  return {
    bbox: {
      minX: minX === Infinity ? 0 : minX,
      minY: minY === Infinity ? 0 : minY,
      maxX: maxX === -Infinity ? 0 : maxX,
      maxY: maxY === -Infinity ? 0 : maxY,
    },
    centroid: {
      x: count > 0 ? sumX / count : 0,
      y: count > 0 ? sumY / count : 0,
    },
  };
}

/**
 * Standard ray-casting point-in-polygon test (handles holes)
 */
export function isPointInPolygon(pt: Point, poly: Polygon): boolean {
  if (poly.length === 0) return false;

  // Exterior ring (index 0) must contain point
  const outerRing = poly[0];
  let inside = false;
  for (let i = 0, j = outerRing.length - 1; i < outerRing.length; j = i++) {
    const xi = outerRing[i][0];
    const yi = outerRing[i][1];
    const xj = outerRing[j][0];
    const yj = outerRing[j][1];

    const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi || 0.00001) + xi;
    if (intersect) inside = !inside;
  }

  if (!inside) return false;

  // Inner rings (holes) must NOT contain point
  for (let r = 1; r < poly.length; r++) {
    const hole = poly[r];
    let inHole = false;
    for (let i = 0, j = hole.length - 1; i < hole.length; j = i++) {
      const xi = hole[i][0];
      const yi = hole[i][1];
      const xj = hole[j][0];
      const yj = hole[j][1];

      const intersect = yi > pt.y !== yj > pt.y && pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi || 0.00001) + xi;
      if (intersect) inHole = !inHole;
    }
    if (inHole) return false; // Inside hole -> not in polygon
  }

  return true;
}

/**
 * Decomposes an array of overlapping VectorPaths into atomic, non-overlapping planar sub-regions
 */
export function computeAtomicSubRegions(
  paths: VectorPath[],
  allPaths: VectorPath[] = paths
): SubRegion[] {
  if (paths.length === 0) return [];

  interface IntermediateRegion {
    poly: Polygon;
    sourcePathIds: string[];
    topPath: VectorPath;
  }

  const byId = new Map(allPaths.map((path) => [path.id, path]));
  let currentRegions: IntermediateRegion[] = [];

  for (const path of paths) {
    // A clipped path contributes only the pieces inside its clip chain.
    for (const pathPoly of visibleClippingGeometry(path, byId)) {
      if (!pathPoly || pathPoly.length < 3) continue;

      if (currentRegions.length === 0) {
        currentRegions.push({
          poly: pathPoly,
          sourcePathIds: [path.id],
          topPath: path,
        });
        continue;
      }

      const nextRegions: IntermediateRegion[] = [];
      let remainder: MultiPolygon = [pathPoly];

      for (const region of currentRegions) {
        try {
          const intersection = polygonClipping.intersection(region.poly, pathPoly);
          const difference = polygonClipping.difference(region.poly, pathPoly);

          // Pieces of existing region that do NOT overlap with new path
          for (const diffPoly of difference) {
            if (diffPoly && diffPoly.length > 0 && diffPoly[0].length >= 3) {
              nextRegions.push({
                poly: diffPoly,
                sourcePathIds: [...region.sourcePathIds],
                topPath: region.topPath,
              });
            }
          }

          // Overlapping intersection pieces
          for (const interPoly of intersection) {
            if (interPoly && interPoly.length > 0 && interPoly[0].length >= 3) {
              nextRegions.push({
                poly: interPoly,
                sourcePathIds: Array.from(new Set([...region.sourcePathIds, path.id])),
                topPath: path, // newer path on top
              });
            }
          }

          // Subtract the intersection from remainder of new path
          if (intersection.length > 0) {
            remainder = polygonClipping.difference(remainder, intersection);
          }
        } catch (err) {
          console.warn('Polygon subdivision step failed, preserving region', err);
          nextRegions.push(region);
        }
      }

      // Remainder of the new path that did not overlap with any previous region
      for (const remPoly of remainder) {
        if (remPoly && remPoly.length > 0 && remPoly[0].length >= 3) {
          nextRegions.push({
            poly: remPoly,
            sourcePathIds: [path.id],
            topPath: path,
          });
        }
      }

      currentRegions = nextRegions;
    }
  }

  // Format into final SubRegion structures
  return currentRegions.map((r, idx) => {
    const { bbox, centroid } = computePolygonStats(r.poly);
    return {
      id: `subregion-${idx}-${r.sourcePathIds.join('_')}`,
      polygon: r.poly,
      sourcePathIds: r.sourcePathIds,
      pathD: polygonToSvgPathD(r.poly),
      bbox,
      centroid,
      fill: r.topPath.fill !== 'none' ? r.topPath.fill : '#4C8DFF',
      stroke: r.topPath.stroke !== 'none' ? r.topPath.stroke : '#E8EAED',
    };
  });
}

/**
 * Finds which sub-region contains the given point
 */
export function findSubRegionAtPoint(point: Point, regions: SubRegion[]): SubRegion | null {
  for (const region of regions) {
    if (
      point.x >= region.bbox.minX &&
      point.x <= region.bbox.maxX &&
      point.y >= region.bbox.minY &&
      point.y <= region.bbox.maxY
    ) {
      if (isPointInPolygon(point, region.polygon)) {
        return region;
      }
    }
  }
  return null;
}

import { simplifyPoints, decimateContour, fitSmoothBezierCurves } from './contourTracer';

/**
 * Converts one clipping ring into anchors. The boolean output arrives as a near
 * point-per-pixel chain, so it is reduced first; every remaining vertex then
 * gets curve handles. Corner-only anchors turned every arc inherited from the
 * original artwork into a straight chord, which is the faceting you can see on
 * merged, trimmed and erased results. Genuine corners stay corners, because the
 * fitter only smooths a vertex whose deflection is under ~85°.
 */
function ringToAnchors(ring: Ring, idPrefix: string): AnchorPoint[] | null {
  const count =
    ring.length > 1 &&
    ring[0][0] === ring[ring.length - 1][0] &&
    ring[0][1] === ring[ring.length - 1][1]
      ? ring.length - 1
      : ring.length;

  if (count < 3) return null;

  const raw: Point[] = [];
  for (let i = 0; i < count; i++) raw.push({ x: ring[i][0], y: ring[i][1] });

  // Finer than a whole artboard unit: chords that coarse are visible on a mark
  // that is only a few hundred units across.
  const tolerance = 0.75;
  const reduced =
    raw.length > 3
      ? decimateContour(simplifyPoints(raw, tolerance * 0.5), tolerance * 0.5, true)
      : raw;
  if (reduced.length < 3) return null;

  return fitSmoothBezierCurves(reduced, idPrefix, true, tolerance);
}

/**
 * Converts a Polygon to a standard editable VectorPath, keeping its counters as
 * holes this path owns (drawn even-odd) instead of dropping them.
 */
export function polygonToVectorPath(
  poly: Polygon,
  baseStyle: Partial<VectorPath>,
  idPrefix: string
): VectorPath {
  const points = ringToAnchors(poly[0] || [], `${idPrefix}-pt`) ?? [];
  const holes = poly
    .slice(1)
    .map((ring, i) => ringToAnchors(ring, `${idPrefix}-hole-${i}`))
    .filter((ring): ring is AnchorPoint[] => ring !== null);

  return {
    id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: baseStyle.name || 'Shape',
    points,
    ...(holes.length > 0 ? { holes } : {}),
    closed: true,
    fill: baseStyle.fill || '#4C8DFF',
    fillOpacity: baseStyle.fillOpacity ?? 1,
    stroke: baseStyle.stroke || '#E8EAED',
    strokeWidth: baseStyle.strokeWidth ?? 3,
    strokeOpacity: baseStyle.strokeOpacity ?? 1,
    strokeCap: baseStyle.strokeCap || 'round',
    strokeJoin: baseStyle.strokeJoin || 'round',
    pressureProfile: baseStyle.pressureProfile || 'uniform',
  };
}

/**
 * Merges (Unites) selected sub-regions into one or more new shapes,
 * while preserving any unselected regions as clean vector paths.
 */
export function executeShapeBuilderMerge(
  selectedRegionIds: string[],
  allRegions: SubRegion[],
  originalPaths: VectorPath[],
  activeStyle: { fill: string; stroke: string; strokeWidth: number }
): VectorPath[] {
  if (selectedRegionIds.length === 0) return originalPaths;

  const selectedRegions = allRegions.filter((r) => selectedRegionIds.includes(r.id));
  const unselectedRegions = allRegions.filter((r) => !selectedRegionIds.includes(r.id));

  const resultingPaths: VectorPath[] = [];

  // 1. Union all selected regions — fresh geometry, fit curves for smoothness
  if (selectedRegions.length > 0) {
    try {
      const selectedPolys = selectedRegions.map((r) => r.polygon);
      const unitedMultiPoly = polygonClipping.union(selectedPolys[0], ...selectedPolys.slice(1));

      for (let i = 0; i < unitedMultiPoly.length; i++) {
        const poly = unitedMultiPoly[i];
        if (poly.length > 0 && poly[0].length >= 3) {
          resultingPaths.push(
            polygonToVectorPath(
              poly,
              {
                name: `Shape Builder Union ${resultingPaths.length + 1}`,
                fill: activeStyle.fill,
                fillOpacity: 1,
                stroke: activeStyle.stroke,
                strokeWidth: activeStyle.strokeWidth,
                strokeOpacity: 1,
              },
              `sb-union-${i}`
            )
          );
        }
      }
    } catch (err) {
      console.error('Shape builder merge union failed:', err);
    }
  }

  // 2. Preserve unselected regions — simple corner anchors, no Bezier refit
  for (let i = 0; i < unselectedRegions.length; i++) {
    const reg = unselectedRegions[i];
    const source = originalPaths.find((p) => p.id === reg.sourcePathIds[0]) || originalPaths[0];

    resultingPaths.push(
      polygonToVectorPath(
        reg.polygon,
        {
          name: `${source.name}${selectedRegions.length > 0 ? ' (Part)' : ''}`,
          fill: reg.fill,
          fillOpacity: source.fillOpacity ?? 1,
          stroke: reg.stroke,
          strokeWidth: source.strokeWidth || 3,
          strokeOpacity: source.strokeOpacity ?? 1,
          strokeCap: source.strokeCap,
          strokeJoin: source.strokeJoin,
          pressureProfile: source.pressureProfile,
        },
        `sb-remain-${i}`
      )
    );
  }

  return resultingPaths;
}

/**
 * Erases / Subtracts selected sub-regions from the participating shapes
 */
export function executeShapeBuilderErase(
  erasedRegionIds: string[],
  allRegions: SubRegion[],
  originalPaths: VectorPath[]
): VectorPath[] {
  if (erasedRegionIds.length === 0) return originalPaths;

  const remainingRegions = allRegions.filter((r) => !erasedRegionIds.includes(r.id));
  const resultingPaths: VectorPath[] = [];

  for (let i = 0; i < remainingRegions.length; i++) {
    const reg = remainingRegions[i];
    const source = originalPaths.find((p) => p.id === reg.sourcePathIds[0]) || originalPaths[0];

    resultingPaths.push(
      polygonToVectorPath(
        reg.polygon,
        {
          name: `${source.name} (Trimmed)`,
          fill: reg.fill,
          fillOpacity: source.fillOpacity ?? 1,
          stroke: reg.stroke,
          strokeWidth: source.strokeWidth || 3,
          strokeOpacity: source.strokeOpacity ?? 1,
          strokeCap: source.strokeCap,
          strokeJoin: source.strokeJoin,
          pressureProfile: source.pressureProfile,
        },
        `sb-erase-${i}`
      )
    );
  }

  return resultingPaths;
}
