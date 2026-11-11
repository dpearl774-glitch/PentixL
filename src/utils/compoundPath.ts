import type {
  AnchorPoint as EditorAnchor,
  Point,
  PressureProfile,
  StrokeCap,
  StrokeJoin,
  VectorPath,
} from '../types/vector';
import type { AnchorPoint, CompoundVectorPath, VectorSubpath } from '../types/compoundPath';

/* ------------------------------------------------------------------------ *
 * Compound paths
 *
 * A letter like O is one object with two contours, and it stays one object
 * here: subpaths share the fill and the winding rule, exactly as Illustrator
 * groups an outlined glyph. Everything in this module is a boundary adapter —
 * the engine speaks CompoundVectorPath, the node editor speaks VectorPath, and
 * neither has to know about the other.
 * ------------------------------------------------------------------------ */

const round = (value: number) => Math.round(value * 1000) / 1000;

/** Shoelace area. Its sign is the contour's winding direction. */
export function signedArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function pointInPolygon(point: Point, ring: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const a = ring[i];
    const b = ring[j];
    const crosses =
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

function dedupeRing(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const point of points) {
    const last = out[out.length - 1];
    if (!last || Math.hypot(last.x - point.x, last.y - point.y) > 1e-6) {
      out.push({ x: point.x, y: point.y });
    }
  }
  if (out.length > 2) {
    const first = out[0];
    const last = out[out.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) <= 1e-6) out.pop();
  }
  return out;
}

const cornerAnchor = (point: Point, id: string): AnchorPoint => ({
  id,
  x: round(point.x),
  y: round(point.y),
  handleIn: { dx: 0, dy: 0 },
  handleOut: { dx: 0, dy: 0 },
  type: 'corner',
});

/**
 * Groups loose contours into compound paths by containment: the outermost ring
 * paints, the rings inside it become its counters, and a ring inside a counter
 * starts a new shape of its own. Outer rings and their holes are wound against
 * each other so the result fills correctly with the nonzero rule.
 */
export function compoundFromContours(
  contours: Point[][],
  options: { idPrefix?: string; fillRule?: 'nonzero' | 'evenodd' } = {}
): CompoundVectorPath[] {
  const prefix = options.idPrefix ?? `compound-${Math.random().toString(36).slice(2, 8)}`;
  const rings = contours.map(dedupeRing).filter((ring) => ring.length >= 3);
  if (!rings.length) return [];

  const areas = rings.map(signedArea);
  const parents = rings.map((ring, index) => {
    let best = -1;
    let bestArea = Infinity;
    rings.forEach((other, otherIndex) => {
      if (otherIndex === index) return;
      if (Math.abs(areas[otherIndex]) <= Math.abs(areas[index])) return;
      if (!pointInPolygon(ring[0], other)) return;
      if (Math.abs(areas[otherIndex]) < bestArea) {
        bestArea = Math.abs(areas[otherIndex]);
        best = otherIndex;
      }
    });
    return best;
  });

  const depth = rings.map((_, index) => {
    let steps = 0;
    let parent = parents[index];
    while (parent !== -1 && steps < rings.length) {
      parent = parents[parent];
      steps += 1;
    }
    return steps;
  });

  const orientation = (index: number, wantPositive: boolean): Point[] => {
    const positive = areas[index] > 0;
    return positive === wantPositive ? rings[index] : [...rings[index]].reverse();
  };

  const compounds: CompoundVectorPath[] = [];
  const compoundForRoot = new Map<number, CompoundVectorPath>();

  rings.forEach((_, index) => {
    if (depth[index] % 2 !== 0) return;
    const compound: CompoundVectorPath = {
      id: `${prefix}-${compounds.length}`,
      fillRule: options.fillRule ?? 'nonzero',
      subpaths: [
        {
          id: `${prefix}-${compounds.length}-outer`,
          closed: true,
          points: orientation(index, true).map((point, i) => cornerAnchor(point, `${prefix}-${compounds.length}-o${i}`)),
        },
      ],
    };
    compounds.push(compound);
    compoundForRoot.set(index, compound);
  });

  rings.forEach((_, index) => {
    if (depth[index] % 2 === 0) return;
    const root = parents[index];
    const compound = compoundForRoot.get(root);
    if (!compound) return;
    const subpath: VectorSubpath = {
      id: `${compound.id}-hole-${compound.subpaths.length - 1}`,
      closed: true,
      points: orientation(index, false).map((point, i) => cornerAnchor(point, `${compound.id}-h${compound.subpaths.length}-${i}`)),
    };
    compound.subpaths.push(subpath);
  });

  return compounds;
}

