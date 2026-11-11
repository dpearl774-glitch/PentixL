import { AnchorPoint, Point, VectorPath, PressureConfig } from '../types/vector';
import {
  decimateContour,
  fitSmoothBezierCurves,
  simplifyPoints,
  simplifyRing,
} from './contourTracer';

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

const cloneAnchor = (point: AnchorPoint): AnchorPoint => ({
  ...point,
  handleIn: point.handleIn ? { ...point.handleIn } : undefined,
  handleOut: point.handleOut ? { ...point.handleOut } : undefined,
});

const cloneContour = (points: AnchorPoint[]): AnchorPoint[] => points.map(cloneAnchor);

/** Removes the rounding metadata while keeping the current rounded outline. */
export function clearCornerRounding(path: VectorPath): VectorPath {
  if (!path.cornerSource && path.cornerRadius === undefined && !path.cornerRadii) {
    return path;
  }
  const next = { ...path };
  delete next.cornerSource;
  delete next.cornerRadius;
  delete next.cornerRadii;
  return next;
}

/**
 * Round only genuine sharp corners on one contour. `t` is the distance from
 * the vertex to each tangent point; it is derived from the requested radius,
 * the corner angle and the available edge length. This is the key difference
 * from the old implementation: a 90° corner gives t = r, a sharp 60° corner
 * needs a longer tangent, and a wide 120° corner needs a shorter one. The
 * previous fixed offset produced visibly wrong arcs on anything but a square,
 * and even the square used the wrong Bezier handle length.
 */
function roundContour(
  points: AnchorPoint[],
  closed: boolean,
  radius: number,
  radii?: Record<string, number>
): { points: AnchorPoint[]; changed: boolean } {
  const count = points.length;
  if (count < 3) {
    return { points: cloneContour(points), changed: false };
  }

  const out: AnchorPoint[] = [];
  let changed = false;

  for (let i = 0; i < count; i++) {
    const curr = points[i];
    if (!closed && (i === 0 || i === count - 1)) {
      out.push(cloneAnchor(curr));
      continue;
    }

    // Smooth or hand-authored curve nodes are not corners. Rounding them was
    // what turned a second radius change into a lumpy, doubled outline.
    if (curr.handleIn || curr.handleOut || (curr.type !== 'corner' && curr.type !== 'broken')) {
      out.push(cloneAnchor(curr));
      continue;
    }

    const prev = points[(i - 1 + count) % count];
    const next = points[(i + 1) % count];
    const inX = curr.x - prev.x;
    const inY = curr.y - prev.y;
    const outX = next.x - curr.x;
    const outY = next.y - curr.y;
    const inLength = Math.hypot(inX, inY);
    const outLength = Math.hypot(outX, outY);
    if (inLength < 0.001 || outLength < 0.001) {
      out.push(cloneAnchor(curr));
      continue;
    }

    const dot = Math.min(1, Math.max(-1, (inX * outX + inY * outY) / (inLength * outLength)));
    const angle = Math.acos(dot);
    // Straight-through and fold-back vertices have no useful arc.
    if (angle < 0.05 || angle > Math.PI - 0.05) {
      out.push(cloneAnchor(curr));
      continue;
    }

    const halfTan = Math.tan(angle / 2);
    if (!Number.isFinite(halfTan) || halfTan <= 0.001) {
      out.push(cloneAnchor(curr));
      continue;
    }

    const cornerRadius = radii?.[curr.id] ?? radius;
    if (cornerRadius <= 0) {
      out.push(cloneAnchor(curr));
      continue;
    }

    // Tangent length for the requested radius, limited by both neighbouring
    // edges. If the limit bites, recompute the effective radius so the curve
    // stays a true circular arc instead of a stretched approximation.
    //
    // `angle` is the deflection (π − interior angle), so the tangent is
    // r·tan(angle/2), not r/tan(angle/2). The inverted form happened to be
    // right at 90° and wrong everywhere else: it shrank the arc on sharp
    // corners, which is why triangles, stars and arrow tips barely rounded.
    const maxTangent = Math.min(inLength, outLength) * 0.49;
    const tangent = Math.min(cornerRadius * halfTan, maxTangent);
    if (tangent < 0.25) {
      out.push(cloneAnchor(curr));
      continue;
    }
    const effectiveRadius = tangent / halfTan;
    const handleLength = (4 / 3) * Math.tan(angle / 4) * effectiveRadius;

    const inUnit = { x: inX / inLength, y: inY / inLength };
    const outUnit = { x: outX / outLength, y: outY / outLength };
    const enter = {
      x: curr.x - inUnit.x * tangent,
      y: curr.y - inUnit.y * tangent,
    };
    const leave = {
      x: curr.x + outUnit.x * tangent,
      y: curr.y + outUnit.y * tangent,
    };

    out.push({
      id: `${curr.id}-c1`,
      x: enter.x,
      y: enter.y,
      type: 'smooth',
      handleOut: {
        x: enter.x + inUnit.x * handleLength,
        y: enter.y + inUnit.y * handleLength,
      },
    });
    out.push({
      id: `${curr.id}-c2`,
      x: leave.x,
      y: leave.y,
      type: 'smooth',
      handleIn: {
        x: leave.x - outUnit.x * handleLength,
        y: leave.y - outUnit.y * handleLength,
      },
    });
    changed = true;
  }

  return { points: out, changed };
}

