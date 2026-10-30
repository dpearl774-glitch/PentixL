import { AnchorPoint, Point, VectorPath } from '../types/vector';
import { fitBezierPath } from './curveFit';

/**
 * Computes perpendicular distance from point p to the segment (a, b)
 */
function perpendicularDistance(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ex = p.x - a.x;
    const ey = p.y - a.y;
    return Math.sqrt(ex * ex + ey * ey);
  }
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  const diffX = p.x - projX;
  const diffY = p.y - projY;
  return Math.sqrt(diffX * diffX + diffY * diffY);
}

/**
 * Douglas-Peucker polygon simplification algorithm
 */
export function simplifyPoints(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyPoints(points.slice(0, index + 1), tolerance);
    const right = simplifyPoints(points.slice(index), tolerance);
    return [...left.slice(0, -1), ...right];
  }

  return [points[0], points[end]];
}

/**
 * Douglas-Peucker for a closed ring. Closing the ring first lets the splitter
 * treat the seam as the one point it is instead of an arbitrary corner.
 */
function simplifyClosedLoop(points: Point[], tolerance: number): Point[] {
  if (points.length <= 4) return points.slice();
  const closed = simplifyPoints(points.concat([points[0]]), tolerance);
  return closed.slice(0, -1);
}

/**
 * Drops redundant vertices left behind by Douglas-Peucker: near-duplicate
 * points and vertices that are both within `tolerance` of the line joining
 * their neighbours *and* part of a straight run (deflection below
 * `maxDeflection` radians).
 *
 * The deflection guard is what makes it corner-safe. A 90° corner whose
 * neighbours are one unit away sits only 0.707 from their chord, so distance
 * alone would eat every sharp corner of a pixel-scale outline. Requiring the
 * vertex to also be nearly straight means corners, cusps and stair-step jogs
 * always survive, while the long near-collinear runs that make traced output
 * uneditable collapse away.
 */
export function decimateContour(
  points: Point[],
  tolerance: number,
  closed = true,
  maxDeflection = 0.4
): Point[] {
  if (tolerance <= 0 || points.length <= (closed ? 4 : 3)) return points;

  const minCount = closed ? 3 : 2;
  const pts = points.slice();

  // 1. Near-duplicate consecutive points (quantised outlines are full of them)
  for (let i = 0; i < pts.length - 1 && pts.length > minCount; i++) {
    const nxt = pts[i + 1];
    if (Math.hypot(nxt.x - pts[i].x, nxt.y - pts[i].y) < tolerance * 0.5) {
      pts.splice(i + 1, 1);
      i--;
    }
  }

  // 2. Greedy straight-run removal
  const cosLimit = Math.cos(maxDeflection);
  let passes = 0;
  let changed = true;
  while (changed && pts.length > minCount && passes++ < 100) {
    changed = false;
    for (let i = 0; i < pts.length && pts.length > minCount; ) {
      if (!closed && (i === 0 || i === pts.length - 1)) {
        i++;
        continue;
      }
      const prev = pts[(i - 1 + pts.length) % pts.length];
      const next = pts[(i + 1) % pts.length];
      const p = pts[i];

      const ux = p.x - prev.x;
      const uy = p.y - prev.y;
      const vx = next.x - p.x;
      const vy = next.y - p.y;
      const lu = Math.hypot(ux, uy);
      const lv = Math.hypot(vx, vy);

      // Degenerate segment: p duplicates a neighbour, so it carries nothing
      const degenerate = lu < 1e-6 || lv < 1e-6;
      const straight =
        degenerate || (ux * vx + uy * vy) / (lu * lv) >= cosLimit;

      if (straight && perpendicularDistance(p, prev, next) <= tolerance) {
        pts.splice(i, 1);
        changed = true;
        // stay on this index so the re-linked neighbour pair is tested too
        if (i >= pts.length) break;
      } else {
        i++;
      }
    }
  }

  return pts;
}

/**
 * Reduces a closed ring: Douglas-Peucker first, then the corner-safe decimation
 * pass. Shared by the tracer and by the Simplify action on existing paths.
 */
export function simplifyRing(points: Point[], tolerance: number): Point[] {
  if (tolerance <= 0 || points.length < 4) return points.slice();
  return decimateContour(simplifyClosedLoop(points, tolerance), tolerance, true);
}

