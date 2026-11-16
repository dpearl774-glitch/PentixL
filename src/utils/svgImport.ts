import { AnchorPoint, Point, VectorPath } from '../types/vector';

/**
 * SVG import.
 *
 * Illustrator and Figma both hand you an .svg, so a pro tool has to take one in.
 * The file is read as geometry, not as a picture: path data is parsed into the
 * same anchors the pen tool produces, so every curve stays editable, and closed
 * contours are nested so counters stay holes instead of becoming filled discs.
 */

export interface ImportedSubpath {
  anchors: AnchorPoint[];
  closed: boolean;
}

type Matrix = [number, number, number, number, number, number]; // a b c d e f

const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];
const KAPPA = 0.5522847498307936;

let importCounter = 0;
const nextId = (prefix: string) => {
  importCounter += 1;
  return `${prefix}-${importCounter}`;
};

const round = (value: number) => Math.round(value * 1000) / 1000;

function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function applyMatrix(m: Matrix, point: Point): Point {
  return {
    x: m[0] * point.x + m[2] * point.y + m[4],
    y: m[1] * point.x + m[3] * point.y + m[5],
  };
}

/** `translate(4 2) rotate(30) scale(2)` — the four transforms SVG actually uses. */
export function parseTransform(value: string | null | undefined): Matrix {
  if (!value) return IDENTITY;
  let matrix = IDENTITY;
  const pattern = /(matrix|translate|scale|rotate|skewX|skewY)\s*\(([^)]*)\)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(value))) {
    const numbers = match[2]
      .split(/[\s,]+/)
      .map((part) => parseFloat(part))
      .filter((n) => Number.isFinite(n));
    const kind = match[1];
    if (kind === 'matrix' && numbers.length >= 6) {
      matrix = multiply(matrix, numbers.slice(0, 6) as Matrix);
    } else if (kind === 'translate') {
      matrix = multiply(matrix, [1, 0, 0, 1, numbers[0] ?? 0, numbers[1] ?? 0]);
    } else if (kind === 'scale') {
      const sx = numbers[0] ?? 1;
      const sy = numbers[1] ?? sx;
      matrix = multiply(matrix, [sx, 0, 0, sy, 0, 0]);
    } else if (kind === 'rotate') {
      const angle = ((numbers[0] ?? 0) * Math.PI) / 180;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      const rotation: Matrix = [cos, sin, -sin, cos, 0, 0];
      if (numbers.length >= 3) {
        const cx = numbers[1];
        const cy = numbers[2];
        matrix = multiply(matrix, [1, 0, 0, 1, cx, cy]);
        matrix = multiply(matrix, rotation);
        matrix = multiply(matrix, [1, 0, 0, 1, -cx, -cy]);
      } else {
        matrix = multiply(matrix, rotation);
      }
    } else if (kind === 'skewX') {
      matrix = multiply(matrix, [1, 0, Math.tan(((numbers[0] ?? 0) * Math.PI) / 180), 1, 0, 0]);
    } else if (kind === 'skewY') {
      matrix = multiply(matrix, [1, Math.tan(((numbers[0] ?? 0) * Math.PI) / 180), 0, 1, 0, 0]);
    }
  }
  return matrix;
}

const TOKEN = /([astvzqmhlcASTVZQMHLC])|(-?\d*\.?\d+(?:[eE][-+]?\d+)?)/g;

function tokenize(d: string): string[] {
  const tokens: string[] = [];
  let match: RegExpExecArray | null;
  TOKEN.lastIndex = 0;
  while ((match = TOKEN.exec(d))) tokens.push(match[1] ?? match[2]);
  return tokens;
}

/** Every cubic segment the parser produces, before anchors are built. */
interface Segment {
  from: Point;
  to: Point;
  c1: Point;
  c2: Point;
}

