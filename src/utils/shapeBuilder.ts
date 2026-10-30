import polygonClipping, { MultiPolygon, Polygon, Ring } from 'polygon-clipping';
import { AnchorPoint, VectorPath } from '../types/vector';
import { pathToPolygon } from './bezier';

/**
 * Converts a VectorPath to a polygon format recognized by polygon-clipping
 */
export function vectorPathToClippingPolygon(path: VectorPath): Polygon {
  const sampled = pathToPolygon(path, 24);
  if (sampled.length < 3) return [];
  // Ensure the polygon is closed (first and last point match)
  const first = sampled[0];
  const last = sampled[sampled.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    sampled.push([first[0], first[1]]);
  }
  return [sampled as Ring];
}

import { simplifyPoints, decimateContour, fitSmoothBezierCurves } from './contourTracer';

/**
 * Converts a polygon-clipping Ring back to an editable VectorPath with smooth Bezier curves
 */
export function ringToVectorPath(
  ring: Ring,
  basePath: VectorPath,
  idSuffix: string
): VectorPath {
  // Exclude duplicate closing point
  const count = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]
    ? ring.length - 1
    : ring.length;

  const rawPts = [];
  for (let i = 0; i < count; i++) {
    rawPts.push({ x: ring[i][0], y: ring[i][1] });
  }

  // Keep the boolean outline truthful, then let the fitter decide where the
  // anchors go — one per curve instead of one per sampled point.
  const tolerance = 0.75;
  const simplified =
    rawPts.length > 3
      ? decimateContour(simplifyPoints(rawPts, tolerance * 0.5), tolerance * 0.5, true)
      : rawPts;
  const points = fitSmoothBezierCurves(simplified, `${basePath.id}-${idSuffix}`, true, tolerance);

  return {
    ...basePath,
    id: `${basePath.id}-res-${idSuffix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    points,
    closed: true,
  };
}

/**
 * Converts MultiPolygon result from polygon-clipping back to VectorPaths
 */
export function multiPolygonToVectorPaths(
  multiPoly: MultiPolygon,
  basePath: VectorPath
): VectorPath[] {
  const result: VectorPath[] = [];
  multiPoly.forEach((poly, polyIdx) => {
    poly.forEach((ring, ringIdx) => {
      // Outer rings have positive orientation; inner rings are holes
      if (ring.length >= 3) {
        result.push(ringToVectorPath(ring, basePath, `${polyIdx}-${ringIdx}`));
      }
    });
  });
  return result;
}

export type BooleanOperation = 'union' | 'subtract' | 'intersect' | 'exclude' | 'divide';

/**
 * Executes a Boolean operation on selected paths (Illustrator Pathfinder & Shape Builder core)
 */
export function executeBooleanOperation(
  paths: VectorPath[],
  operation: BooleanOperation
): VectorPath[] {
  if (paths.length < 2) return paths;

  const polys = paths.map((p) => vectorPathToClippingPolygon(p)).filter((p) => p.length > 0);
  if (polys.length < 2) return paths;

  const baseStyle = paths[0];

  try {
    switch (operation) {
      case 'union': {
        const result = polygonClipping.union(polys[0], ...polys.slice(1));
        return multiPolygonToVectorPaths(result, {
          ...baseStyle,
          name: 'United Shape',
        });
      }

      case 'subtract': {
        // Subtract paths 1..n from path 0 (Minus Front)
        let currentResult: MultiPolygon = [polys[0]];
        for (let i = 1; i < polys.length; i++) {
          currentResult = polygonClipping.difference(currentResult, polys[i]);
        }
        return multiPolygonToVectorPaths(currentResult, {
          ...baseStyle,
          name: 'Subtracted Shape',
        });
      }

      case 'intersect': {
        let currentResult: MultiPolygon = [polys[0]];
        for (let i = 1; i < polys.length; i++) {
          currentResult = polygonClipping.intersection(currentResult, polys[i]);
        }
        return multiPolygonToVectorPaths(currentResult, {
          ...baseStyle,
          name: 'Intersected Shape',
        });
      }

      case 'exclude': {
        let currentResult: MultiPolygon = [polys[0]];
        for (let i = 1; i < polys.length; i++) {
          currentResult = polygonClipping.xor(currentResult, polys[i]);
        }
        return multiPolygonToVectorPaths(currentResult, {
          ...baseStyle,
          name: 'Excluded Shape',
        });
      }

      case 'divide': {
        // Divide partitions into: A - B, B - A, and A ∩ B
        const pA = polys[0];
        const pB = polys[1];

        const intersection = polygonClipping.intersection(pA, pB);
        const diffA = polygonClipping.difference(pA, pB);
        const diffB = polygonClipping.difference(pB, pA);

        const partsA = multiPolygonToVectorPaths(diffA, { ...paths[0], name: `${paths[0].name} (Part 1)` });
        const partsB = multiPolygonToVectorPaths(diffB, { ...paths[1], name: `${paths[1].name} (Part 2)` });
        const partsInter = multiPolygonToVectorPaths(intersection, {
          ...paths[0],
          name: 'Divided Intersection',
          fill: paths[0].fill !== 'none' ? paths[0].fill : paths[1].fill,
        });

        const dividedPieces = [...partsA, ...partsInter, ...partsB];
        return dividedPieces.length > 0 ? dividedPieces : paths;
      }
    }
  } catch (err) {
    console.error('Boolean operation failed:', err);
    return paths;
  }
}

