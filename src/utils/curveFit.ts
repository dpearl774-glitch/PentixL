import { AnchorPoint, Point } from '../types/vector';

/* ------------------------------------------------------------------------ *
 * Corner-aware cubic fitting
 *
 * The old "smooth" pass put an anchor on every vertex it was handed, so traced
 * and boolean output stayed as dense as the raster it came from. This module
 * does what a pen tool does instead: it finds the real corners, fits the runs
 * between them with least-squares cubics, and places an anchor only where a
 * curve starts, ends or bends sharply. Fewer, better-placed nodes — same shape.
 *
 * The curve fit is Philip J. Schneider's algorithm (Graphics Gems, 1990):
 * chord-length parameterise, solve for the two control lengths, measure the
 * worst sample, split there and recurse until the fit is inside tolerance.
 * ------------------------------------------------------------------------ */

const EPS = 1e-9;
const MAX_DEPTH = 24;

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const scale = (v: Point, k: number): Point => ({ x: v.x * k, y: v.y * k });
const dot = (a: Point, b: Point): number => a.x * b.x + a.y * b.y;
const len = (v: Point): number => Math.hypot(v.x, v.y);
const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
const negate = (v: Point): Point => ({ x: -v.x, y: -v.y });

const unit = (v: Point): Point => {
  const l = len(v);
  return l < EPS ? { x: 0, y: 0 } : { x: v.x / l, y: v.y / l };
};

const bezierPoint = (p0: Point, c1: Point, c2: Point, p1: Point, t: number): Point => {
  const mt = 1 - t;
  const b0 = mt * mt * mt;
  const b1 = 3 * t * mt * mt;
  const b2 = 3 * t * t * mt;
  const b3 = t * t * t;
  return {
    x: p0.x * b0 + c1.x * b1 + c2.x * b2 + p1.x * b3,
    y: p0.y * b0 + c1.y * b1 + c2.y * b2 + p1.y * b3,
  };
};

const bernstein = (t: number): [number, number, number, number] => {
  const mt = 1 - t;
  return [mt * mt * mt, 3 * t * mt * mt, 3 * t * t * mt, t * t * t];
};

interface FittedSegment {
  /** Index of the segment's first point inside the run */
  start: number;
  /** Index of the segment's last point inside the run */
  end: number;
  c1?: Point;
  c2?: Point;
}

const dedupe = (points: Point[], closed: boolean): Point[] => {
  const out: Point[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (!last || dist(last, p) > 1e-6) out.push({ x: p.x, y: p.y });
  }
  if (closed && out.length > 2 && dist(out[0], out[out.length - 1]) < 1e-6) out.pop();
  return out;
};

const boundingDiagonal = (pts: Point[]): number => {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return Math.hypot(maxX - minX, maxY - minY);
};

const parameterize = (pts: Point[]): number[] => {
  const u: number[] = [0];
  for (let i = 1; i < pts.length; i++) {
    u.push(u[i - 1] + dist(pts[i], pts[i - 1]));
  }
  const total = u[u.length - 1];
  if (total < EPS) return pts.map((_, i) => i / Math.max(1, pts.length - 1));
  return u.map((value) => value / total);
};

const polylineLength = (pts: Point[]): number => {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i], pts[i - 1]);
  return total;
};

/**
 * Least-squares control lengths for a fixed start/end and fixed tangents.
 * `t1` points into the run, `t2` points back into the run from its end.
 */
