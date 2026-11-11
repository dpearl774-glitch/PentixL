import type { Point } from '../types/vector';
import type { AnchorPoint, CompoundVectorPath, VectorSubpath } from '../types/compoundPath';
import { fitBezierPath } from './curveFit';

/* ------------------------------------------------------------------------ *
 * Low-node fitting
 *
 * Two passes, in this order, because each one makes the next cheaper and more
 * accurate: Ramer–Douglas–Peucker throws away samples that say nothing new,
 * then the corner runs are fitted with Schneider's cubics. Fitting first and
 * simplifying afterwards is what leaves traced logos with a node on every
 * pixel stair-step and a corner that has been rounded into a bulge.
 * ------------------------------------------------------------------------ */

/** A turn sharper than this is a real corner and its node never gets rounded. */
export const CORNER_ANGLE_DEGREES = 35;

const ROUND = (value: number) => Math.round(value * 1000) / 1000;

function dedupe(points: Point[], closed: boolean): Point[] {
  const out: Point[] = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(last.x - point.x, last.y - point.y) > 1e-6) {
      out.push({ x: point.x, y: point.y });
    }
  }
  if (closed && out.length > 2) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) <= 1e-6) out.pop();
  }
  return out;
}

/** Perpendicular distance from a point to the segment ab. */
function segmentDistance(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared < 1e-12) return Math.hypot(point.x - a.x, point.y - a.y);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return Math.hypot(point.x - (a.x + dx * t), point.y - (a.y + dy * t));
}

/** Ramer–Douglas–Peucker over one run; the run's own ends are always kept. */
function reduceRun(points: Point[], tolerance: number): Point[] {
  if (points.length < 3) return points.slice();
  let worst = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const distance = segmentDistance(points[i], points[0], points[points.length - 1]);
    if (distance > worst) {
      worst = distance;
      index = i;
    }
  }
  if (worst <= tolerance) return [points[0], points[points.length - 1]];
  const left = reduceRun(points.slice(0, index + 1), tolerance);
  const right = reduceRun(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

/** Turn angle at each sample, measured over one neighbour on each side. */
function cornerFlags(points: Point[], threshold: number, closed: boolean): boolean[] {
  const n = points.length;
  const flags = new Array<boolean>(n).fill(false);
  if (!closed) {
    flags[0] = true;
    flags[n - 1] = true;
  }
  for (let i = closed ? 0 : 1; i < (closed ? n : n - 1); i++) {
    const before = points[(i - 1 + n) % n];
    const after = points[(i + 1) % n];
    const ax = points[i].x - before.x;
    const ay = points[i].y - before.y;
    const bx = after.x - points[i].x;
    const by = after.y - points[i].y;
    const aLength = Math.hypot(ax, ay);
    const bLength = Math.hypot(bx, by);
    if (aLength < 1e-9 || bLength < 1e-9) continue;
    const cosine = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (aLength * bLength)));
    if (Math.acos(cosine) > threshold) flags[i] = true;
  }
  return flags;
}

/**
 * Strips redundant samples without ever crossing a locked corner: each run
 * between two corners is reduced on its own, so a sharp edge keeps its vertex
 * even when the points either side of it are collinear.
 */
function reduceWithCorners(points: Point[], flags: boolean[], tolerance: number, closed: boolean): Point[] {
  const n = points.length;
  const borders: number[] = [];
  for (let i = 0; i < n; i++) if (flags[i]) borders.push(i);
  if (!closed) {
    if (borders[0] !== 0) borders.unshift(0);
    if (borders[borders.length - 1] !== n - 1) borders.push(n - 1);
  } else if (!borders.length) {
    borders.push(0);
  }

  const out: Point[] = [];
  const push = (point: Point) => {
    const last = out[out.length - 1];
    if (last && Math.hypot(last.x - point.x, last.y - point.y) <= 1e-6) return;
    out.push({ x: point.x, y: point.y });
  };

  for (let i = 0; i < borders.length; i++) {
    const start = borders[i];
    const end = closed ? borders[(i + 1) % borders.length] : borders[i + 1];
    if (end === undefined) continue;

    const run: Point[] = [];
    let index = start;
    for (let guard = 0; guard <= n; guard++) {
      run.push(points[index]);
      if (index === end) break;
      index = (index + 1) % n;
    }
    if (run.length < 2) continue;
    for (const point of reduceRun(run, tolerance)) push(point);
  }

  if (!out.length) return points.slice();
  const first = out[0];
  const last = out[out.length - 1];
  if (closed && out.length > 2 && Math.hypot(first.x - last.x, first.y - last.y) <= 1e-6) out.pop();
  return out;
}

function toSubpath(anchors: { id: string; x: number; y: number; type: string; handleIn?: Point; handleOut?: Point }[], id: string, closed: boolean): VectorSubpath {
  const points: AnchorPoint[] = anchors.map((anchor, index) => {
    const handle = (point?: Point) =>
      point
        ? { dx: ROUND(point.x - anchor.x), dy: ROUND(point.y - anchor.y) }
        : { dx: 0, dy: 0 };
    return {
      id: anchor.id || `${id}-${index}`,
      x: ROUND(anchor.x),
      y: ROUND(anchor.y),
      handleIn: handle(anchor.handleIn),
      handleOut: handle(anchor.handleOut),
      type: anchor.type === 'corner' ? 'corner' : 'smooth',
    } as AnchorPoint;
  });

  return { id, points, closed };
}

/**
 * The low-node pipeline for freehand and imported art: RDP, then corner-locked
 * Schneider fitting. Sharp vertices stay corner nodes with independent
 * handles, so a traced square stays a square and its four nodes stay four.
 */
export function simplifyAndFitCurves(
  rawPoints: Point[],
  tolerance: number,
  options: { closed?: boolean; cornerAngle?: number; idPrefix?: string } = {}
): CompoundVectorPath {
  const closed = options.closed ?? true;
  const limit = Math.max(0.01, tolerance);
  const threshold = ((options.cornerAngle ?? CORNER_ANGLE_DEGREES) * Math.PI) / 180;
  const id = options.idPrefix ?? `simplified-${Math.random().toString(36).slice(2, 8)}`;

  const clean = dedupe(rawPoints, closed);
  if (!clean.length) return { id, fillRule: 'nonzero', subpaths: [] };

  if (clean.length < 3) {
    return {
      id,
      fillRule: 'nonzero',
      subpaths: [toSubpath(clean.map((point, index) => ({ id: `${id}-${index}`, ...point, type: 'corner' })), `${id}-0`, false)],
    };
  }

  const reduced = reduceWithCorners(clean, cornerFlags(clean, threshold, closed), limit, closed);
  // Schneider's fit does the rest: it subdivides only at its worst sample, so
  // the node count lands where the tolerance says it should and nowhere denser.
  const fitted = fitBezierPath(reduced, {
    idPrefix: id,
    closed,
    tolerance: limit,
    cornerAngle: threshold,
  });

  return {
    id,
    fillRule: 'nonzero',
    subpaths: [toSubpath(fitted, `${id}-0`, closed)],
  };
}
