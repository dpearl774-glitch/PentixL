import polygonClipping, { MultiPolygon, Polygon, Ring } from 'polygon-clipping';
import { AnchorPoint, VectorPath } from '../types/vector';
import { pathToPolygon } from './bezier';
import { computePathsBoundingBox } from './transform';
import type { BoundingBox } from './transform';

/**
 * Converts a VectorPath to a polygon format recognized by polygon-clipping
 */
/**
 * Samples per curve segment. One sample roughly every 1.5 artboard units keeps
 * a large arc within a few hundredths of a unit of the true curve — finer than
 * the fit that rebuilds the outline afterwards, so flattening stops being the
 * reason a built shape differs from the one that was drawn.
 */
function flattenSteps(path: VectorPath): number {
  const count = Math.max(1, path.points.length);
  let span = 0;
  for (let i = 0; i < count; i++) {
    const a = path.points[i];
    const b = path.points[(i + 1) % count];
    span += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return Math.max(12, Math.min(96, Math.round(span / count / 1.5) + 4));
}

export function vectorPathToClippingPolygon(path: VectorPath): Polygon {
  const sampled = pathToPolygon(path, flattenSteps(path));
  if (sampled.length < 3) return [];
  // Ensure the polygon is closed (first and last point match)
  const first = sampled[0];
  const last = sampled[sampled.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    sampled.push([first[0], first[1]]);
  }
  return [sampled as Ring];
}

import { fitSmoothBezierCurves } from './contourTracer';

/**
 * How far a rebuilt outline may sit from the boolean result, in artboard units.
 * Below a pixel at any normal zoom, so a built shape reads as the shape it came
 * from instead of a close cousin of it.
 */
export const FIT_TOLERANCE = 0.1;

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
  const points = fitSmoothBezierCurves(rawPts, `${basePath.id}-${idSuffix}`, true, FIT_TOLERANCE);

  return {
    ...basePath,
    id: `${basePath.id}-res-${idSuffix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    points,
    closed: true,
    cornerRadius: undefined,
    cornerRadii: undefined,
    cornerSource: undefined,
    // A Boolean result is a new editable object, not a mask or a clipped child.
    clipPathId: undefined,
    isClippingMask: false,
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

/** Visible geometry after a clip chain, for destructive operations. */
export function visibleClippingGeometry(
  path: VectorPath,
  byId: Map<string, VectorPath>,
  seen: Set<string> = new Set()
): MultiPolygon {
  if (seen.has(path.id)) return [];
  const polygon = vectorPathToClippingPolygon(path);
  if (!polygon.length || polygon[0].length < 3) return [];
  if (!path.clipPathId) return [polygon];

  const source = byId.get(path.clipPathId);
  if (!source || !source.closed || source.text || source.points.length < 3) return [];
  const sourceGeometry = visibleClippingGeometry(
    source,
    byId,
    new Set(seen).add(path.id)
  );
  if (!sourceGeometry.length) return [];
  return polygonClipping.intersection([polygon], sourceGeometry);
}

/** Visible selection bounds, excluding geometry hidden by a clip chain. */
export function computeVisiblePathsBoundingBox(
  paths: VectorPath[],
  allPaths: VectorPath[] = paths
): BoundingBox | null {
  const byId = new Map(allPaths.map((path) => [path.id, path]));
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let hasPoints = false;

  const include = (x: number, y: number) => {
    hasPoints = true;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };

  for (const path of paths) {
    // Text has a real glyph box that the polygon sampler cannot reconstruct.
    if (path.text || !path.clipPathId) {
      const box = computePathsBoundingBox([path]);
      if (!box) continue;
      include(box.minX, box.minY);
      include(box.maxX, box.maxY);
      continue;
    }

    for (const polygon of visibleClippingGeometry(path, byId)) {
      for (const ring of polygon) {
        for (const [x, y] of ring) include(x, y);
      }
    }
  }

  if (!hasPoints) return null;
  const width = Math.max(2, maxX - minX);
  const height = Math.max(2, maxY - minY);
  return {
    minX,
    minY,
    maxX,
    maxY,
    width,
    height,
    centerX: minX + width / 2,
    centerY: minY + height / 2,
  };
}

/**
 * Executes a Boolean operation on selected paths (Illustrator Pathfinder core).
 * Clipped inputs use their visible region; the result is a new unclipped object.
 */
export function executeBooleanOperation(
  paths: VectorPath[],
  operation: BooleanOperation,
  allPaths: VectorPath[] = paths
): VectorPath[] {
  if (paths.length < 2) return paths;

  const byId = new Map(allPaths.map((path) => [path.id, path]));
  const polys = paths
    .map((path) => visibleClippingGeometry(path, byId))
    .filter((geometry) => geometry.length > 0);
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
        let currentResult: MultiPolygon = polys[0];
        for (let i = 1; i < polys.length; i++) {
          currentResult = polygonClipping.difference(currentResult, polys[i]);
        }
        return multiPolygonToVectorPaths(currentResult, {
          ...baseStyle,
          name: 'Subtracted Shape',
        });
      }

      case 'intersect': {
        let currentResult: MultiPolygon = polys[0];
        for (let i = 1; i < polys.length; i++) {
          currentResult = polygonClipping.intersection(currentResult, polys[i]);
        }
        return multiPolygonToVectorPaths(currentResult, {
          ...baseStyle,
          name: 'Intersected Shape',
        });
      }

      case 'exclude': {
        let currentResult: MultiPolygon = polys[0];
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