const generateBezier = (pts: Point[], u: number[], t1: Point, t2: Point): { c1: Point; c2: Point } => {
  const first = pts[0];
  const last = pts[pts.length - 1];

  let c00 = 0;
  let c01 = 0;
  let c11 = 0;
  let x0 = 0;
  let x1 = 0;

  for (let i = 0; i < pts.length; i++) {
    const [b0, b1, b2, b3] = bernstein(u[i]);
    const a1 = scale(t1, b1);
    const a2 = scale(t2, b2);
    c00 += dot(a1, a1);
    c01 += dot(a1, a2);
    c11 += dot(a2, a2);

    const target: Point = {
      x: pts[i].x - (first.x * (b0 + b1) + last.x * (b2 + b3)),
      y: pts[i].y - (first.y * (b0 + b1) + last.y * (b2 + b3)),
    };
    x0 += dot(a1, target);
    x1 += dot(a2, target);
  }

  const det = c00 * c11 - c01 * c01;
  let alphaL = 0;
  let alphaR = 0;

  if (Math.abs(det) > 1e-12) {
    alphaL = (c11 * x0 - c01 * x1) / det;
    alphaR = (c00 * x1 - c01 * x0) / det;
  }

  const chord = dist(first, last);
  const minimum = 1e-6 * Math.max(chord, 1);
  if (!(alphaL > minimum) || !(alphaR > minimum)) {
    // Ill-conditioned solve (closed loop or near-collinear samples): fall back
    // to a length proportional to the run so the fit still has curves to use.
    const fallback = chord > EPS ? chord / 3 : Math.max(polylineLength(pts) / 6, EPS);
    alphaL = fallback;
    alphaR = fallback;
  }

  return { c1: add(first, scale(t1, alphaL)), c2: add(last, scale(t2, alphaR)) };
};

const worstSample = (
  pts: Point[],
  u: number[],
  c1: Point,
  c2: Point
): { error: number; split: number } => {
  let error = 0;
  let split = Math.max(1, Math.floor(pts.length / 2));
  const last = pts[pts.length - 1];
  for (let i = 1; i < pts.length - 1; i++) {
    const p = bezierPoint(pts[0], c1, c2, last, u[i]);
    const d = dist(p, pts[i]);
    if (d >= error) {
      error = d;
      split = i;
    }
  }
  return { error, split };
};

const fitCubic = (
  pts: Point[],
  first: number,
  last: number,
  t1: Point,
  t2: Point,
  tolerance: number,
  depth: number,
  out: FittedSegment[]
): void => {
  if (last - first === 1) {
    const d = dist(pts[first], pts[last]) / 3;
    out.push({
      start: first,
      end: last,
      c1: add(pts[first], scale(t1, d)),
      c2: add(pts[last], scale(t2, d)),
    });
    return;
  }

  const slice = pts.slice(first, last + 1);
  const u = parameterize(slice);
  const { c1, c2 } = generateBezier(slice, u, t1, t2);
  const { error, split } = worstSample(slice, u, c1, c2);

  if (error <= tolerance || depth >= MAX_DEPTH) {
    out.push({ start: first, end: last, c1, c2 });
    return;
  }

  const center = first + Math.min(Math.max(split, 1), slice.length - 2);
  const centerTangent = unit(sub(pts[center - 1], pts[center + 1]));

  if (len(centerTangent) < 0.5) {
    // A cusp inside the run: nothing sensible to split on, keep the fit
    out.push({ start: first, end: last, c1, c2 });
    return;
  }

  fitCubic(pts, first, center, t1, centerTangent, tolerance, depth + 1, out);
  fitCubic(pts, center, last, negate(centerTangent), t2, tolerance, depth + 1, out);
};

const startTangent = (pts: Point[]): Point => {
  for (let i = 1; i < pts.length; i++) {
    const dir = unit(sub(pts[i], pts[0]));
    if (len(dir) > 0.5) return dir;
  }
  return { x: 1, y: 0 };
};

const endTangent = (pts: Point[]): Point => {
  const last = pts.length - 1;
  for (let i = last - 1; i >= 0; i--) {
    const dir = unit(sub(pts[i], pts[last]));
    if (len(dir) > 0.5) return dir;
  }
  return { x: -1, y: 0 };
};

/** Largest distance of the run's interior points from its own chord. */
const chordDeviation = (pts: Point[]): number => {
  const a = pts[0];
  const b = pts[pts.length - 1];
  const ab = sub(b, a);
  const l = len(ab);
  let worst = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const ap = sub(pts[i], a);
    const t = l < EPS ? 0 : Math.max(0, Math.min(1, dot(ap, ab) / (l * l)));
    worst = Math.max(worst, dist(pts[i], add(a, scale(ab, t))));
  }
  return worst;
};

/** Fits one run of points between two corners, or the whole loop. */
const fitRun = (pts: Point[], tolerance: number): FittedSegment[] => {
  if (pts.length < 3) return [{ start: 0, end: Math.max(0, pts.length - 1) }];
  // A run that never leaves its chord stays a straight segment. Logo edges
  // should not pick up a bulge just because they were traced, and anything
  // inside the tolerance is already as close as the fit is allowed to be.
  if (chordDeviation(pts) <= Math.max(tolerance, 0.02)) {
    return [{ start: 0, end: pts.length - 1 }];
  }
  const segments: FittedSegment[] = [];
  fitCubic(pts, 0, pts.length - 1, startTangent(pts), endTangent(pts), tolerance, 0, segments);
  return segments;
};