/**
 * Fits corners and curves onto a polygon, placing an anchor only where the
 * outline actually bends. Tracing used to produce one anchor per surviving
 * raster vertex; the fitter below returns curve endpoints and true corners,
 * with fitted handles on the smooth nodes so the shape is unchanged.
 */
export function fitSmoothBezierCurves(
  rawPoints: Point[],
  idPrefix: string,
  closed: boolean = true,
  tolerance?: number,
  cornerAngle?: number
): AnchorPoint[] {
  return fitBezierPath(rawPoints, {
    idPrefix,
    closed,
    tolerance,
    ...(cornerAngle !== undefined ? { cornerAngle } : {}),
  });
}

/* ------------------------------------------------------------------------ *
 * Iso-contours
 *
 * Tracing a hard-edged pixel mask can only ever follow the pixel grid, so a
 * 300px-wide glyph arrives as a staircase of hundreds of anchors that then has
 * to be "smoothed" back into the shape it was. Marching squares against the
 * anti-aliased coverage field puts every vertex wherever the glyph edge
 * actually is — roughly a third of a pixel — so the same outline survives with
 * a dozen anchors instead of hundreds, and counters (the bowls of o, p, a, b)
 * come out as their own closed rings instead of being welded into the
 * silhouette.
 * ------------------------------------------------------------------------ */

interface Ring {
  points: Point[];
  /** A grid point known to sit inside the enclosed region (for nesting tests) */
  sample: Point;
}

function signedArea(points: Point[]): number {
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function pointInPolygon(pt: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    const crosses =
      a.y > pt.y !== b.y > pt.y &&
      pt.x < ((b.x - a.x) * (pt.y - a.y)) / (b.y - a.y) + a.x;
    if (crosses) inside = !inside;
  }
  return inside;
}

/**
 * Extracts the iso-lines of `field` (values >= iso are foreground) as closed
 * rings with sub-pixel vertex positions. The field is padded with zeros so
 * every ring closes even when the subject touches the image border.
 */