/**
 * Sets a uniform corner radius, or one corner when `cornerId` is supplied.
 * The sharp source and per-corner overrides stay editable, so a radius can be
 * dragged back and forth without compounding round after round.
 */
export function roundPathCorners(
  path: VectorPath,
  radius: number,
  cornerId?: string
): VectorPath {
  if (path.text) return path;

  const source = path.cornerSource
    ? {
        points: cloneContour(path.cornerSource.points),
        ...(path.cornerSource.holes
          ? { holes: path.cornerSource.holes.map(cloneContour) }
          : {}),
      }
    : {
        points: cloneContour(path.points),
        ...(path.holes ? { holes: path.holes.map(cloneContour) } : {}),
      };

  const nextUniform = cornerId ? (path.cornerRadius ?? 0) : radius;
  const nextRadii = cornerId ? { ...(path.cornerRadii ?? {}) } : {};
  if (cornerId) nextRadii[cornerId] = Math.max(0, radius);

  const allZero =
    nextUniform <= 0 && Object.values(nextRadii).every((value) => value <= 0);
  if (allZero) {
    if (!path.cornerSource && !path.cornerRadii && (path.cornerRadius ?? 0) <= 0) {
      return path;
    }
    return {
      ...path,
      points: source.points,
      ...(source.holes ? { holes: source.holes } : { holes: undefined }),
      cornerRadius: 0,
      cornerRadii: undefined,
      cornerSource: undefined,
    };
  }

  const rounded = roundContour(source.points, path.closed, nextUniform, nextRadii);
  const roundedHoles = source.holes?.map((hole) =>
    roundContour(hole, true, nextUniform, nextRadii)
  );
  const holesChanged = roundedHoles?.some((hole) => hole.changed) ?? false;
  if (!rounded.changed && !holesChanged && !path.cornerSource) return path;

  return {
    ...path,
    points: rounded.points,
    ...(roundedHoles
      ? { holes: roundedHoles.map((hole) => hole.points) }
      : { holes: undefined }),
    cornerRadius: nextUniform,
    ...(Object.keys(nextRadii).length ? { cornerRadii: nextRadii } : { cornerRadii: undefined }),
    cornerSource: source,
  };
}

/**
 * Nearest point on one segment, measured on the curve itself rather than the
 * straight line between its two anchors.
 */
export function nearestPointOnSegment(
  path: VectorPath,
  segmentIndex: number,
  pt: Point,
  steps = 48
): { point: Point; t: number; distance: number } | null {
  const count = path.points.length;
  if (count < 2) return null;

  const a = path.points[segmentIndex];
  const b = path.points[(segmentIndex + 1) % count];
  if (!a || !b) return null;

  const samples = sampleCubicBezier(
    a,
    a.handleOut || { x: a.x, y: a.y },
    b.handleIn || { x: b.x, y: b.y },
    b,
    steps
  );

  let best: { point: Point; t: number; distance: number } | null = null;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    const d = Math.hypot(s.x - pt.x, s.y - pt.y);
    if (!best || d < best.distance) best = { point: s, t: i / steps, distance: d };
  }

  return best;
}

/**
 * Inserts a node on a segment without moving the drawn outline: the segment is
 * split with de Casteljau, so the two halves trace exactly the old curve. A
 * straight segment gets a plain corner, because splitting it needs no handles.
 */
