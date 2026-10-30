import { AnchorPoint, Point, VectorPath } from '../types/vector';
import { sampleCubicBezier } from './bezier';

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
    includeContour(path.points, path.closed);
    if (path.holes) {
      for (const hole of path.holes) includeContour(hole, true);
    }

    if (path.text) {
      const originX = path.points[0]?.x ?? 0;
      const originY = path.points[0]?.y ?? 0;
      const size = path.fontSize || 48;
      const estWidth = Math.max(size, path.text.length * size * 0.62);
      const textMinX = originX;
      const textMaxX = originX + estWidth;
      const textMinY = originY - size * 0.9;
      const textMaxY = originY + size * 0.2;
      hasPoints = true;
      if (textMinX < minX) minX = textMinX;
      if (textMaxX > maxX) maxX = textMaxX;
      if (textMinY < minY) minY = textMinY;
      if (textMaxY > maxY) maxY = textMaxY;
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

  return paths.map((path) => {
    const newFontSize = path.fontSize ? Math.max(10, Math.round(path.fontSize * Math.abs((scaleX + scaleY) / 2))) : undefined;

    return {
      ...path,
      points: path.points.map(scalePoint),
      ...(path.holes ? { holes: path.holes.map((hole) => hole.map(scalePoint)) } : {}),
      fontSize: newFontSize,
    };
  });
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
  }));
}