function marchIsoRings(
  field: Float32Array,
  width: number,
  height: number,
  iso: number
): Ring[] {
  if (width < 2 || height < 2) return [];

  const W = width + 2;
  const H = height + 2;
  const edgeCount = W * H * 2;

  const pointX = new Float32Array(edgeCount);
  const pointY = new Float32Array(edgeCount);
  const sampleX = new Float32Array(edgeCount);
  const sampleY = new Float32Array(edgeCount);
  /** bit 1 = vertex computed, bit 2 = sample computed */
  const flags = new Uint8Array(edgeCount);
  const adjA = new Int32Array(edgeCount).fill(-1);
  const adjB = new Int32Array(edgeCount).fill(-1);
  const visited = new Uint8Array(edgeCount);

  const at = (x: number, y: number): number =>
    x < 1 || y < 1 || x > width || y > height ? 0 : field[(y - 1) * width + (x - 1)];

  const vertex = (id: number): void => {
    if (flags[id] & 1) return;
    flags[id] |= 1;
    const cell = id >> 1;
    const ex = cell % W;
    const ey = (cell - ex) / W;
    const a = at(ex, ey);
    const b = id & 1 ? at(ex, ey + 1) : at(ex + 1, ey);
    const d = b - a;
    const t = Math.abs(d) < 1e-9 ? 0.5 : Math.min(1, Math.max(0, (iso - a) / d));
    if (id & 1) {
      pointX[id] = ex;
      pointY[id] = ey + t;
    } else {
      pointX[id] = ex + t;
      pointY[id] = ey;
    }
  };

  for (let y = 0; y < H - 1; y++) {
    for (let x = 0; x < W - 1; x++) {
      const tl = at(x, y) >= iso;
      const tr = at(x + 1, y) >= iso;
      const br = at(x + 1, y + 1) >= iso;
      const bl = at(x, y + 1) >= iso;

      const k = (tl ? 1 : 0) | (tr ? 2 : 0) | (br ? 4 : 0) | (bl ? 8 : 0);
      if (k === 0 || k === 15) continue;

      const cell = y * W + x;
      const eTop = cell * 2;
      const eLeft = cell * 2 + 1;
      const eRight = (cell + 1) * 2 + 1;
      const eBottom = (cell + W) * 2;

      const inside = [tl, tr, br, bl];

      const link = (e1: number, e2: number): void => {
        vertex(e1);
        vertex(e2);
        if (adjA[e1] < 0) adjA[e1] = e2;
        else adjB[e1] = e2;
        if (adjA[e2] < 0) adjA[e2] = e1;
        else adjB[e2] = e1;

        if (!(flags[e1] & 2)) {
          flags[e1] |= 2;
          // Nearest inside corner: a grid point that is unambiguously inside the
          // region this segment borders. Used later to nest counters.
          const mx = (pointX[e1] + pointX[e2]) / 2;
          const my = (pointY[e1] + pointY[e2]) / 2;
          let bx = x;
          let by = y;
          let bd = Infinity;
          for (let c = 0; c < 4; c++) {
            if (!inside[c]) continue;
            const cx = c === 1 || c === 2 ? x + 1 : x;
            const cy = c >= 2 ? y + 1 : y;
            const d = (cx - mx) * (cx - mx) + (cy - my) * (cy - my);
            if (d < bd) {
              bd = d;
              bx = cx;
              by = cy;
            }
          }
          sampleX[e1] = bx;
          sampleY[e1] = by;
        }
      };

      switch (k) {
        case 1:
          link(eLeft, eTop);
          break;
        case 2:
          link(eTop, eRight);
          break;
        case 3:
          link(eLeft, eRight);
          break;
        case 4:
          link(eRight, eBottom);
          break;
        case 5:
          link(eLeft, eTop);
          link(eRight, eBottom);
          break;
        case 6:
          link(eTop, eBottom);
          break;
        case 7:
          link(eLeft, eBottom);
          break;
        case 8:
          link(eBottom, eLeft);
          break;
        case 9:
          link(eTop, eBottom);
          break;
        case 10:
          link(eTop, eRight);
          link(eBottom, eLeft);
          break;
        case 11:
          link(eRight, eBottom);
          break;
        case 12:
          link(eRight, eLeft);
          break;
        case 13:
          link(eTop, eRight);
          break;
        case 14:
          link(eLeft, eTop);
          break;
        default:
          break;
      }
    }
  }

  const rings: Ring[] = [];

  for (let start = 0; start < edgeCount; start++) {
    if (!(flags[start] & 1) || visited[start] || adjA[start] < 0) continue;

    const points: Point[] = [];
    // Padded grid coordinate p sits at pixel index p-1, whose centre is p-0.5.
    const sample = { x: sampleX[start] - 0.5, y: sampleY[start] - 0.5 };
    let prev = -1;
    let cur = start;
    let closed = false;

    for (let step = 0; step < edgeCount; step++) {
      points.push({ x: pointX[cur] - 0.5, y: pointY[cur] - 0.5 });
      visited[cur] = 1;

      const n1 = adjA[cur];
      const n2 = adjB[cur];
      let next = -1;
      if (n1 >= 0 && n1 !== prev && !visited[n1]) next = n1;
      else if (n2 >= 0 && n2 !== prev && !visited[n2]) next = n2;
      else if (n1 === start || n2 === start) {
        closed = true;
        break;
      } else break;

      prev = cur;
      cur = next;
      if (cur === start) {
        closed = true;
        break;
      }
    }

    if (closed && points.length >= 3) rings.push({ points, sample });
  }

  return rings;
}

export interface TracedRegion {
  /** Outer outline in image coordinates */
  points: Point[];
  /** Counters (letter bowls, logo cut-outs) belonging to this outline */
  holes: Point[][];
}

/**
 * Turns a coverage field into nested outlines + counters, simplified so the
 * result is editable rather than a wall of anchors.
 */
