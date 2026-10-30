import { AnchorPoint, Point, VectorPath } from '../types/vector';
import { pathToPolygon } from './bezier';
import { fitSmoothBezierCurves, simplifyPoints } from './contourTracer';

type Pt = [number, number];

/** Samples used to approximate a round cap; joins use a miter with a limit. */
const CAP_STEPS = 10;
const MITER_LIMIT = 4;

const unitNormal = (a: Pt, b: Pt): { x: number; y: number } => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return { x: 0, y: 0 };
  return { x: -dy / len, y: dx / len };
};

/** Direction of travel from a to b — used to swing a round cap outward. */
const unitTangent = (a: Pt, b: Pt): { x: number; y: number } => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
};

/**
 * Outlines a stroked path: the stroke becomes a closed filled shape with the
 * same silhouette, so a hairline can be fed to the shape builder or pathfinder.
 * The centre line is offset to both sides — no boolean geometry — so closed
 * shapes become a band with a counter and open lines get round caps.
 * Returns [] when the path is typography or has no visible stroke.
 */
export function outlineStroke(path: VectorPath): VectorPath[] {
  if (path.text) return [];
  const width = path.strokeWidth ?? 0;
  const strokeColor = path.stroke;
  if (!(width > 0) || !strokeColor || strokeColor === 'none') return [];

  const flat = pathToPolygon(path, 24);
  if (flat.length < 2) return [];

  const pts: Pt[] = flat.map(([x, y]) => [x, y]);
  const closed = !!path.closed && pts.length >= 3;

  // A closed ring may repeat its first point; an open line should not.
  if (!closed && pts.length > 2) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) pts.pop();
  }
  if (pts.length < 2) return [];

  const half = Math.max(0.05, width / 2);
  const count = pts.length;

  /* Offset normal per vertex, mitred where two segments meet. */
  const offsets = pts.map((_, i) => {
    const segIn = closed ? unitNormal(pts[(i - 1 + count) % count], pts[i]) : i > 0 ? unitNormal(pts[i - 1], pts[i]) : null;
    const segOut = closed ? unitNormal(pts[i], pts[(i + 1) % count]) : i < count - 1 ? unitNormal(pts[i], pts[i + 1]) : null;

    let nx: number;
    let ny: number;
    let scale = 1;

    if (segIn && segOut) {
      nx = segIn.x + segOut.x;
      ny = segIn.y + segOut.y;
      const len = Math.hypot(nx, ny);
      if (len < 1e-6) {
        nx = segOut.x;
        ny = segOut.y;
      } else {
        nx /= len;
        ny /= len;
        scale = Math.min(MITER_LIMIT, 2 / len);
      }
    } else {
      const only = (segOut ?? segIn)!;
      nx = only.x;
      ny = only.y;
    }

    return { nx: nx * half * scale, ny: ny * half * scale };
  });

  const side = (i: number, sign: number): Pt => [
    pts[i][0] + offsets[i].nx * sign,
    pts[i][1] + offsets[i].ny * sign,
  ];

  const rings: Pt[][] = [];

  if (closed) {
    const outer: Pt[] = [];
    const inner: Pt[] = [];
    for (let i = 0; i < count; i++) {
      outer.push(side(i, 1));
      inner.push(side(i, -1));
    }
    rings.push(outer, inner.reverse());
  } else {
    const tEnd = unitTangent(pts[count - 2], pts[count - 1]);
    const tStart = unitTangent(pts[1], pts[0]);
    const nEnd = unitNormal(pts[count - 2], pts[count - 1]);
    const nStart = unitNormal(pts[0], pts[1]);

    const ring: Pt[] = [];
    for (let i = 0; i < count; i++) ring.push(side(i, 1));

    // Round cap beyond the last point, swinging from +normal to -normal
    const end = pts[count - 1];
    for (let s = 1; s < CAP_STEPS; s++) {
      const a = (s / CAP_STEPS) * Math.PI;
      ring.push([
        end[0] + half * (nEnd.x * Math.cos(a) + tEnd.x * Math.sin(a)),
        end[1] + half * (nEnd.y * Math.cos(a) + tEnd.y * Math.sin(a)),
      ]);
    }

    for (let i = count - 1; i >= 0; i--) ring.push(side(i, -1));

    // Round cap behind the first point, travelling backwards
    const start = pts[0];
    for (let s = 1; s < CAP_STEPS; s++) {
      const a = (s / CAP_STEPS) * Math.PI;
      ring.push([
        start[0] + half * (-nStart.x * Math.cos(a) + tStart.x * Math.sin(a)),
        start[1] + half * (-nStart.y * Math.cos(a) + tStart.y * Math.sin(a)),
      ]);
    }

    rings.push(ring);
  }

  const signedArea = (ring: Pt[]) => {
    let sum = 0;
    for (let i = 0; i < ring.length; i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[(i + 1) % ring.length];
      sum += x1 * y2 - x2 * y1;
    }
    return sum / 2;
  };

  const base: VectorPath = {
    ...path,
    name: `${path.name} outline`,
    stroke: 'none',
    strokeWidth: 0,
    strokeOpacity: 0,
    fill: strokeColor,
    fillOpacity: path.strokeOpacity ?? 1,
    pressureProfile: 'uniform',
    closed: true,
  };
  delete (base as { fillGradient?: unknown }).fillGradient;

  let outerRing = rings[0];
  let holeRing: Pt[] | null = null;

  if (closed && rings.length === 2) {
    // The wider ring is the silhouette; the narrower one is the counter. A
    // stroke wider than the shape inverts the inner ring — then it stays solid.
    const a0 = Math.abs(signedArea(rings[0]));
    const a1 = Math.abs(signedArea(rings[1]));
    const [big, small] = a0 >= a1 ? [rings[0], rings[1]] : [rings[1], rings[0]];
    outerRing = big;
    const smallArea = Math.min(a0, a1);
    const bigArea = Math.max(a0, a1);
    if (smallArea > 0.5 && smallArea < bigArea * 0.995) holeRing = small;
  }

  if (outerRing.length < 3) return [];

  /**
   * The shape builder's ring converter decimates at a whole unit, which eats a
   * 5 px round cap. Outlines keep a finer tolerance and fit smooth handles, so
   * caps and joins stay round while straight edges keep their corners.
   */
  const toAnchors = (ring: Pt[], id: string): AnchorPoint[] => {
    const points: Point[] = ring.map(([x, y]) => ({ x, y }));
    const simplified = points.length > 4 ? simplifyPoints(points, 0.35) : points;
    return fitSmoothBezierCurves(simplified, id, true);
  };

  try {
    const anchors = toAnchors(outerRing, `${path.id}-outline`);
    const holeAnchors = holeRing ? toAnchors(holeRing, `${path.id}-outline-hole`) : null;
    return [
      {
        ...base,
        id: `${path.id}-outline-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        points: anchors,
        ...(holeAnchors ? { holes: [holeAnchors] } : {}),
      },
    ];
  } catch {
    return [];
  }
}
