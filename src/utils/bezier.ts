import { AnchorPoint, Point, VectorPath, PressureConfig } from '../types/vector';

/**
 * Calculates Euclidean distance between two points
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Snap point to grid
 */
export function snapToGrid(p: Point, gridSize: number): Point {
  if (gridSize <= 0) return p;
  return {
    x: Math.round(p.x / gridSize) * gridSize,
    y: Math.round(p.y / gridSize) * gridSize,
  };
}

/**
 * Snap angle to nearest 45-degree increment from an origin point
 */
export function snapAngle(origin: Point, target: Point): Point {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist === 0) return target;

  const angle = Math.atan2(dy, dx);
  const snapStep = Math.PI / 4; // 45 degrees
  const snappedAngle = Math.round(angle / snapStep) * snapStep;

  return {
    x: origin.x + dist * Math.cos(snappedAngle),
    y: origin.y + dist * Math.sin(snappedAngle),
  };
}

/**
 * Builds SVG path data `d` string from AnchorPoint array
 */
export function pointsToSvgPath(points: AnchorPoint[], closed = false): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
  }

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];

    const cp1 = prev.handleOut || { x: prev.x, y: prev.y };
    const cp2 = curr.handleIn || { x: curr.x, y: curr.y };

    const hasCurve = prev.handleOut || curr.handleIn;

    if (hasCurve) {
      d += ` C ${cp1.x.toFixed(2)} ${cp1.y.toFixed(2)}, ${cp2.x.toFixed(2)} ${cp2.y.toFixed(2)}, ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
    } else {
      d += ` L ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
    }
  }

  if (closed && points.length > 2) {
    const last = points[points.length - 1];
    const first = points[0];
    const cp1 = last.handleOut || { x: last.x, y: last.y };
    const cp2 = first.handleIn || { x: first.x, y: first.y };

    if (last.handleOut || first.handleIn) {
      d += ` C ${cp1.x.toFixed(2)} ${cp1.y.toFixed(2)}, ${cp2.x.toFixed(2)} ${cp2.y.toFixed(2)}, ${first.x.toFixed(2)} ${first.y.toFixed(2)} Z`;
    } else {
      d += ' Z';
    }
  }

  return d;
}

/**
 * Creates symmetric handles when dragging an anchor point in the Pen tool
 */
export function createSymmetricHandles(anchor: Point, dragPoint: Point): { handleIn: Point; handleOut: Point } {
  const dx = dragPoint.x - anchor.x;
  const dy = dragPoint.y - anchor.y;

  return {
    handleOut: { x: anchor.x + dx, y: anchor.y + dy },
    handleIn: { x: anchor.x - dx, y: anchor.y - dy },
  };
}

/**
 * Converts anchor point between Corner and Smooth
 */
export function toggleAnchorType(anchor: AnchorPoint): AnchorPoint {
  if (anchor.type === 'corner') {
    // Convert to smooth: give default handles if none exist
    const offset = 25;
    return {
      ...anchor,
      type: 'smooth',
      handleIn: { x: anchor.x - offset, y: anchor.y },
      handleOut: { x: anchor.x + offset, y: anchor.y },
    };
  } else {
    // Convert to sharp corner: remove handles
    return {
      ...anchor,
      type: 'corner',
      handleIn: undefined,
      handleOut: undefined,
    };
  }
}

/**
 * Samples a cubic bezier segment into discrete points for boolean and hit-testing
 */
export function sampleCubicBezier(p0: Point, cp1: Point, cp2: Point, p1: Point, steps = 16): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    const x = mt3 * p0.x + 3 * mt2 * t * cp1.x + 3 * mt * t2 * cp2.x + t3 * p1.x;
    const y = mt3 * p0.y + 3 * mt2 * t * cp1.y + 3 * mt * t2 * cp2.y + t3 * p1.y;
    pts.push({ x, y });
  }
  return pts;
}

/**
 * Converts an entire VectorPath into a sampled polygon for ShapeBuilder boolean geometry
 */
export function pathToPolygon(path: VectorPath, stepsPerCurve = 16): [number, number][] {
  const points = path.points;
  if (points.length < 2) return [];

  const poly: [number, number][] = [];

  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const next = points[(i + 1) % points.length];

    if (i === points.length - 1 && !path.closed) {
      poly.push([curr.x, curr.y]);
      break;
    }

    const cp1 = curr.handleOut || { x: curr.x, y: curr.y };
    const cp2 = next.handleIn || { x: next.x, y: next.y };

    if (curr.handleOut || next.handleIn) {
      const sampled = sampleCubicBezier(curr, cp1, cp2, next, stepsPerCurve);
      // Skip the last point of sampled to avoid duplicate with next segment start
      for (let s = 0; s < sampled.length - 1; s++) {
        poly.push([sampled[s].x, sampled[s].y]);
      }
    } else {
      poly.push([curr.x, curr.y]);
    }
  }

  return poly;
}