export function traceFieldRegions(
  field: Float32Array,
  width: number,
  height: number,
  options: { iso?: number; simplify?: number; minArea?: number } = {}
): TracedRegion[] {
  const { iso = 0.5, simplify = 1, minArea = 8 } = options;

  const rings = marchIsoRings(field, width, height, iso);
  if (!rings.length) return [];

  const tolerance = Math.max(0, simplify);
  // Only thin the raw contour. The curve fitter downstream is what reduces the
  // anchor count, and it needs a truthful polyline to fit against.
  const preTolerance = Math.max(0.3, tolerance * 0.5);

  const shapes = rings
    .map((ring) => {
      const simplified = simplifyRing(ring.points, preTolerance);
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of simplified) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      return {
        points: simplified,
        sample: ring.sample,
        area: Math.abs(signedArea(simplified)),
        minX,
        minY,
        maxX,
        maxY,
      };
    })
    .filter((s) => s.points.length >= 3 && s.area >= minArea);

  if (!shapes.length) return [];

  // Nesting depth decides outline vs counter. A ring's sample point is inside
  // the region it encloses, so counting how many larger rings contain it gives
  // its depth; even depth is solid, odd depth is a hole.
  const depth = new Array<number>(shapes.length).fill(0);
  const parent = new Array<number>(shapes.length).fill(-1);

  for (let i = 0; i < shapes.length; i++) {
    const s = shapes[i];
    for (let j = 0; j < shapes.length; j++) {
      if (i === j) continue;
      const o = shapes[j];
      if (o.area <= s.area) continue;
      if (
        s.sample.x < o.minX ||
        s.sample.x > o.maxX ||
        s.sample.y < o.minY ||
        s.sample.y > o.maxY
      )
        continue;
      if (!pointInPolygon(s.sample, o.points)) continue;
      depth[i]++;
      if (parent[i] < 0 || o.area < shapes[parent[i]].area) parent[i] = j;
    }
  }

  const regions: TracedRegion[] = [];
  const regionOf = new Map<number, number>();

  for (let i = 0; i < shapes.length; i++) {
    if (depth[i] % 2 !== 0) continue;
    regionOf.set(i, regions.length);
    regions.push({ points: shapes[i].points, holes: [] });
  }

  for (let i = 0; i < shapes.length; i++) {
    if (depth[i] % 2 === 0) continue;
    const owner = regionOf.get(parent[i]);
    if (owner !== undefined) regions[owner].holes.push(shapes[i].points);
  }

  return regions;
}

/**
 * Builds a 0..1 coverage field from pixel data. Using the anti-aliased
 * luminance rather than a hard threshold is what gives the contour extractor
 * sub-pixel positions.
 */
export function buildCoverageField(
  imageData: ImageData,
  threshold = 128,
  invert = false
): Float32Array {
  const { width, height, data } = imageData;
  const field = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3];
    const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const coverage = (1 - lum) * (a / 255);
    field[i] = invert ? 1 - coverage : coverage;
  }
  return field;
}

/**
 * Traces an ImageData object into VectorPath objects.
 */
export function traceImageToVectorPaths(
  imageData: ImageData,
  options: {
    threshold?: number;       // 0 to 255 (default 128)
    invert?: boolean;
    simplification?: number;  // vertex tolerance in raster pixels (default 1)
    /** Maximum curve deviation in raster pixels (defaults to `simplification`) */
    fitTolerance?: number;
    /** Direction change, in radians, that counts as a corner (default ~57°) */
    cornerAngle?: number;
    minArea?: number;         // smallest enclosed area worth keeping, px²
    /** Keep counters (the inside of o, p, a) as real holes */
    includeHoles?: boolean;
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    namePrefix?: string;
  } = {}
): VectorPath[] {
  const {
    threshold = 128,
    invert = false,
    simplification = 1,
    fitTolerance: fitToleranceOption,
    cornerAngle,
    minArea = 8,
    includeHoles = true,
    fillColor = '#4C8DFF',
    strokeColor = '#4C8DFF',
    strokeWidth = 2,
    namePrefix = 'Traced Shape',
  } = options;

  const { width, height } = imageData;

  const field = buildCoverageField(imageData, threshold, invert);
  // The iso-level is where coverage equals the chosen threshold; inverting the
  // field mirrors it, so mirror the level too.
  const iso = invert ? threshold / 255 : 1 - threshold / 255;

  const regions = traceFieldRegions(field, width, height, {
    iso,
    simplify: simplification,
    minArea,
  });

  // A fit tolerance above one raster pixel lets a single cubic span a stem and
  // a terminal, which is what rounds letters off. Sub-pixel keeps the curve on
  // the edge it was traced from.
  const fitTolerance = Math.max(0.05, fitToleranceOption ?? Math.max(0.6, simplification));

  return regions.map((region, idx) => {
    const holes = includeHoles
      ? region.holes.map((hole, holeIdx) =>
          fitSmoothBezierCurves(
            hole,
            `traced-${idx}-hole-${holeIdx}`,
            true,
            fitTolerance,
            cornerAngle
          )
        )
      : [];

    return {
      id: `traced-path-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${namePrefix} ${idx + 1}`,
      points: fitSmoothBezierCurves(
        region.points,
        `traced-${idx}`,
        true,
        fitTolerance,
        cornerAngle
      ),
      ...(holes.length > 0 ? { holes } : {}),
      closed: true,
      fill: fillColor,
      fillOpacity: 1,
      stroke: strokeColor,
      strokeWidth,
      strokeOpacity: 1,
      strokeCap: 'round',
      strokeJoin: 'round',
      pressureProfile: 'uniform',
    } as VectorPath;
  });
}