/**
 * Real corners. Direction is measured across a short arc rather than between
 * neighbouring vertices: a pixel stair-step or a half-pixel chamfer then reads
 * as the edge it belongs to, while a true corner still turns sharply however
 * finely it was sampled.
 */
const detectCorners = (
  pts: Point[],
  threshold: number,
  closed: boolean,
  windowDistance: number
): boolean[] => {
  const n = pts.length;
  const flags = new Array<boolean>(n).fill(false);
  if (!closed) {
    flags[0] = true;
    flags[n - 1] = true;
  }
  const first = closed ? 0 : 1;
  const last = closed ? n : n - 1;

  for (let i = first; i < last; i++) {
    let back = i;
    let travelled = 0;
    for (let step = 0; step < n - 1; step++) {
      if (!closed && back === 0) break;
      const next = (back - 1 + n) % n;
      travelled += dist(pts[back], pts[next]);
      back = next;
      if (travelled >= windowDistance) break;
    }

    let forward = i;
    travelled = 0;
    for (let step = 0; step < n - 1; step++) {
      if (!closed && forward === n - 1) break;
      const next = (forward + 1) % n;
      travelled += dist(pts[forward], pts[next]);
      forward = next;
      if (travelled >= windowDistance) break;
    }

    if (back === i || forward === i) continue;
    const a = unit(sub(pts[i], pts[back]));
    const b = unit(sub(pts[forward], pts[i]));
    if (len(a) < 0.5 || len(b) < 0.5) continue;
    const turn = Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
    if (turn > threshold) flags[i] = true;
  }
  return flags;
};

/**
 * Collapses corner pairs that sit within a hair of each other. A traced hard
 * corner arrives as a tiny chamfer — two 45° turns half a pixel apart — and
 * keeping both would leave a visible nick where the eye expects one crisp node.
 */
const mergeCorners = (
  pts: Point[],
  flags: boolean[],
  mergeDistance: number,
  closed: boolean
): boolean[] => {
  const n = pts.length;
  const result = flags.slice();

  const sharpness = (i: number): number => {
    const a = unit(sub(pts[i], pts[(i - 1 + n) % n]));
    const b = unit(sub(pts[(i + 1) % n], pts[i]));
    if (len(a) < 0.5 || len(b) < 0.5) return 0;
    return Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
  };

  let merged = true;
  let guard = 0;
  while (merged && guard++ < n) {
    merged = false;
    for (let i = 0; i < n; i++) {
      if (!result[i]) continue;
      let j = i;
      for (let step = 0; step < n; step++) {
        j += 1;
        if (j >= n) {
          if (!closed) break;
          j = 0;
        }
        if (j === i) break;
        if (result[j]) break;
      }
      if (!result[j] || j === i) continue;
      if (!closed && (i === 0 || j === n - 1)) continue;
      if (dist(pts[i], pts[j]) > mergeDistance) continue;
      result[sharpness(i) >= sharpness(j) ? j : i] = false;
      merged = true;
      break;
    }
  }
  return result;
};

/** Makes the two handles of a smooth node collinear without changing their reach. */
const alignHandles = (anchor: AnchorPoint): void => {
  if (!anchor.handleIn || !anchor.handleOut) return;
  const p: Point = { x: anchor.x, y: anchor.y };
  const inDir = unit(sub(p, anchor.handleIn));
  const outDir = unit(sub(anchor.handleOut, p));
  const summed = add(inDir, outDir);
  if (len(summed) < 0.2) return; // a fold, not a smooth join
  const dir = unit(summed);
  const inLen = dist(anchor.handleIn, p);
  const outLen = dist(anchor.handleOut, p);
  anchor.handleIn = sub(p, scale(dir, inLen));
  anchor.handleOut = add(p, scale(dir, outLen));
};

export interface FitBezierOptions {
  idPrefix?: string;
  closed?: boolean;
  /** Maximum allowed deviation from the sampled outline, in artboard units */
  tolerance?: number;
  /** Direction change, in radians, that counts as a corner (default ~57°) */
  cornerAngle?: number;
}