/**
 * Generates an outline ribbon polygon for pressure-sensitive or touch-velocity strokes
 */
export function generateVariableStrokePolygon(
  points: AnchorPoint[],
  config: PressureConfig
): string {
  if (points.length < 2) return '';

  const leftSide: Point[] = [];
  const rightSide: Point[] = [];

  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];

    // Direction vector
    let dx = next.x - prev.x;
    let dy = next.y - prev.y;
    let len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) {
      dx = 1;
      dy = 0;
      len = 1;
    }

    // Normal vector perpendicular to path
    const nx = -dy / len;
    const ny = dx / len;

    // Calculate width based on pressure
    const pressure = curr.pressure !== undefined ? curr.pressure : 0.5;
    let width = config.minWidth + (config.maxWidth - config.minWidth) * pressure;

    // Calligraphy angle modulation if applicable
    if (config.calligraphyAngle !== 0) {
      const rad = (config.calligraphyAngle * Math.PI) / 180;
      const penX = Math.cos(rad);
      const penY = Math.sin(rad);
      const dot = Math.abs(dx * penX + dy * penY) / len;
      width = width * (0.3 + 0.7 * (1 - dot));
    }

    const halfW = Math.max(1, width / 2);

    leftSide.push({
      x: curr.x + nx * halfW,
      y: curr.y + ny * halfW,
    });
    rightSide.unshift({
      x: curr.x - nx * halfW,
      y: curr.y - ny * halfW,
    });
  }

  const ribbon = [...leftSide, ...rightSide];
  if (ribbon.length === 0) return '';

  let d = `M ${ribbon[0].x.toFixed(2)} ${ribbon[0].y.toFixed(2)}`;
  for (let i = 1; i < ribbon.length; i++) {
    d += ` L ${ribbon[i].x.toFixed(2)} ${ribbon[i].y.toFixed(2)}`;
  }
  d += ' Z';
  return d;
}

/**
 * Mathematically rounds sharp corners of a VectorPath by a specified radius using cubic bezier curves.
 * If radius is 0, converts smooth points back to sharp corners.
 */
export function roundPathCorners(path: VectorPath, radius: number): VectorPath {
  const points = path.points;
  if (points.length < 3) return path;

  const K_CIRCLE = 0.5522847498;
  const newPoints: AnchorPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    // For open paths, keep endpoints unmodified
    if (!path.closed && (i === 0 || i === points.length - 1)) {
      newPoints.push({ ...curr });
      continue;
    }

    const prev = points[(i - 1 + points.length) % points.length];
    const next = points[(i + 1) % points.length];

    // If radius is 0, reset to sharp corner
    if (radius <= 0) {
      newPoints.push({
        ...curr,
        type: 'corner',
        handleIn: undefined,
        handleOut: undefined,
      });
      continue;
    }

    // Vectors to prev and next
    const vPrev = { x: prev.x - curr.x, y: prev.y - curr.y };
    const vNext = { x: next.x - curr.x, y: next.y - curr.y };

    const lenPrev = Math.sqrt(vPrev.x * vPrev.x + vPrev.y * vPrev.y);
    const lenNext = Math.sqrt(vNext.x * vNext.x + vNext.y * vNext.y);

    if (lenPrev === 0 || lenNext === 0) {
      newPoints.push({ ...curr });
      continue;
    }

    // Max allowable offset along the edge (at most 45% of edge length)
    const d = Math.min(radius, lenPrev * 0.45, lenNext * 0.45);
    if (d < 1) {
      newPoints.push({ ...curr });
      continue;
    }

    const uPrev = { x: vPrev.x / lenPrev, y: vPrev.y / lenPrev };
    const uNext = { x: vNext.x / lenNext, y: vNext.y / lenNext };

    // Point on incoming edge entering curve
    const pEnter: Point = {
      x: curr.x + uPrev.x * d,
      y: curr.y + uPrev.y * d,
    };

    // Point on outgoing edge leaving curve
    const pLeave: Point = {
      x: curr.x + uNext.x * d,
      y: curr.y + uNext.y * d,
    };

    // Handles towards corner vertex
    const k = d * K_CIRCLE;
    const handleOut: Point = {
      x: pEnter.x - uPrev.x * (d - k),
      y: pEnter.y - uPrev.y * (d - k),
    };
    const handleIn: Point = {
      x: pLeave.x - uNext.x * (d - k),
      y: pLeave.y - uNext.y * (d - k),
    };

    newPoints.push({
      id: `${curr.id}-c1`,
      x: pEnter.x,
      y: pEnter.y,
      type: 'smooth',
      handleIn: curr.handleIn,
      handleOut,
    });

    newPoints.push({
      id: `${curr.id}-c2`,
      x: pLeave.x,
      y: pLeave.y,
      type: 'smooth',
      handleIn,
      handleOut: curr.handleOut,
    });
  }

  return {
    ...path,
    points: newPoints,
  };
}
