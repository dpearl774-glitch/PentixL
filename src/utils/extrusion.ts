import type { AnchorPoint, Point, VectorPath } from '../types/vector';
import type { BoundingBox } from './transform';
import { pathToPolygon } from './bezier';

export const DEFAULT_EXTRUDE_ANGLE = 45;
/** Back-face shrink used when a path has no stored taper: a little perspective. */
export const DEFAULT_EXTRUDE_TAPER = 0.16;

/** Hard ceiling on wall segments for one object so traced art cannot stall the view. */
const MAX_WALL_SEGMENTS = 240;
/** How far around from the pull the key light sits. */
const LIGHT_OFFSET = 55;
/** Flat facets used to approximate a smooth Lambert ramp around the silhouette. */
const SHADE_STEPS = 24;
const SHADE_FLOOR = 0.45;
const SHADE_CEILING = 0.95;
/** Points closer than this to their chord are curve-sampling noise. */
const SIMPLIFY_TOLERANCE = 0.08;
/** Beyond this the back face would collapse through itself. */
const MAX_TAPER = 0.45;

export interface ExtrusionFace {
  /** Wall quads sharing this tone, as one path. */
  d: string;
  /** Wall colour derived from the object's own fill. */
  fill: string;
}

export interface ExtrusionShadow {
  id: string;
  /** Back silhouette; draw it with the face inside one blurred group. */
  d: string;
  blur: number;
  dx: number;
  dy: number;
  opacity: number;
}

const NO_FACES: ExtrusionFace[] = [];

/** Offset used by every side wall for one extrusion step. */
export function extrudeOffset(depth: number, angle = DEFAULT_EXTRUDE_ANGLE): Point {
  const radians = (angle * Math.PI) / 180;
  return {
    x: Math.cos(radians) * depth,
    y: Math.sin(radians) * depth,
  };
}

interface ContourCache {
  closed: boolean;
  polygon: [number, number][];
}

/**
 * Sampling is the expensive half of an extrusion, and changing depth/fill keeps
 * the same points array. Caching on that array is what keeps the slider live.
 */
const contourCache = new WeakMap<AnchorPoint[], ContourCache>();

function simplifyPolygon(polygon: [number, number][]): [number, number][] {
  if (polygon.length <= 3) return polygon;

  const collapsed: [number, number][] = [];
  for (const point of polygon) {
    const last = collapsed[collapsed.length - 1];
    if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < SIMPLIFY_TOLERANCE) continue;
    collapsed.push(point);
  }

  // Prune only points that genuinely sit on the chord between their neighbours.
  // The tolerance is in artboard units, so a large arc keeps its points while a
  // flat stretch collapses — a coarse threshold faceted circles instead.
  const pruned: [number, number][] = [];
  for (let i = 0; i < collapsed.length; i += 1) {
    const current = collapsed[i];
    const previous = pruned[pruned.length - 1] ?? collapsed[(i - 1 + collapsed.length) % collapsed.length];
    const next = collapsed[(i + 1) % collapsed.length];
    const ux = current[0] - previous[0];
    const uy = current[1] - previous[1];
    const vx = next[0] - current[0];
    const vy = next[1] - current[1];
    const base = Math.hypot(ux + vx, uy + vy);
    if (base > 0 && Math.abs(ux * vy - uy * vx) / base < SIMPLIFY_TOLERANCE) continue;
    pruned.push(current);
  }

  return pruned.length >= 3 ? pruned : polygon;
}

function contourPolygon(points: AnchorPoint[], closed: boolean): [number, number][] {
  const cached = contourCache.get(points);
  if (cached && cached.closed === closed) return cached.polygon;

  const steps = points.length > 140 ? 6 : points.length > 40 ? 12 : 18;
  const stub = { points, closed } as VectorPath;
  let polygon = simplifyPolygon(pathToPolygon(stub, steps));

  if (polygon.length > MAX_WALL_SEGMENTS) {
    const stride = Math.ceil(polygon.length / MAX_WALL_SEGMENTS);
    const capped: [number, number][] = [];
    for (let i = 0; i < polygon.length; i += stride) capped.push(polygon[i]);
    polygon = capped;
  }

  contourCache.set(points, { closed, polygon });
  return polygon;
}

function signedArea(polygon: [number, number][]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
}

function centerOf(polygon: [number, number][]): [number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of polygon) {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2];
}

function baseColor(path: VectorPath): string {
  const source =
    path.fill && path.fill !== 'none'
      ? path.fill
      : (path.fillGradient?.stops[0]?.color ?? '#4c8dff');
  return /^#[0-9a-fA-F]{6}$/.test(source) ? source : '#222831';
}

