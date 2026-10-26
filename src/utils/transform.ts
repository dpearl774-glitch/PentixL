import { AnchorPoint, Point, VectorPath } from '../types/vector';

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

  for (const path of paths) {
    for (const pt of path.points) {
      hasPoints = true;
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;

      if (pt.handleIn) {
        if (pt.handleIn.x < minX) minX = pt.handleIn.x;
        if (pt.handleIn.x > maxX) maxX = pt.handleIn.x;
        if (pt.handleIn.y < minY) minY = pt.handleIn.y;
        if (pt.handleIn.y > maxY) maxY = pt.handleIn.y;
      }

      if (pt.handleOut) {
        if (pt.handleOut.x < minX) minX = pt.handleOut.x;
        if (pt.handleOut.x > maxX) maxX = pt.handleOut.x;
        if (pt.handleOut.y < minY) minY = pt.handleOut.y;
        if (pt.handleOut.y > maxY) maxY = pt.handleOut.y;
      }
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
 * Scales an array of paths relative to a fixed origin point
 */
export function scalePaths(
  paths: VectorPath[],
  origin: Point,
  scaleX: number,
  scaleY: number
): VectorPath[] {
  return paths.map((path) => {
    const scaledPoints: AnchorPoint[] = path.points.map((pt) => {
      const newX = origin.x + (pt.x - origin.x) * scaleX;
      const newY = origin.y + (pt.y - origin.y) * scaleY;

      let handleIn: Point | undefined;
      if (pt.handleIn) {
        handleIn = {
          x: origin.x + (pt.handleIn.x - origin.x) * scaleX,
          y: origin.y + (pt.handleIn.y - origin.y) * scaleY,
        };
      }

      let handleOut: Point | undefined;
      if (pt.handleOut) {
        handleOut = {
          x: origin.x + (pt.handleOut.x - origin.x) * scaleX,
          y: origin.y + (pt.handleOut.y - origin.y) * scaleY,
        };
      }

      return {
        ...pt,
        x: newX,
        y: newY,
        handleIn,
        handleOut,
      };
    });

    const newFontSize = path.fontSize ? Math.max(10, Math.round(path.fontSize * Math.abs((scaleX + scaleY) / 2))) : undefined;

    return {
      ...path,
      points: scaledPoints,
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

  return paths.map((path) => {
    const rotatedPoints: AnchorPoint[] = path.points.map((pt) => ({
      ...pt,
      ...rotatePoint(pt),
      handleIn: pt.handleIn ? rotatePoint(pt.handleIn) : undefined,
      handleOut: pt.handleOut ? rotatePoint(pt.handleOut) : undefined,
    }));

    return {
      ...path,
      points: rotatedPoints,
    };
  });
}

/**
 * Flips paths horizontally or vertically across center
 */
export function flipPaths(
  paths: VectorPath[],
  center: Point,
  direction: 'horizontal' | 'vertical'
): VectorPath[] {
  return paths.map((path) => {
    const flippedPoints: AnchorPoint[] = path.points.map((pt) => {
      const newX = direction === 'horizontal' ? center.x - (pt.x - center.x) : pt.x;
      const newY = direction === 'vertical' ? center.y - (pt.y - center.y) : pt.y;

      let handleIn: Point | undefined;
      if (pt.handleIn) {
        handleIn = {
          x: direction === 'horizontal' ? center.x - (pt.handleIn.x - center.x) : pt.handleIn.x,
          y: direction === 'vertical' ? center.y - (pt.handleIn.y - center.y) : pt.handleIn.y,
        };
      }

      let handleOut: Point | undefined;
      if (pt.handleOut) {
        handleOut = {
          x: direction === 'horizontal' ? center.x - (pt.handleOut.x - center.x) : pt.handleOut.x,
          y: direction === 'vertical' ? center.y - (pt.handleOut.y - center.y) : pt.handleOut.y,
        };
      }

      return {
        ...pt,
        x: newX,
        y: newY,
        handleIn,
        handleOut,
      };
    });

    return {
      ...path,
      points: flippedPoints,
    };
  });
}