/** One arc → cubic segments, following the endpoint parameterisation. */
function arcToCubics(
  from: Point,
  rx: number,
  ry: number,
  rotation: number,
  largeArc: boolean,
  sweep: boolean,
  to: Point
): Segment[] {
  if (rx === 0 || ry === 0) {
    return [{ from, to, c1: { ...from }, c2: { ...to } }];
  }
  const phi = (rotation * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const dx2 = (from.x - to.x) / 2;
  const dy2 = (from.y - to.y) / 2;
  const x1 = cosPhi * dx2 + sinPhi * dy2;
  const y1 = -sinPhi * dx2 + cosPhi * dy2;
  let radiusX = Math.abs(rx);
  let radiusY = Math.abs(ry);
  const lambda = (x1 * x1) / (radiusX * radiusX) + (y1 * y1) / (radiusY * radiusY);
  if (lambda > 1) {
    const scale = Math.sqrt(lambda);
    radiusX *= scale;
    radiusY *= scale;
  }
  const sign = largeArc === sweep ? -1 : 1;
  const numerator = Math.max(
    0,
    radiusX * radiusX * radiusY * radiusY -
      radiusX * radiusX * y1 * y1 -
      radiusY * radiusY * x1 * x1
  );
  const denominator = radiusX * radiusX * y1 * y1 + radiusY * radiusY * x1 * x1;
  const coefficient = denominator === 0 ? 0 : sign * Math.sqrt(numerator / denominator);
  const cx1 = (coefficient * radiusX * y1) / radiusY;
  const cy1 = (-coefficient * radiusY * x1) / radiusX;
  const cx = cosPhi * cx1 - sinPhi * cy1 + (from.x + to.x) / 2;
  const cy = sinPhi * cx1 + cosPhi * cy1 + (from.y + to.y) / 2;

  const angleOf = (ux: number, uy: number, vx: number, vy: number) => {
    const dot = ux * vx + uy * vy;
    const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
    const value = len === 0 ? 0 : Math.max(-1, Math.min(1, dot / len));
    const angle = Math.acos(value);
    return ux * vy - uy * vx < 0 ? -angle : angle;
  };

  const startVector = { x: (x1 - cx1) / radiusX, y: (y1 - cy1) / radiusY };
  const endVector = { x: (-x1 - cx1) / radiusX, y: (-y1 - cy1) / radiusY };
  const startAngle = angleOf(1, 0, startVector.x, startVector.y);
  let deltaAngle = angleOf(startVector.x, startVector.y, endVector.x, endVector.y);
  if (!sweep && deltaAngle > 0) deltaAngle -= Math.PI * 2;
  if (sweep && deltaAngle < 0) deltaAngle += Math.PI * 2;

  const steps = Math.max(1, Math.ceil(Math.abs(deltaAngle) / (Math.PI / 2)));
  const stepAngle = deltaAngle / steps;
  const segments: Segment[] = [];
  const pointAt = (angle: number): Point => {
    const x = radiusX * Math.cos(angle);
    const y = radiusY * Math.sin(angle);
    return {
      x: cosPhi * x - sinPhi * y + cx,
      y: sinPhi * x + cosPhi * y + cy,
    };
  };
  for (let step = 0; step < steps; step += 1) {
    const a0 = startAngle + stepAngle * step;
    const a1 = a0 + stepAngle;
    const alpha = (4 / 3) * Math.tan(stepAngle / 4);
    const p0 = step === 0 ? from : pointAt(a0);
    const p1 = step === steps - 1 ? to : pointAt(a1);
    const cosA0 = Math.cos(a0);
    const sinA0 = Math.sin(a0);
    const cosA1 = Math.cos(a1);
    const sinA1 = Math.sin(a1);
    const c1 = {
      x: p0.x - alpha * (-radiusX * sinA0 * cosPhi - radiusY * cosA0 * sinPhi),
      y: p0.y - alpha * (-radiusX * sinA0 * sinPhi + radiusY * cosA0 * cosPhi),
    };
    const c2 = {
      x: p1.x + alpha * (-radiusX * sinA1 * cosPhi - radiusY * cosA1 * sinPhi),
      y: p1.y + alpha * (-radiusX * sinA1 * sinPhi + radiusY * cosA1 * cosPhi),
    };
    segments.push({ from: p0, to: p1, c1, c2 });
  }
  return segments;
}

/**
 * Parses SVG path data into anchors. Curves arrive as cubic handles on the same
 * anchors the pen tool edits, so an imported logo is not flattened into a
 * thousand-point polygon.
 */
export function parsePathDataToSubpaths(d: string): ImportedSubpath[] {
  const tokens = tokenize(d);
  const subpaths: ImportedSubpath[] = [];
  let current: Point = { x: 0, y: 0 };
  let start: Point = { x: 0, y: 0 };
  let previousCubicControl: Point | null = null;
  let previousQuadControl: Point | null = null;
  let anchors: AnchorPoint[] = [];
  let command = '';
  let index = 0;

  const pushAnchor = (point: Point, type: AnchorPoint['type'] = 'corner') => {
    const anchor: AnchorPoint = {
      id: nextId('svg'),
      x: round(point.x),
      y: round(point.y),
      type,
    };
    anchors.push(anchor);
    return anchor;
  };

  const addCubic = (c1: Point, c2: Point, to: Point) => {
    if (!anchors.length) pushAnchor(current);
    const from = anchors[anchors.length - 1];
    const next = pushAnchor(to, 'smooth');
    from.handleOut = { x: round(c1.x), y: round(c1.y) };
    next.handleIn = { x: round(c2.x), y: round(c2.y) };
    current = to;
  };

  const finish = (closed: boolean) => {
    if (anchors.length >= 2) subpaths.push({ anchors, closed });
    anchors = [];
  };

  const number = () => {
    const value = parseFloat(tokens[index]);
    index += 1;
    return Number.isFinite(value) ? value : 0;
  };
  const hasNumber = () => index < tokens.length && !/[a-zA-Z]/.test(tokens[index]);
  const point = (relative: boolean): Point => {
    const x = number();
    const y = number();
    return relative ? { x: current.x + x, y: current.y + y } : { x, y };
  };

  while (index < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[index])) {
      command = tokens[index];
      index += 1;
    }
    const relative = command === command.toLowerCase();
    const upper = command.toUpperCase();
    if (!upper) break;

    if (upper === 'M' || upper === 'L' || upper === 'T') {
      if (upper === 'M') {
        finish(false);
        const target = point(relative);
        current = target;
        start = target;
        pushAnchor(target);
        previousCubicControl = null;
        previousQuadControl = null;
        command = relative ? 'l' : 'L';
        continue;
      }
      if (upper === 'L') {
        const target = point(relative);
        pushAnchor(target);
        current = target;
        previousCubicControl = null;
        previousQuadControl = null;
        continue;
      }
      // T: reflected quadratic control point
      const target = point(relative);
      const control: Point = previousQuadControl
        ? {
            x: current.x * 2 - previousQuadControl.x,
            y: current.y * 2 - previousQuadControl.y,
          }
        : { ...current };
      addCubic(
        {
          x: current.x + (control.x - current.x) * (2 / 3),
          y: current.y + (control.y - current.y) * (2 / 3),
        },
        {
          x: target.x + (control.x - target.x) * (2 / 3),
          y: target.y + (control.y - target.y) * (2 / 3),
        },
        target
      );
      previousQuadControl = control;
      previousCubicControl = null;
      continue;
    }

    if (upper === 'H' || upper === 'V') {
      const value = number();
      const target: Point =
        upper === 'H'
          ? { x: relative ? current.x + value : value, y: current.y }
          : { x: current.x, y: relative ? current.y + value : value };
      pushAnchor(target);
      current = target;
      previousCubicControl = null;
      previousQuadControl = null;
      continue;
    }

    if (upper === 'C') {
      const c1 = point(relative);
      const c2 = point(relative);
      const to = point(relative);
      addCubic(c1, c2, to);
      previousCubicControl = c2;
      previousQuadControl = null;
      continue;
    }

    if (upper === 'S') {
      const c2 = point(relative);
      const to = point(relative);
      const c1 = previousCubicControl
        ? {
            x: current.x * 2 - previousCubicControl.x,
            y: current.y * 2 - previousCubicControl.y,
          }
        : { ...current };
      addCubic(c1, c2, to);
      previousCubicControl = c2;
      previousQuadControl = null;
      continue;
    }

    if (upper === 'Q') {
      const control = point(relative);
      const to = point(relative);
      addCubic(
        {
          x: current.x + (control.x - current.x) * (2 / 3),
          y: current.y + (control.y - current.y) * (2 / 3),
        },
        {
          x: to.x + (control.x - to.x) * (2 / 3),
          y: to.y + (control.y - to.y) * (2 / 3),
        },
        to
      );
      previousQuadControl = control;
      previousCubicControl = null;
      continue;
    }

    if (upper === 'A') {
      const rx = number();
      const ry = number();
      const rotation = number();
      const largeArc = number() !== 0;
      const sweep = number() !== 0;
      const to = point(relative);
      for (const segment of arcToCubics(current, rx, ry, rotation, largeArc, sweep, to)) {
        addCubic(segment.c1, segment.c2, segment.to);
      }
      previousCubicControl = null;
      previousQuadControl = null;
      continue;
    }

    if (upper === 'Z') {
      finish(true);
      current = start;
      command = '';
      previousCubicControl = null;
      previousQuadControl = null;
      continue;
    }

    // Unknown command: skip it rather than loop forever on the same token.
    index += 1;
  }
  finish(false);
  return subpaths.filter((subpath) => subpath.anchors.length >= 2);
}