function luminance(hex: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return 0.4;
  const [r, g, b] = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function mixColor(from: string, to: string, amount: number): string {
  const t = Math.min(1, Math.max(0, amount));
  const channels = [1, 3, 5].map((offset) => {
    const a = parseInt(from.slice(offset, offset + 2), 16);
    const b = parseInt(to.slice(offset, offset + 2), 16);
    return Math.min(255, Math.max(0, Math.round(a + (b - a) * t)));
  });
  return `#${channels.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Tint toward white / shade toward black instead of scaling channels: a pure
 * red or blue has nothing to scale in two of its channels, so channel
 * multiplication would flatten the whole wall to one colour.
 */
function shadeColor(hex: string, tone: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return '#222831';
  if (tone >= 1) return mixColor(hex, '#ffffff', tone - 1);
  return mixColor(hex, '#000000', 1 - tone);
}

/**
 * Pure shading makes near-black fills invisible and near-white fills blend into
 * their own face; lift the dark end and duck the bright end so the walls always
 * separate from the object they belong to.
 */
function wallBaseColor(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return '#2a303b';
  const level = luminance(hex);
  if (level < 0.16) return mixColor(hex, '#7b8698', (0.16 - level) * 1.5);
  if (level > 0.78) return mixColor(hex, '#000000', 0.12);
  return hex;
}

interface FaceCache {
  key: string;
  faces: ExtrusionFace[];
}

const faceCache = new WeakMap<VectorPath, FaceCache>();

function backPoint(
  point: [number, number],
  center: [number, number],
  shrink: number,
  offset: Point
): [number, number] {
  return [
    center[0] + (point[0] - center[0]) * shrink + offset.x,
    center[1] + (point[1] - center[1]) * shrink + offset.y,
  ];
}

/**
 * Side walls shaded per edge like a real extrusion: one flat facet per wall,
 * brightness from a Lambert term, and only the facets turned toward the pull are
 * kept — the rest are hidden behind the face, and drawing them is what put dark
 * wedges in the notches of concave shapes.
 */
export function extrusionFaces(path: VectorPath): ExtrusionFace[] {
  const depth = path.extrudeDepth ?? 0;
  if (depth < 0.5 || !path.closed || path.text) return NO_FACES;

  const angle = path.extrudeAngle ?? DEFAULT_EXTRUDE_ANGLE;
  const taper = Math.min(MAX_TAPER, Math.max(0, path.extrudeTaper ?? DEFAULT_EXTRUDE_TAPER));
  const color = baseColor(path);
  const key = `${depth.toFixed(2)}|${angle}|${taper.toFixed(2)}|${path.points.length}|${path.holes?.length ?? 0}|${color}`;
  const cached = faceCache.get(path);
  if (cached && cached.key === key) return cached.faces;

  const offset = extrudeOffset(depth, angle);
  const pullLength = Math.hypot(offset.x, offset.y) || 1;
  const pullX = offset.x / pullLength;
  const pullY = offset.y / pullLength;
  const shrink = 1 - taper;

  const outer = contourPolygon(path.points, true);
  if (outer.length < 3) return NO_FACES;
  const center = centerOf(outer);

  const lightAngle = ((angle - LIGHT_OFFSET) * Math.PI) / 180;
  const lightX = Math.cos(lightAngle);
  const lightY = Math.sin(lightAngle);
  // Over the visible half of the silhouette the Lambert term runs from this
  // floor to 1, so the ramp uses its whole range whatever direction is pulled.
  const lightFloor = -Math.sin((LIGHT_OFFSET * Math.PI) / 180);

  const wallBase = wallBaseColor(color);
  const buckets: string[][] = Array.from({ length: SHADE_STEPS }, () => []);

  const addContour = (contour: [number, number][], dir: number) => {
    if (contour.length < 3) return;
    for (let i = 0; i < contour.length; i += 1) {
      const a = contour[i];
      const b = contour[(i + 1) % contour.length];
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const length = Math.hypot(dx, dy);
      if (length < 0.3) continue;

      const nx = (dy / length) * dir;
      const ny = (-dx / length) * dir;
      // Hidden-line removal: a wall turned away from the pull sits behind the
      // face, so drawing it only leaks through concave notches.
      if (nx * pullX + ny * pullY <= 0) continue;

      const facing = nx * lightX + ny * lightY;
      const ramp = Math.min(1, Math.max(0, (facing - lightFloor) / (1 - lightFloor)));
      const backA = backPoint(a, center, shrink, offset);
      const backB = backPoint(b, center, shrink, offset);
      buckets[Math.round(ramp * (SHADE_STEPS - 1))].push(
        `M ${a[0].toFixed(2)} ${a[1].toFixed(2)} L ${b[0].toFixed(2)} ${b[1].toFixed(2)} L ${backB[0].toFixed(2)} ${backB[1].toFixed(2)} L ${backA[0].toFixed(2)} ${backA[1].toFixed(2)} Z`
      );
    }
  };

  const outerSign = signedArea(outer) >= 0 ? 1 : -1;
  addContour(outer, outerSign);
  for (const hole of path.holes ?? []) {
    const polygon = contourPolygon(hole, true);
    if (polygon.length < 3) continue;
    // A hole's wall faces into the void, so it has to wind against the outline
    // for the normal (and therefore the culling) to come out right.
    const holeSign = signedArea(polygon) >= 0 ? 1 : -1;
    addContour(holeSign === outerSign ? [...polygon].reverse() : polygon, -outerSign);
  }

  const faces: ExtrusionFace[] = [];

  // A real solid has a back face. Without it, concave outlines show the canvas
  // straight through the body between two wall quads.
  const cap = outer
    .map((point, index) => {
      const [x, y] = backPoint(point, center, shrink, offset);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
  faces.push({ d: `${cap} Z`, fill: shadeColor(wallBase, SHADE_FLOOR - 0.1) });

  buckets.forEach((chunks, index) => {
    if (chunks.length === 0) return;
    const tone = SHADE_FLOOR + (index / (SHADE_STEPS - 1)) * (SHADE_CEILING - SHADE_FLOOR);
    faces.push({ d: chunks.join(' '), fill: shadeColor(wallBase, tone) });
  });

  faceCache.set(path, { key, faces });
  return faces;
}

/**
 * Soft contact shadow under the solid. Returned separately because it has to be
 * painted before the walls and needs a blur filter, which the face list cannot
 * express.
 */
export function extrusionShadow(path: VectorPath): ExtrusionShadow | null {
  const depth = path.extrudeDepth ?? 0;
  if (path.extrudeShadow === false || depth < 1 || !path.closed || path.text) return null;

  const angle = path.extrudeAngle ?? DEFAULT_EXTRUDE_ANGLE;
  const taper = Math.min(MAX_TAPER, Math.max(0, path.extrudeTaper ?? DEFAULT_EXTRUDE_TAPER));
  const offset = extrudeOffset(depth, angle);
  const outer = contourPolygon(path.points, true);
  if (outer.length < 3) return null;

  const center = centerOf(outer);
  const shrink = 1 - taper;
  const d = `${outer
    .map((point, index) => {
      const [x, y] = backPoint(point, center, shrink, offset);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ')} Z`;

  return {
    id: `extrude-shadow-${path.id}`,
    d,
    blur: 2 + depth * 0.12,
    dx: 2 + depth * 0.18,
    dy: 3 + depth * 0.22,
    opacity: 0.32,
  };
}

/** Combined wall path — kept for callers that only need the silhouette. */
export function extrusionPathData(path: VectorPath): string {
  return extrusionFaces(path)
    .map((face) => face.d)
    .join(' ');
}

/** Exported selection bounds must include the walls and the shadow. */
export function includeExtrusionInBounds(
  paths: VectorPath[],
  box: BoundingBox
): BoundingBox {
  let minX = box.minX;
  let minY = box.minY;
  let maxX = box.maxX;
  let maxY = box.maxY;

  for (const path of paths) {
    if (!path.closed || path.text || (path.extrudeDepth ?? 0) <= 0) continue;
    const offset = extrudeOffset(path.extrudeDepth!, path.extrudeAngle);
    minX = Math.min(minX, box.minX + offset.x);
    minY = Math.min(minY, box.minY + offset.y);
    maxX = Math.max(maxX, box.maxX + offset.x);
    maxY = Math.max(maxY, box.maxY + offset.y);

    const shadow = extrusionShadow(path);
    if (shadow) {
      minX = Math.min(minX, box.minX - shadow.blur);
      minY = Math.min(minY, box.minY - shadow.blur);
      maxX = Math.max(maxX, box.maxX + shadow.dx + shadow.blur);
      maxY = Math.max(maxY, box.maxY + shadow.dy + shadow.blur);
    }
  }

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

/** Mid-tone side colour, for flat callers such as the bounds preview. */
export function extrusionShade(path: VectorPath): string {
  return shadeColor(wallBaseColor(baseColor(path)), 0.52);
}