const autoTolerance = (pts: Point[]): number =>
  Math.min(2, Math.max(0.35, boundingDiagonal(pts) * 0.0015));

/**
 * Fits a polyline with as few cubic anchors as the tolerance allows.
 * Corners survive as corner anchors; everything between them becomes smooth
 * nodes with fitted handles, so Direct Selection can still move every node.
 */
export function fitBezierPath(points: Point[], options: FitBezierOptions = {}): AnchorPoint[] {
  const { idPrefix = 'fit', closed = true, cornerAngle = 1.0 } = options;
  const pts = dedupe(points, closed);

  if (pts.length < 2) {
    return pts.map((p, i) => ({ id: `${idPrefix}-${i}`, x: p.x, y: p.y, type: 'corner' as const }));
  }

  const tolerance = Math.max(0.01, options.tolerance ?? autoTolerance(pts));
  const n = pts.length;
  // Both windows scale with the tolerance: finer fits keep finer corners.
  const windowDistance = Math.max(1.5 * tolerance, 0.5);
  const corners = mergeCorners(
    pts,
    detectCorners(pts, cornerAngle, closed, windowDistance),
    windowDistance,
    closed
  );

  const borders: number[] = [];
  for (let i = 0; i < n; i++) if (corners[i]) borders.push(i);
  if (!closed) {
    if (borders[0] !== 0) borders.unshift(0);
    if (borders[borders.length - 1] !== n - 1) borders.push(n - 1);
  } else if (borders.length === 0) {
    borders.push(0);
  }

  const anchors = new Map<number, AnchorPoint>();

  const anchorAt = (index: number, point: Point): AnchorPoint => {
    const existing = anchors.get(index);
    if (existing) return existing;
    const anchor: AnchorPoint = {
      id: `${idPrefix}-${index}`,
      x: point.x,
      y: point.y,
      type: corners[index] ? 'corner' : 'smooth',
    };
    anchors.set(index, anchor);
    return anchor;
  };

  const fitBetween = (globals: number[], local: Point[]): void => {
    const segments = fitRun(local, tolerance);
    for (const segment of segments) {
      // Anchors exist even for a straight segment — a run still needs its two
      // endpoints; it simply gets no handles, which keeps flat edges flat.
      const start = anchorAt(globals[segment.start], local[segment.start]);
      const end = anchorAt(globals[segment.end], local[segment.end]);
      if (!segment.c1 || !segment.c2) continue;
      start.handleOut = segment.c1;
      end.handleIn = segment.c2;
    }
  };

  if (closed && borders.length === 1) {
    // One cusp (or none at all): fit the loop as a single run that returns to
    // its own start, so the seam is a fitted join instead of a stray chord.
    const start = borders[0];
    const local: Point[] = [];
    const globals: number[] = [];
    for (let step = 0; step <= n; step++) {
      const index = (start + step) % n;
      local.push(pts[index]);
      globals.push(index);
    }
    fitBetween(globals, local);
  } else {
    for (let i = 0; i < borders.length; i++) {
      const start = borders[i];
      const end = closed ? borders[(i + 1) % borders.length] : borders[i + 1];
      if (end === undefined) continue;
      if (end === start && !closed) continue;

      const local: Point[] = [];
      const globals: number[] = [];
      let index = start;
      for (let guard = 0; guard <= n; guard++) {
        local.push(pts[index]);
        globals.push(index);
        if (index === end) break;
        index = (index + 1) % n;
      }
      if (local.length < 2) continue;
      fitBetween(globals, local);
    }
  }

  const ordered = [...anchors.entries()].sort((a, b) => a[0] - b[0]);

  for (const [index, anchor] of ordered) {
    // A real corner keeps its corner type even though the fit gave it a handle
    // on each side: the two handles point different ways, which is exactly what
    // a cusp is. Only unflagged nodes become smooth.
    if (corners[index]) {
      anchor.type = 'corner';
      continue;
    }
    anchor.type = anchor.handleIn && anchor.handleOut ? 'smooth' : 'corner';
  }

  const finalAnchors = ordered.map(([, anchor]) => anchor);

  for (const anchor of finalAnchors) {
    if (anchor.type === 'smooth') alignHandles(anchor);
  }

  return finalAnchors;
}