/**
 * Converts a text string into VectorPath objects by rendering text to an offscreen canvas
 * and vector-tracing its silhouette contours into smooth Bezier curves.
 */
export function expandTextToVectorPaths(
  text: string,
  options: {
    fontSize?: number;
    fontFamily?: string;
    fontWeight?: string;
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    originX?: number;
    originY?: number;
  } = {}
): VectorPath[] {
  if (!text || text.trim().length === 0) return [];

  const {
    fontSize = 72,
    fontFamily = 'Plus Jakarta Sans, sans-serif',
    fontWeight = 'bold',
    fillColor = '#4C8DFF',
    strokeColor = '#E8EAED',
    strokeWidth = 2,
    originX = 100,
    originY = 200,
  } = options;

  if (typeof document === 'undefined') return [];

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return [];

  // Setup font
  const fontSpec = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.font = fontSpec;
  const metrics = ctx.measureText(text);

  const pad = 24;
  // Supersample so tight joins and thin strokes keep their shape, but cap the
  // raster area: a long line of text at 3× would otherwise allocate a field of
  // tens of megabytes on a phone.
  const probeWidth = Math.ceil(metrics.width) + pad * 2;
  const probeHeight = Math.ceil(
    (metrics.actualBoundingBoxAscent || fontSize * 0.8) +
      (metrics.actualBoundingBoxDescent || fontSize * 0.25)
  ) + pad * 2;
  // Upsampling before tracing is the one lever that improves fidelity for free:
  // a raster pixel becomes a smaller slice of the glyph, so the polyline the
  // fitter sees is a closer stand-in for the font's own outline.
  const scale = Math.max(
    2,
    Math.min(4, Math.sqrt(4_000_000 / Math.max(1, probeWidth * probeHeight)))
  );
  const ascent = metrics.actualBoundingBoxAscent || fontSize * 0.8;
  const descent = metrics.actualBoundingBoxDescent || fontSize * 0.25;
  const textWidth = Math.ceil(metrics.width) + pad * 2;
  const textHeight = Math.ceil(ascent + descent) + pad * 2;

  canvas.width = Math.ceil(textWidth * scale);
  canvas.height = Math.ceil(textHeight * scale);

  ctx.scale(scale, scale);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, textWidth, textHeight);

  ctx.font = fontSpec;
  ctx.fillStyle = '#000000';
  // The live text draws its baseline at the path's origin, so draw this one on
  // the same baseline and the outline lands exactly where the text was.
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.fillText(text, pad, pad + ascent);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const tracedPaths = traceImageToVectorPaths(imgData, {
    threshold: 128,
    // Tolerances are in raster pixels, so they shrink with the supersample
    // instead of growing with the letter: ~0.2 artboard units of deviation at
    // any font size, which is Potrace's default (0.2 px) rather than a tenth of
    // a stem. The corner angle is tighter than the 57° default because joins,
    // terminals and apexes of type sit well inside that, and a join read as a
    // curve is exactly how a letter looks melted.
    simplification: 0.4 * scale,
    fitTolerance: 0.22 * scale,
    cornerAngle: 0.62,
    minArea: 6,
    includeHoles: true,
    fillColor,
    strokeColor,
    strokeWidth,
    namePrefix: `Glyph "${text}"`,
  });

  const mapPoint = (pt: AnchorPoint): AnchorPoint => ({
    ...pt,
    x: pt.x / scale + originX - pad,
    y: pt.y / scale + originY - (pad + ascent),
    handleIn: pt.handleIn
      ? {
          x: pt.handleIn.x / scale + originX - pad,
          y: pt.handleIn.y / scale + originY - (pad + ascent),
        }
      : undefined,
    handleOut: pt.handleOut
      ? {
          x: pt.handleOut.x / scale + originX - pad,
          y: pt.handleOut.y / scale + originY - (pad + ascent),
        }
      : undefined,
  });

  return tracedPaths.map((p) => ({
    ...p,
    points: p.points.map(mapPoint),
    ...(p.holes ? { holes: p.holes.map((hole) => hole.map(mapPoint)) } : {}),
  }));
}