export function insertPointOnSegment(
  path: VectorPath,
  segmentIndex: number,
  t: number,
  id: string
): { points: AnchorPoint[]; index: number } | null {
  const count = path.points.length;
  if (count < 2) return null;

  const aIndex = segmentIndex;
  const bIndex = (segmentIndex + 1) % count;
  const a = path.points[aIndex];
  const b = path.points[bIndex];
  if (!a || !b) return null;

  const clamped = Math.min(0.97, Math.max(0.03, t));
  const index = aIndex + 1;
  const points = [...path.points];

  if (!a.handleOut && !b.handleIn) {
    points.splice(index, 0, {
      id,
      x: a.x + (b.x - a.x) * clamped,
      y: a.y + (b.y - a.y) * clamped,
      type: 'corner',
    });
    return { points, index };
  }

  const p0 = { x: a.x, y: a.y };
  const p1 = { x: b.x, y: b.y };
  const cp1 = a.handleOut || p0;
  const cp2 = b.handleIn || p1;
  const lerp = (m: Point, n: Point): Point => ({
    x: m.x + (n.x - m.x) * clamped,
    y: m.y + (n.y - m.y) * clamped,
  });

  const q0 = lerp(p0, cp1);
  const q1 = lerp(cp1, cp2);
  const q2 = lerp(cp2, p1);
  const r0 = lerp(q0, q1);
  const r1 = lerp(q1, q2);
  const mid = lerp(r0, r1);

  points[aIndex] = { ...a, handleOut: q0 };
  points[bIndex] = { ...b, handleIn: q2 };
  points.splice(index, 0, {
    id,
    x: mid.x,
    y: mid.y,
    type: 'smooth',
    handleIn: r0,
    handleOut: r1,
  });

  return { points, index };
}

/**
 * Flattens anchors (and any curve handles) into an ordered polygon.
 */
function flattenAnchors(
  anchors: AnchorPoint[],
  closed: boolean,
  stepsPerCurve = 16
): Point[] {
  const count = anchors.length;
  if (count < 2) return anchors.map((p) => ({ x: p.x, y: p.y }));

  const out: Point[] = [];
  const segments = closed ? count : count - 1;

  for (let i = 0; i < segments; i++) {
    const a = anchors[i];
    const b = anchors[(i + 1) % count];
    const cp1 = a.handleOut;
    const cp2 = b.handleIn;

    if (cp1 || cp2) {
      const sampled = sampleCubicBezier(a, cp1 ?? a, cp2 ?? b, b, stepsPerCurve);
      // Drop the last sample: the next segment contributes that anchor itself.
      for (let s = 0; s < sampled.length - 1; s++) {
        out.push({ x: sampled[s].x, y: sampled[s].y });
      }
    } else {
      out.push({ x: a.x, y: a.y });
    }
  }

  if (!closed) {
    const last = anchors[count - 1];
    out.push({ x: last.x, y: last.y });
  }

  return out;
}

/**
 * Reduces the anchor count of an already-drawn path without re-tracing it.
 * The outline is flattened, simplified at `tolerance` artboard units and
 * refitted with smooth handles, so an over-traced logo or a converted glyph
 * becomes editable again while keeping its shape. Counters travel with it.
 */
export function simplifyPath(path: VectorPath, tolerance: number): VectorPath {
  if (path.text || tolerance <= 0) return path;

  const reduce = (
    anchors: AnchorPoint[],
    closed: boolean,
    prefix: string
  ): AnchorPoint[] | null => {
    if (anchors.length < (closed ? 4 : 3)) return null;
    const flat = flattenAnchors(anchors, closed);
    const reduced = closed
      ? simplifyRing(flat, tolerance)
      : decimateContour(simplifyPoints(flat, tolerance), tolerance, false);
    if (reduced.length < (closed ? 3 : 2)) return null;
    // The fit may use part of the chosen tolerance: the user asked for at most
    // `tolerance` units of shape change, and a fit inside half of that keeps
    // the result both sparse and honest.
    const fitted = fitSmoothBezierCurves(reduced, prefix, closed, Math.max(0.4, tolerance * 0.5));
    // Decimation alone cannot thin a curve: a flattened glyph keeps every point
    // that a bend needs, so the polyline stayed dense and this bailed out, which
    // is why Simplify did nothing on converted type. The fitted anchor count is
    // what matters — it is the number of nodes the user ends up editing.
    return fitted.length < anchors.length ? fitted : null;
  };

  const outer = reduce(path.points, path.closed, `${path.id}-s`);
  const holes = path.holes?.map(
    (hole, i) => reduce(hole, true, `${path.id}-h${i}`) ?? hole
  );

  const before = path.points.length + (path.holes?.reduce((n, h) => n + h.length, 0) ?? 0);
  const after = (outer ?? path.points).length + (holes?.reduce((n, h) => n + h.length, 0) ?? 0);
  if (after >= before) return path;

  const next = {
    ...path,
    points: outer ?? path.points,
    ...(holes ? { holes } : {}),
  };
  delete next.cornerSource;
  delete next.cornerRadius;
  delete next.cornerRadii;
  return next;
}

/**
 * Path data for a path and its counters. Draw the result with the even-odd rule
 * so a hole really is a hole rather than another filled shape on top.
 */
export function pathToSvgD(path: VectorPath): string {
  let d = pointsToSvgPath(path.points, path.closed);
  if (path.holes && path.holes.length > 0) {
    for (const hole of path.holes) {
      const holeD = pointsToSvgPath(hole, true);
      if (holeD) d += ` ${holeD}`;
    }
  }
  return d;
}
