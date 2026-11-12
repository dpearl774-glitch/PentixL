import polygonClipping, { MultiPolygon, Polygon, Ring } from 'polygon-clipping';
import { AnchorPoint, Point, VectorPath } from '../types/vector';
import { pathToPolygon } from './bezier';
import { FIT_TOLERANCE, ringToVectorPath, visibleClippingGeometry } from './shapeBuilder';

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
    // Each item is a Polygon (an array of rings), so the point count lives on
    // its exterior ring — testing the array length here rejected every shape
    // with one ring, which is why no region was ever offered.
    for (const pathPoly of visibleClippingGeometry(path, byId)) {
      if (!pathPoly || !pathPoly.length) continue;
      if (!pathPoly[0] || pathPoly[0].length < 3) continue;

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
      // No stroke stays no stroke: a missing stroke used to fall back to a grey
      // hairline, and every build result then inherited it.
      stroke:
        r.topPath.stroke && r.topPath.stroke !== 'none' && (r.topPath.strokeWidth ?? 0) > 0
          ? r.topPath.stroke
          : 'none',
    };
  });
}

/**
 * The union of every region the build gesture has touched so far, as one path.
 *
 * This is what makes Shape Builder predictable: the per-region hatch only says
 * what is under the cursor, so until the mouse came back up you could not see
 * the shape you were actually building. The union outline is painted live, and
 * it is the silhouette that will exist after release.
 */
export function regionUnionOutline(regions: SubRegion[], ids: string[]): string {
  if (ids.length < 2) return '';
  const picked = regions.filter((region) => ids.includes(region.id));
  if (picked.length < 2) return '';

  try {
    const united = polygonClipping.union(
      picked[0].polygon,
      ...picked.slice(1).map((region) => region.polygon)
    );
    return united
      .map((poly) => polygonToSvgPathD(poly))
      .join(' ')
      .trim();
  } catch {
    return '';
  }
}

/**
 * Outline of the whole of every given shape, for the merge preview. The builder
 * joins entire shapes, so the preview has to show those shapes rather than only
 * the patch under the finger — otherwise the result is not what was promised.
 */
export function shapeUnionOutline(
  paths: VectorPath[],
  allPaths: VectorPath[] = paths
): string {
  if (paths.length < 2) return '';
  const byId = new Map(allPaths.map((path) => [path.id, path]));
  let united: MultiPolygon = [];
  for (const path of paths) {
    const geometry = visibleClippingGeometry(path, byId);
    if (!geometry.length) continue;
    try {
      united = united.length
        ? polygonClipping.union(united, geometry)
        : (geometry as MultiPolygon);
    } catch {
      // A failed union leaves the preview without that piece, not without one.
    }
  }
  return united
    .map((poly) => polygonToSvgPathD(poly))
    .join(' ')
    .trim();
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

import { fitSmoothBezierCurves } from './contourTracer';

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
  if (raw.length < 3) return null;

  // The boolean ring is already a faithful flattening of the artwork, so it is
  // fitted directly. Simplifying it first shifted corners by up to half a unit
  // and let the fitter bow arcs away from the shape the artist drew.
  //
  // The corner threshold is deliberately tight: where two outlines cross, the
  // junction is a real cusp, and treating it as smooth rounded the tips of a
  // lens or a crescent — the visible "the shape changed" on a built logo.
  return fitSmoothBezierCurves(raw, idPrefix, true, FIT_TOLERANCE, CUSP_ANGLE);
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

  const strokeColor = baseStyle.stroke && baseStyle.stroke !== 'none' ? baseStyle.stroke : 'none';
  const strokeThickness = strokeColor === 'none' ? 0 : (baseStyle.strokeWidth ?? 1);

  return {
    id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name: baseStyle.name || 'Shape',
    points,
    ...(holes.length > 0 ? { holes } : {}),
    closed: true,
    fill: baseStyle.fill || '#4C8DFF',
    fillOpacity: baseStyle.fillOpacity ?? 1,
    stroke: strokeColor,
    strokeWidth: strokeThickness,
    strokeOpacity: baseStyle.strokeOpacity ?? 1,
    strokeCap: baseStyle.strokeCap || 'round',
    strokeJoin: baseStyle.strokeJoin || 'round',
    pressureProfile: baseStyle.pressureProfile || 'uniform',
  };
}

/** Absolute area of a polygon, holes subtracted. */
function polygonArea(poly: Polygon): number {
  const ringArea = (ring: Ring): number => {
    let sum = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    }
    return Math.abs(sum) / 2;
  };
  if (!poly.length) return 0;
  return poly.slice(1).reduce((area, hole) => area - ringArea(hole), ringArea(poly[0]));
}

/**
 * Boolean operations leave hairline slivers where two edges almost meet. They
 * are invisible on the board but real objects in the document, which is how a
 * long build session filled the canvas with shapes nobody could see.
 */
const SLIVER_AREA = 0.75;

/**
 * Vertex deflection, in radians, above which a fitted anchor is kept sharp.
 * Boolean output meets its own boundary at real cusps; smoothing those is what
 * rounded the crossing points of two built shapes.
 */
const CUSP_ANGLE = 0.35;
const isReal = (poly: Polygon, sourceArea: number): boolean => {
  if (!poly.length || !poly[0] || poly[0].length < 3) return false;
  return polygonArea(poly) > Math.max(SLIVER_AREA, sourceArea * 0.002);
};