/** A ring's polygon, for containment tests only. */
function anchorPolygon(anchors: AnchorPoint[]): Point[] {
  return anchors.map((anchor) => ({ x: anchor.x, y: anchor.y }));
}

function polygonArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function polygonContainsRing(ring: Point[], outer: Point[]): boolean {
  return ring.every((point) => pointInside(point, outer));
}

function pointInside(point: Point, ring: Point[]): boolean {
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

function reverseAnchors(anchors: AnchorPoint[]): AnchorPoint[] {
  return [...anchors]
    .reverse()
    .map((anchor) => ({
      ...anchor,
      handleIn: anchor.handleOut,
      handleOut: anchor.handleIn,
      type: anchor.type,
    }));
}

/**
 * Nests closed contours the way an SVG fill expects: a ring inside another ring
 * is that ring's hole, and wound the other way so the hole actually punches.
 */
export function nestSubpaths(
  subpaths: ImportedSubpath[]
): { anchors: AnchorPoint[]; holes: AnchorPoint[][]; closed: boolean }[] {
  const rings = subpaths
    .filter((subpath) => subpath.closed && subpath.anchors.length >= 3)
    .map((subpath) => ({ anchors: subpath.anchors, polygon: anchorPolygon(subpath.anchors) }));
  const open = subpaths.filter((subpath) => !subpath.closed);

  const depth = rings.map((ring, index) => {
    let count = 0;
    rings.forEach((other, otherIndex) => {
      if (otherIndex === index) return;
      if (Math.abs(polygonArea(other.polygon)) <= Math.abs(polygonArea(ring.polygon))) return;
      if (polygonContainsRing(ring.polygon, other.polygon)) count += 1;
    });
    return count;
  });

  const kept: { anchors: AnchorPoint[]; holes: AnchorPoint[][]; closed: boolean }[] = [];
  rings.forEach((ring, index) => {
    if (depth[index] % 2 === 0) {
      kept.push({ anchors: ring.anchors, holes: [], closed: true });
      return;
    }
    // Find the smallest even-depth ring that contains this one.
    let parentIndex = -1;
    let parentArea = Infinity;
    rings.forEach((other, otherIndex) => {
      if (otherIndex === index || depth[otherIndex] % 2 !== 0) return;
      if (!polygonContainsRing(ring.polygon, other.polygon)) return;
      const area = Math.abs(polygonArea(other.polygon));
      if (area < parentArea) {
        parentArea = area;
        parentIndex = otherIndex;
      }
    });
    if (parentIndex === -1) {
      kept.push({ anchors: ring.anchors, holes: [], closed: true });
      return;
    }
    const parentDepth = depth[parentIndex];
    const target = kept.find(
      (item) => item.anchors === rings[parentIndex].anchors || item.anchors[0]?.id === rings[parentIndex].anchors[0]?.id
    );
    if (target) target.holes.push(reverseAnchors(ring.anchors));
    else kept.push({ anchors: ring.anchors, holes: [], closed: true });
    void parentDepth;
  });

  for (const subpath of open) {
    kept.push({ anchors: subpath.anchors, holes: [], closed: false });
  }
  return kept;
}

function ellipseSubpath(cx: number, cy: number, rx: number, ry: number): ImportedSubpath {
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  const anchors: AnchorPoint[] = [
    {
      id: nextId('svg'),
      x: round(cx),
      y: round(cy - ry),
      handleIn: { x: round(cx - kx), y: round(cy - ry) },
      handleOut: { x: round(cx + kx), y: round(cy - ry) },
      type: 'smooth',
    },
    {
      id: nextId('svg'),
      x: round(cx + rx),
      y: round(cy),
      handleIn: { x: round(cx + rx), y: round(cy - ky) },
      handleOut: { x: round(cx + rx), y: round(cy + ky) },
      type: 'smooth',
    },
    {
      id: nextId('svg'),
      x: round(cx),
      y: round(cy + ry),
      handleIn: { x: round(cx + kx), y: round(cy + ry) },
      handleOut: { x: round(cx - kx), y: round(cy + ry) },
      type: 'smooth',
    },
    {
      id: nextId('svg'),
      x: round(cx - rx),
      y: round(cy),
      handleIn: { x: round(cx - rx), y: round(cy + ky) },
      handleOut: { x: round(cx - rx), y: round(cy - ky) },
      type: 'smooth',
    },
  ];
  return { anchors, closed: true };
}

function roundedRectSubpath(
  x: number,
  y: number,
  width: number,
  height: number,
  rx: number,
  ry: number
): ImportedSubpath {
  if (rx <= 0 || ry <= 0) {
    return {
      anchors: [
        { id: nextId('svg'), x: round(x), y: round(y), type: 'corner' },
        { id: nextId('svg'), x: round(x + width), y: round(y), type: 'corner' },
        { id: nextId('svg'), x: round(x + width), y: round(y + height), type: 'corner' },
        { id: nextId('svg'), x: round(x), y: round(y + height), type: 'corner' },
      ],
      closed: true,
    };
  }
  const kx = rx * KAPPA;
  const ky = ry * KAPPA;
  const anchors: AnchorPoint[] = [
    {
      id: nextId('svg'),
      x: round(x + rx),
      y: round(y),
      handleIn: { x: round(x + rx - kx), y: round(y) },
      handleOut: { x: round(x + rx - kx), y: round(y) },
      type: 'smooth',
    },
    {
      id: nextId('svg'),
      x: round(x + width - rx),
      y: round(y),
      handleIn: { x: round(x + width - rx + kx), y: round(y) },
      handleOut: { x: round(x + width - rx + kx), y: round(y) },
      type: 'smooth',
    },
    {
      id: nextId('svg'),
      x: round(x + width),
      y: round(y + ry),
      handleIn: { x: round(x + width), y: round(y + ry - ky) },
      handleOut: { x: round(x + width), y: round(y + ry - ky) },
      type: 'smooth',
    },
    {
      id: nextId('svg'),
      x: round(x + width),
      y: round(y + height - ry),
      handleIn: { x: round(x + width), y: round(y + height - ry + ky) },
      handleOut: { x: round(x + width), y: round(y + height - ry + ky) },
      type: 'smooth',
    },
    {
      id: nextId('svg'),
      x: round(x + width - rx),
      y: round(y + height),
      handleIn: { x: round(x + width - rx + kx), y: round(y + height) },
      handleOut: { x: round(x + width - rx + kx), y: round(y + height) },
      type: 'smooth',
    },
    {
      id: nextId('svg'),
      x: round(x + rx),
      y: round(y + height),
      handleIn: { x: round(x + rx - kx), y: round(y + height) },
      handleOut: { x: round(x + rx - kx), y: round(y + height) },
      type: 'smooth',
    },
    {
      id: nextId('svg'),
      x: round(x),
      y: round(y + height - ry),
      handleIn: { x: round(x), y: round(y + height - ry + ky) },
      handleOut: { x: round(x), y: round(y + height - ry + ky) },
      type: 'smooth',
    },
    {
      id: nextId('svg'),
      x: round(x),
      y: round(y + ry),
      handleIn: { x: round(x), y: round(y + ry - ky) },
      handleOut: { x: round(x), y: round(y + ry - ky) },
      type: 'smooth',
    },
  ];
  return { anchors, closed: true };
}

function paintFrom(element: Element, inherited: { fill: string; stroke: string; strokeWidth: number }) {
  const style = element.getAttribute('style') ?? '';
  const styleValue = (name: string) => {
    const match = style.match(new RegExp(`${name}\\s*:\\s*([^;]+)`));
    return match ? match[1].trim() : null;
  };
  const fillAttr = element.getAttribute('fill') ?? styleValue('fill');
  const strokeAttr = element.getAttribute('stroke') ?? styleValue('stroke');
  const widthAttr = element.getAttribute('stroke-width') ?? styleValue('stroke-width');
  return {
    fill: fillAttr ?? inherited.fill,
    stroke: strokeAttr ?? inherited.stroke,
    strokeWidth: widthAttr ? parseFloat(widthAttr) || 0 : inherited.strokeWidth,
  };
}

export interface SvgImportResult {
  paths: VectorPath[];
  skipped: string[];
}

/**
 * Turns an .svg file into editable artwork, scaled to fit the artboard.
 *
 * Text is reported rather than guessed at: a font we do not have would arrive as
 * a wrong shape, and the caller can tell the user to convert it first.
 */
export function svgTextToVectorPaths(
  svgText: string,
  artboard: { width: number; height: number },
  options: { margin?: number; name?: string } = {}
): SvgImportResult {
  if (typeof DOMParser === 'undefined') {
    throw new Error('SVG import needs a browser');
  }
  const document = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (document.querySelector('parsererror')) throw new Error('That file is not valid SVG');
  const root = document.documentElement;
  if (!root || root.tagName.toLowerCase() !== 'svg') throw new Error('That file is not an SVG');

  const viewBox = (root.getAttribute('viewBox') ?? '')
    .split(/[\s,]+/)
    .map((part) => parseFloat(part))
    .filter((n) => Number.isFinite(n));
  const width = viewBox.length === 4 ? viewBox[2] : parseFloat(root.getAttribute('width') ?? '0');
  const height = viewBox.length === 4 ? viewBox[3] : parseFloat(root.getAttribute('height') ?? '0');
  const originX = viewBox.length === 4 ? viewBox[0] : 0;
  const originY = viewBox.length === 4 ? viewBox[1] : 0;
  if (!width || !height) throw new Error('That SVG has no size');

  const margin = options.margin ?? 0.08;
  const scale = Math.min(
    (artboard.width * (1 - margin * 2)) / width,
    (artboard.height * (1 - margin * 2)) / height
  );
  const offsetX = (artboard.width - width * scale) / 2 - originX * scale;
  const offsetY = (artboard.height - height * scale) / 2 - originY * scale;
  const fit: Matrix = [scale, 0, 0, scale, offsetX, offsetY];

  const subpaths: ImportedSubpath[] = [];
  const paints: { fill: string; stroke: string; strokeWidth: number }[] = [];
  const skipped: string[] = [];

  const walk = (element: Element, inherited: Matrix, paint: { fill: string; stroke: string; strokeWidth: number }) => {
    const tag = element.tagName.toLowerCase();
    if (['defs', 'clippath', 'mask', 'filter', 'metadata', 'title', 'desc', 'style'].includes(tag)) {
      return;
    }
    const matrix = multiply(inherited, parseTransform(element.getAttribute('transform')));
    const elementPaint = paintFrom(element, paint);
    if (tag === 'g' || tag === 'svg') {
      Array.from(element.children).forEach((child) => walk(child, matrix, elementPaint));
      return;
    }
    if (tag === 'text' || tag === 'tspan') {
      skipped.push('text');
      return;
    }

    let produced: ImportedSubpath[] = [];
    if (tag === 'path') {
      produced = parsePathDataToSubpaths(element.getAttribute('d') ?? '');
    } else if (tag === 'rect') {
      const x = parseFloat(element.getAttribute('x') ?? '0');
      const y = parseFloat(element.getAttribute('y') ?? '0');
      const w = parseFloat(element.getAttribute('width') ?? '0');
      const h = parseFloat(element.getAttribute('height') ?? '0');
      const rx = parseFloat(element.getAttribute('rx') ?? element.getAttribute('ry') ?? '0') || 0;
      const ry = parseFloat(element.getAttribute('ry') ?? element.getAttribute('rx') ?? '0') || 0;
      if (w > 0 && h > 0) produced = [roundedRectSubpath(x, y, w, h, rx, ry)];
    } else if (tag === 'circle') {
      const cx = parseFloat(element.getAttribute('cx') ?? '0');
      const cy = parseFloat(element.getAttribute('cy') ?? '0');
      const r = parseFloat(element.getAttribute('r') ?? '0');
      if (r > 0) produced = [ellipseSubpath(cx, cy, r, r)];
    } else if (tag === 'ellipse') {
      const cx = parseFloat(element.getAttribute('cx') ?? '0');
      const cy = parseFloat(element.getAttribute('cy') ?? '0');
      const rx = parseFloat(element.getAttribute('rx') ?? '0');
      const ry = parseFloat(element.getAttribute('ry') ?? '0');
      if (rx > 0 && ry > 0) produced = [ellipseSubpath(cx, cy, rx, ry)];
    } else if (tag === 'line') {
      const x1 = parseFloat(element.getAttribute('x1') ?? '0');
      const y1 = parseFloat(element.getAttribute('y') ?? '0');
      const x2 = parseFloat(element.getAttribute('x2') ?? '0');
      const y2 = parseFloat(element.getAttribute('y2') ?? '0');
      produced = [
        {
          anchors: [
            { id: nextId('svg'), x: round(x1), y: round(y1), type: 'corner' },
            { id: nextId('svg'), x: round(x2), y: round(y2), type: 'corner' },
          ],
          closed: false,
        },
      ];
    } else if (tag === 'polygon' || tag === 'polyline') {
      const numbers = (element.getAttribute('points') ?? '')
        .split(/[\s,]+/)
        .map((part) => parseFloat(part))
        .filter((n) => Number.isFinite(n));
      const anchors: AnchorPoint[] = [];
      for (let i = 0; i + 1 < numbers.length; i += 2) {
        anchors.push({ id: nextId('svg'), x: round(numbers[i]), y: round(numbers[i + 1]), type: 'corner' });
      }
      if (anchors.length >= 2) produced = [{ anchors, closed: tag === 'polygon' }];
    } else if (tag !== 'svg') {
      skipped.push(tag);
      return;
    }

    const transformed = produced
      .map((subpath) => {
        const anchors = subpath.anchors.map((anchor) => {
          const point = applyMatrix(matrix, anchor);
          const handleIn = anchor.handleIn ? applyMatrix(matrix, anchor.handleIn) : undefined;
          const handleOut = anchor.handleOut ? applyMatrix(matrix, anchor.handleOut) : undefined;
          return {
            ...anchor,
            x: round(point.x),
            y: round(point.y),
            handleIn: handleIn ? { x: round(handleIn.x), y: round(handleIn.y) } : undefined,
            handleOut: handleOut ? { x: round(handleOut.x), y: round(handleOut.y) } : undefined,
          };
        });
        return { anchors, closed: subpath.closed };
      })
      .filter((subpath) => subpath.anchors.length >= 2);
    for (const subpath of transformed) {
      subpaths.push(subpath);
      paints.push(elementPaint);
    }
  };

  Array.from(root.children).forEach((child) => walk(child, fit, paintFrom(root, { fill: '#000000', stroke: 'none', strokeWidth: 0 })));
  if (!subpaths.length) throw new Error('That SVG has no paths this editor can read');

  const rings = nestSubpaths(subpaths);
  const baseName = options.name ?? 'Imported SVG';
  // Paint is tracked per produced subpath, so use the first element's paint as
  // the shape's own: an imported logo is usually a single colour anyway.
  const paint = paints[0] ?? { fill: '#000000', stroke: 'none', strokeWidth: 0 };
  const pathsFromRings = rings.length;
  const paths = rings.map((ring, index) =>
    buildPath(ring, paint, pathsFromRings > 1 ? `${baseName} ${index + 1}` : baseName)
  );
  return { paths, skipped: Array.from(new Set(skipped)) };
}

/** The anchors the compound path produced → one editable object. */
function buildPath(
  ring: { anchors: AnchorPoint[]; holes: AnchorPoint[][]; closed: boolean },
  paint: { fill: string; stroke: string; strokeWidth: number },
  name: string
): VectorPath {
  const fill = paint.fill && paint.fill !== 'none' ? paint.fill : 'none';
  const stroke = paint.stroke && paint.stroke !== 'none' ? paint.stroke : 'none';
  return {
    id: `svg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    points: ring.anchors,
    closed: ring.closed,
    fill,
    fillOpacity: 1,
    stroke,
    strokeWidth: stroke === 'none' ? 0 : paint.strokeWidth || 1,
    strokeOpacity: 1,
    strokeCap: 'round',
    strokeJoin: 'round',
    pressureProfile: 'uniform',
    ...(ring.holes.length ? { holes: ring.holes } : {}),
    ...(fill === 'none' && stroke === 'none' ? { fill: '#000000' } : {}),
  };
}
