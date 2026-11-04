import { AnchorPoint, Point, VectorPath } from '../types/vector';
import { sampleCubicBezier } from './bezier';
import {
  flipTextMatrix,
  rotateTextMatrix,
  scaleTextMatrix,
  textWorldBox,
} from './textGeometry';

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
}

export type HandleType = 'tl' | 'tr' | 'bl' | 'br' | 'tc' | 'bc' | 'ml' | 'mr' | 'rot';

/** Keep the sharp geometry behind a rounded corner moving with the path. */
function transformCornerSource(
  path: VectorPath,
  map: (point: AnchorPoint) => AnchorPoint
): Pick<VectorPath, 'cornerSource'> {
  if (!path.cornerSource) return {};
  return {
    cornerSource: {
      points: path.cornerSource.points.map(map),
      ...(path.cornerSource.holes
        ? { holes: path.cornerSource.holes.map((hole) => hole.map(map)) }
        : {}),
    },
  };
}

/**
 * Computes tight bounding box for an array of VectorPaths
 */
export function computePathsBoundingBox(paths: VectorPath[]): BoundingBox | null {
  if (!paths || paths.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  let hasPoints = false;

  const include = (p: Point) => {
    hasPoints = true;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  };

  // Bounds come from the curves themselves. Control handles sit off the
  // outline, so counting them made the transform box much larger than the art.
  const includeContour = (points: AnchorPoint[], closed: boolean) => {
    if (points.length === 0) return;
    if (points.length === 1) {
      include(points[0]);
      return;
    }
    const segments = closed ? points.length : points.length - 1;
    for (let i = 0; i < segments; i++) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      const samples = sampleCubicBezier(
        a,
        a.handleOut || a,
        b.handleIn || b,
        b,
        16
      );
      for (const s of samples) include(s);
    }
  };

  for (const path of paths) {
    // Live text is a box, not its single baseline anchor. Measure the glyphs
    // and run the label's affine transform so the transform box tracks what is
    // actually drawn through scale, rotation and flips.
    if (path.text) {
      const box = textWorldBox(path);
      if (box) {
        hasPoints = true;
        if (box.minX < minX) minX = box.minX;
        if (box.maxX > maxX) maxX = box.maxX;
        if (box.minY < minY) minY = box.minY;
        if (box.maxY > maxY) maxY = box.maxY;
      }
      continue;
    }

    includeContour(path.points, path.closed);
    if (path.holes) {
      for (const hole of path.holes) includeContour(hole, true);
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
 * Moves paths by a delta. Counters travel with their outline — without this a
 * traced logo's letter bowls stay behind when the group is dragged.
 */
export function translatePaths(paths: VectorPath[], dx: number, dy: number): VectorPath[] {
  const shift = (pt: AnchorPoint): AnchorPoint => ({
    ...pt,
    x: pt.x + dx,
    y: pt.y + dy,
    handleIn: pt.handleIn ? { x: pt.handleIn.x + dx, y: pt.handleIn.y + dy } : undefined,
    handleOut: pt.handleOut ? { x: pt.handleOut.x + dx, y: pt.handleOut.y + dy } : undefined,
  });

  return paths.map((path) => ({
    ...path,
    points: path.points.map(shift),
    ...(path.holes ? { holes: path.holes.map((hole) => hole.map(shift)) } : {}),
    ...transformCornerSource(path, shift),
  }));
}

/**
 * Scales an array of paths relative to a fixed origin point
 */
export function scalePaths(
  paths: VectorPath[],
  origin: Point,
  scaleX: number,
  scaleY: number
): VectorPath[] {
  const scalePoint = (pt: AnchorPoint): AnchorPoint => ({
    ...pt,
    x: origin.x + (pt.x - origin.x) * scaleX,
    y: origin.y + (pt.y - origin.y) * scaleY,
    handleIn: pt.handleIn
      ? {
          x: origin.x + (pt.handleIn.x - origin.x) * scaleX,
          y: origin.y + (pt.handleIn.y - origin.y) * scaleY,
        }
      : undefined,
    handleOut: pt.handleOut
      ? {
          x: origin.x + (pt.handleOut.x - origin.x) * scaleX,
          y: origin.y + (pt.handleOut.y - origin.y) * scaleY,
        }
      : undefined,
  });

  const radiusScale = Math.min(Math.abs(scaleX), Math.abs(scaleY));
  return paths.map((path) => ({
    ...path,
    points: path.points.map(scalePoint),
    ...(path.holes ? { holes: path.holes.map((hole) => hole.map(scalePoint)) } : {}),
    ...transformCornerSource(path, scalePoint),
    ...(path.cornerRadius !== undefined
      ? { cornerRadius: path.cornerRadius * radiusScale }
      : {}),
    ...(path.cornerRadii
      ? {
          cornerRadii: Object.fromEntries(
            Object.entries(path.cornerRadii).map(([id, value]) => [
              id,
              value * radiusScale,
            ])
          ),
        }
      : {}),
    ...(path.extrudeDepth !== undefined
      ? { extrudeDepth: path.extrudeDepth * radiusScale }
      : {}),
    // Text keeps its base font size and stores the handle scale here. Baking
    // the average scale into fontSize made side handles change both axes, so
    // the glyphs never followed the finger.
    ...(path.text
      ? { textMatrix: scaleTextMatrix(path.textMatrix, scaleX, scaleY) }
      : {}),
  }));
}

/**
 * Rotates an array of paths around a center point
 */
export function rotatePaths(
  paths: VectorPath[],
  center: Point,
  angleRad: number
): VectorPath[] {
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  const rotatePoint = (p: Point): Point => {
    const dx = p.x - center.x;
    const dy = p.y - center.y;
    return {
      x: center.x + dx * cos - dy * sin,
      y: center.y + dx * sin + dy * cos,
    };
  };

  const rotateAnchor = (pt: AnchorPoint): AnchorPoint => ({
    ...pt,
    ...rotatePoint(pt),
    handleIn: pt.handleIn ? rotatePoint(pt.handleIn) : undefined,
    handleOut: pt.handleOut ? rotatePoint(pt.handleOut) : undefined,
  });

  return paths.map((path) => ({
    ...path,
    points: path.points.map(rotateAnchor),
    ...(path.holes ? { holes: path.holes.map((hole) => hole.map(rotateAnchor)) } : {}),
    ...transformCornerSource(path, rotateAnchor),
    ...(path.text
      ? { textMatrix: rotateTextMatrix(path.textMatrix, angleRad) }
      : {}),
  }));
}

/**
 * Flips paths horizontally or vertically across center
 */
export function flipPaths(
  paths: VectorPath[],
  center: Point,
  direction: 'horizontal' | 'vertical'
): VectorPath[] {
  const flipPoint = (pt: AnchorPoint): AnchorPoint => ({
    ...pt,
    x: direction === 'horizontal' ? center.x - (pt.x - center.x) : pt.x,
    y: direction === 'vertical' ? center.y - (pt.y - center.y) : pt.y,
    handleIn: pt.handleIn
      ? {
          x: direction === 'horizontal' ? center.x - (pt.handleIn.x - center.x) : pt.handleIn.x,
          y: direction === 'vertical' ? center.y - (pt.handleIn.y - center.y) : pt.handleIn.y,
        }
      : undefined,
    handleOut: pt.handleOut
      ? {
          x: direction === 'horizontal' ? center.x - (pt.handleOut.x - center.x) : pt.handleOut.x,
          y: direction === 'vertical' ? center.y - (pt.handleOut.y - center.y) : pt.handleOut.y,
        }
      : undefined,
  });

  return paths.map((path) => ({
    ...path,
    points: path.points.map(flipPoint),
    ...(path.holes ? { holes: path.holes.map((hole) => hole.map(flipPoint)) } : {}),
    ...transformCornerSource(path, flipPoint),
    ...(path.text
      ? { textMatrix: flipTextMatrix(path.textMatrix, direction) }
      : {}),
  }));
}

/**
 * Fresh copies for duplicate/paste: every path, anchor and hole point gets a
 * new id, and both the outline and its counters move by the same offset.
 * Reusing point ids made the copy and original select and edit together; only
 * moving the outline left letter bowls behind.
 */
export function copyPathsWithNewIds(
  paths: VectorPath[],
  dx: number,
  dy: number,
  idPrefix: string
): VectorPath[] {
  const shift = (pt: AnchorPoint, id: string): AnchorPoint => ({
    ...pt,
    id,
    x: pt.x + dx,
    y: pt.y + dy,
    handleIn: pt.handleIn ? { x: pt.handleIn.x + dx, y: pt.handleIn.y + dy } : undefined,
    handleOut: pt.handleOut ? { x: pt.handleOut.x + dx, y: pt.handleOut.y + dy } : undefined,
  });

  const nextIds = new Map(paths.map((path, pathIndex) => [path.id, `${idPrefix}-${pathIndex}`]));
  const referencedIds = new Set(
    paths.map((path) => path.clipPathId).filter((id): id is string => !!id)
  );

  return paths.map((path, pathIndex) => {
    const id = nextIds.get(path.id)!;
    const clipPathId = path.clipPathId
      ? nextIds.get(path.clipPathId) ?? path.clipPathId
      : undefined;
    // A mask source copied without any of its children becomes a normal copy;
    // otherwise it would be an invisible object in the layers panel.
    const keepMask = path.isClippingMask === true && referencedIds.has(path.id);
    return {
      ...path,
      id,
      name: `${path.name} copy`,
      ...(clipPathId ? { clipPathId } : { clipPathId: undefined }),
      ...(path.isClippingMask ? { isClippingMask: keepMask } : {}),
      points: path.points.map((pt, pointIndex) => shift(pt, `${id}-pt-${pointIndex}`)),
      ...(path.holes
        ? {
            holes: path.holes.map((hole, holeIndex) =>
              hole.map((pt, pointIndex) => shift(pt, `${id}-h${holeIndex}-${pointIndex}`))
            ),
          }
        : {}),
      ...transformCornerSource(path, (pt) => shift(pt, pt.id)),
    };
  });
}