/** The untouched part of a shape once a region has been merged or erased out of it. */
function remainingPieces(
  path: VectorPath,
  cut: MultiPolygon,
  byId: Map<string, VectorPath>
): VectorPath[] {
  const pieces: VectorPath[] = [];
  let index = 0;

  for (const geometry of visibleClippingGeometry(path, byId)) {
    if (!geometry.length || !geometry[0] || geometry[0].length < 3) continue;

    // A shape the build did not actually touch is left exactly as it was: no
    // rebuild, no refit, no drift from repeated boolean passes.
    let touched = true;
    try {
      touched = polygonClipping.intersection(geometry, cut).length > 0;
    } catch {
      touched = true;
    }
    if (!touched) {
      pieces.push(path);
      continue;
    }

    let rest: MultiPolygon;
    try {
      rest = polygonClipping.difference(geometry, cut);
    } catch {
      // A pathological ring should keep the shape rather than delete it.
      rest = [geometry];
    }
    const sourceArea = polygonArea(geometry);
    for (const poly of rest) {
      if (!isReal(poly, sourceArea)) continue;
      const shell = polygonToVectorPath(
        poly,
        {
          name: path.name,
          fill: path.fill,
          fillOpacity: path.fillOpacity,
          stroke: path.stroke,
          strokeWidth: path.strokeWidth,
          strokeOpacity: path.strokeOpacity,
          strokeCap: path.strokeCap,
          strokeJoin: path.strokeJoin,
          pressureProfile: path.pressureProfile,
        },
        `sb-keep-${index++}`
      );
      if (shell.points.length < 3) continue;
      // The remainder is the same object the artist drew, with new geometry:
      // name, paint, gradient and effects all survive the build.
      pieces.push({
        ...path,
        id: shell.id,
        points: shell.points,
        holes: shell.holes,
        closed: true,
        fill: shell.fill,
        fillOpacity: shell.fillOpacity,
        stroke: shell.stroke,
        strokeWidth: shell.strokeWidth,
        strokeOpacity: shell.strokeOpacity,
        text: undefined,
        isClippingMask: false,
        clipPathId: undefined,
        cornerRadius: undefined,
        cornerRadii: undefined,
        cornerSource: undefined,
      });
    }
  }

  return pieces;
}

/** The area covered by a set of regions, as one multipolygon. */
function regionArea(regions: SubRegion[]): MultiPolygon | null {
  if (!regions.length) return null;
  try {
    return polygonClipping.union(regions[0].polygon, ...regions.slice(1).map((r) => r.polygon));
  } catch {
    return null;
  }
}

/**
 * Merges the shapes whose regions were brushed into one object.
 *
 * The union covers the whole of each shape that took part, not just the brushed
 * patch: merging the intersection of two circles used to hand back the lens
 * plus two crescents, which reads on screen as the shapes doubling. Shapes that
 * were not brushed are returned untouched.
 */
export function executeShapeBuilderMerge(
  selectedRegionIds: string[],
  allRegions: SubRegion[],
  originalPaths: VectorPath[],
  activeStyle: { fill: string; stroke: string; strokeWidth: number }
): VectorPath[] {
  const selected = allRegions.filter((region) => selectedRegionIds.includes(region.id));
  if (!selected.length) return originalPaths;

  const owners = new Set(selected.flatMap((region) => region.sourcePathIds));
  // Brushing a shape's own area is not a merge: nothing joins it.
  if (owners.size < 2) return originalPaths;

  const byId = new Map(originalPaths.map((path) => [path.id, path]));
  let merged: MultiPolygon = [];
  for (const path of originalPaths) {
    if (!owners.has(path.id)) continue;
    const geometry = visibleClippingGeometry(path, byId);
    if (!geometry.length) continue;
    try {
      merged = merged.length
        ? polygonClipping.union(merged, geometry)
        : (geometry as MultiPolygon);
    } catch {
      // Keep going with what already merged rather than losing the whole build.
    }
  }

  const resultingPaths: VectorPath[] = [];
  merged.forEach((poly, index) => {
    if (!isReal(poly, 0)) return;
    resultingPaths.push(
      polygonToVectorPath(
        poly,
        {
          name: owners.size > 1 ? 'Shape Builder Union' : 'Shape Builder',
          fill: activeStyle.fill,
          fillOpacity: 1,
          stroke: activeStyle.stroke,
          strokeWidth: activeStyle.strokeWidth,
          strokeOpacity: 1,
        },
        `sb-union-${index}`
      )
    );
  });

  if (!resultingPaths.length) return originalPaths;

  // Whatever was not brushed stays exactly as it was. Nothing is rebuilt, so
  // unrelated shapes cannot drift during someone else's build.
  for (const path of originalPaths) {
    if (!owners.has(path.id)) resultingPaths.push(path);
  }
  return resultingPaths;
}

/**
 * Erases the touched regions out of the shapes they belong to.
 *
 * Each surviving shape is cut individually, so after an erase you can still see
 * and pick the shapes you had — only the erased area is gone.
 */
export function executeShapeBuilderErase(
  erasedRegionIds: string[],
  allRegions: SubRegion[],
  originalPaths: VectorPath[]
): VectorPath[] {
  const erased = allRegions.filter((region) => erasedRegionIds.includes(region.id));
  const cut = regionArea(erased);
  if (!cut) return originalPaths;

  const byId = new Map(originalPaths.map((path) => [path.id, path]));
  const resultingPaths: VectorPath[] = [];
  for (const path of originalPaths) {
    resultingPaths.push(...remainingPieces(path, cut, byId));
  }
  return resultingPaths;
}