/**
 * Clean `M`, `L`, `C`, `Z` data for rendering or export. A segment turns into a
 * line whenever neither of its handles reaches anywhere, which is what keeps
 * flat edges of a fitted logo flat instead of writing a curve that pretends.
 */
export function toSVGPathData(path: CompoundVectorPath): string {
  const parts: string[] = [];

  for (const subpath of path.subpaths) {
    const anchors = subpath.points;
    if (!anchors.length) continue;

    parts.push(`M ${round(anchors[0].x)} ${round(anchors[0].y)}`);
    if (anchors.length === 1) continue;

    const segments = subpath.closed ? anchors.length : anchors.length - 1;
    for (let i = 0; i < segments; i++) {
      const from = anchors[i];
      const to = anchors[(i + 1) % anchors.length];
      const bent =
        Math.abs(from.handleOut.dx) + Math.abs(from.handleOut.dy) +
        Math.abs(to.handleIn.dx) + Math.abs(to.handleIn.dy) > 1e-9;

      if (!bent) {
        parts.push(`L ${round(to.x)} ${round(to.y)}`);
        continue;
      }
      parts.push(
        `C ${round(from.x + from.handleOut.dx)} ${round(from.y + from.handleOut.dy)} ` +
          `${round(to.x + to.handleIn.dx)} ${round(to.y + to.handleIn.dy)} ` +
          `${round(to.x)} ${round(to.y)}`
      );
    }

    if (subpath.closed) parts.push('Z');
  }

  return parts.join(' ');
}

const toSubpath = (anchors: EditorAnchor[], id: string, closed: boolean): VectorSubpath => ({
  id,
  closed,
  points: anchors.map((anchor, index) => {
    const handle = (point?: Point) =>
      point
        ? { dx: round(point.x - anchor.x), dy: round(point.y - anchor.y) }
        : { dx: 0, dy: 0 };
    return {
      id: anchor.id || `${id}-${index}`,
      x: round(anchor.x),
      y: round(anchor.y),
      handleIn: handle(anchor.handleIn),
      handleOut: handle(anchor.handleOut),
      type: anchor.type === 'corner' || anchor.type === 'broken' ? 'corner' : 'smooth',
    } as AnchorPoint;
  }),
});

/** Editor objects to the engine's model: first contour paints, the rest punch. */
export function fromVectorPaths(paths: VectorPath[]): CompoundVectorPath[] {
  return paths
    .filter((path) => path.points.length > 0)
    .map((path) => {
      const subpaths = [toSubpath(path.points, `${path.id}-outer`, path.closed)];
      (path.holes ?? []).forEach((hole, index) => {
        subpaths.push(toSubpath(hole, `${path.id}-hole-${index}`, true));
      });
      return {
        id: path.id,
        subpaths,
        fillRule: (path.holes?.length ? 'evenodd' : 'nonzero') as 'nonzero' | 'evenodd',
      };
    });
}

/** One subpath back to editor anchors, keeping every fit handle as it is. */
export function toEditorAnchors(subpath: VectorSubpath): EditorAnchor[] {
  return subpath.points.map((point) => {
    const anchor: EditorAnchor = {
      id: point.id,
      x: round(point.x),
      y: round(point.y),
      type: point.type,
    };
    if (point.handleIn.dx || point.handleIn.dy) {
      anchor.handleIn = { x: round(point.x + point.handleIn.dx), y: round(point.y + point.handleIn.dy) };
    }
    if (point.handleOut.dx || point.handleOut.dy) {
      anchor.handleOut = { x: round(point.x + point.handleOut.dx), y: round(point.y + point.handleOut.dy) };
    }
    return anchor;
  });
}

export interface CompoundPaint {
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  strokeOpacity: number;
  strokeCap: StrokeCap;
  strokeJoin: StrokeJoin;
  pressureProfile: PressureProfile;
  name?: string;
}

/** Engine compounds to editable, selectable objects. */
export function toVectorPaths(compounds: CompoundVectorPath[], paint: CompoundPaint): VectorPath[] {
  return compounds.map((compound) => {
    const [outer, ...holes] = compound.subpaths;
    if (!outer) {
      return {
        id: compound.id,
        name: paint.name ?? compound.id,
        points: [],
        closed: false,
        ...paint,
      };
    }
    return {
      id: compound.id,
      name: paint.name ?? compound.id,
      points: toEditorAnchors(outer),
      ...(holes.length ? { holes: holes.map(toEditorAnchors) } : {}),
      closed: outer.closed,
      ...paint,
    };
  });
}
