import { AnchorPoint, Point, VectorPath } from '../types/vector';

/**
 * Computes perpendicular distance from point p to line segment (a, b)
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
 * Fits smooth Catmull-Rom Bezier handles onto closed polygon points.
 * Retains sharp corners where the interior angle is sharp (> 85 degrees deflection).
 */
export function fitSmoothBezierCurves(
  rawPoints: Point[],
  idPrefix: string,
  closed: boolean = true
): AnchorPoint[] {
  const n = rawPoints.length;
  if (n < 2) {
    return rawPoints.map((pt, i) => ({
      id: `${idPrefix}-${i}`,
      x: pt.x,
      y: pt.y,
      type: 'corner' as const,
    }));
  }

  const result: AnchorPoint[] = [];

  for (let i = 0; i < n; i++) {
    const curr = rawPoints[i];
    const prev = rawPoints[(i - 1 + n) % n];
    const next = rawPoints[(i + 1) % n];

    // Inward and outward segment vectors
    const vIn = { x: curr.x - prev.x, y: curr.y - prev.y };
    const vOut = { x: next.x - curr.x, y: next.y - curr.y };

    const lenIn = Math.hypot(vIn.x, vIn.y);
    const lenOut = Math.hypot(vOut.x, vOut.y);

    // If segment is too short or at endpoints of open path, make corner
    if (lenIn < 0.001 || lenOut < 0.001 || (!closed && (i === 0 || i === n - 1))) {
      result.push({
        id: `${idPrefix}-${i}`,
        x: curr.x,
        y: curr.y,
        type: 'corner',
      });
      continue;
    }

    // Dot product to determine angle deflection
    const dot = (vIn.x * vOut.x + vIn.y * vOut.y) / (lenIn * lenOut);
    const angleDeflection = Math.acos(Math.max(-1, Math.min(1, dot))); // 0 is straight line, PI is U-turn

    // Sharp turn (> 85 degrees deflection) should remain crisp corner
    if (angleDeflection > 1.48) {
      result.push({
        id: `${idPrefix}-${i}`,
        x: curr.x,
        y: curr.y,
        type: 'corner',
      });
      continue;
    }

    // Tangent vector through current point using Catmull-Rom
    const tangent = {
      x: (next.x - prev.x) / 2,
      y: (next.y - prev.y) / 2,
    };

    const tanLen = Math.hypot(tangent.x, tangent.y);
    if (tanLen < 0.001) {
      result.push({
        id: `${idPrefix}-${i}`,
        x: curr.x,
        y: curr.y,
        type: 'corner',
      });
      continue;
    }

    // Scale tangent handles proportionally to segment lengths
    const handleScale = 0.333;
    const hInScale = Math.min(handleScale, (lenIn / tanLen) * handleScale);
    const hOutScale = Math.min(handleScale, (lenOut / tanLen) * handleScale);

    result.push({
      id: `${idPrefix}-${i}`,
      x: curr.x,
      y: curr.y,
      type: 'smooth',
      handleIn: {
        x: curr.x - tangent.x * hInScale,
        y: curr.y - tangent.y * hInScale,
      },
      handleOut: {
        x: curr.x + tangent.x * hOutScale,
        y: curr.y + tangent.y * hOutScale,
      },
    });
  }

  return result;
}

/**
 * Traces contours of a binarized 2D grid using 2D boundary following / marching squares.
 */
export function traceBinaryGridContours(
  grid: Uint8Array,
  width: number,
  height: number,
  minContourLength: number = 8
): Point[][] {
  const visited = new Uint8Array(width * height);
  const contours: Point[][] = [];

  const getPixel = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return 0;
    return grid[y * width + x];
  };

  // 8 directions (clockwise from right)
  const dx = [1, 1, 0, -1, -1, -1, 0, 1];
  const dy = [0, 1, 1, 1, 0, -1, -1, -1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x;
      // Find unvisited black pixel next to white pixel (boundary)
      if (grid[idx] === 1 && visited[idx] === 0) {
        let isBoundary = false;
        for (let d = 0; d < 8; d += 2) {
          if (getPixel(x + dx[d], y + dy[d]) === 0) {
            isBoundary = true;
            break;
          }
        }

        if (!isBoundary) continue;

        // Trace contour using Moore neighborhood
        const contour: Point[] = [];
        let cx = x;
        let cy = y;
        let dir = 7;
        let steps = 0;
        const maxSteps = width * height;

        do {
          contour.push({ x: cx, y: cy });
          visited[cy * width + cx] = 1;

          // Look for next boundary neighbor
          let foundNext = false;
          const searchStart = (dir + 5) % 8; // backtrack direction

          for (let i = 0; i < 8; i++) {
            const checkDir = (searchStart + i) % 8;
            const nx = cx + dx[checkDir];
            const ny = cy + dy[checkDir];

            if (getPixel(nx, ny) === 1) {
              cx = nx;
              cy = ny;
              dir = checkDir;
              foundNext = true;
              break;
            }
          }

          if (!foundNext) break;
          steps++;
        } while ((cx !== x || cy !== y) && steps < maxSteps);

        if (contour.length >= minContourLength) {
          contours.push(contour);
        }
      }
    }
  }

  return contours;
}

/**
 * Traces an ImageData object into VectorPath objects.
 */
export function traceImageToVectorPaths(
  imageData: ImageData,
  options: {
    threshold?: number;       // 0 to 255 (default 128)
    invert?: boolean;
    simplification?: number;  // Douglas-Peucker tolerance (default 2)
    minArea?: number;
    fillColor?: string;
    strokeColor?: string;
    strokeWidth?: number;
    namePrefix?: string;
  } = {}
): VectorPath[] {
  const {
    threshold = 128,
    invert = false,
    simplification = 2,
    minArea = 16,
    fillColor = '#CDFF5C',
    strokeColor = '#CDFF5C',
    strokeWidth = 2,
    namePrefix = 'Traced Shape',
  } = options;

  const { width, height, data } = imageData;
  const grid = new Uint8Array(width * height);

  for (let i = 0; i < width * height; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const a = data[i * 4 + 3];

    // Luminance
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    // Binarize
    let isForeground = false;
    if (a < 50) {
      isForeground = false; // transparent is background
    } else {
      isForeground = lum < threshold; // dark pixels are foreground silhouette
    }

    if (invert) isForeground = !isForeground;
    grid[i] = isForeground ? 1 : 0;
  }

  const rawContours = traceBinaryGridContours(grid, width, height, minArea);
  const paths: VectorPath[] = [];

  rawContours.forEach((rawPoints, idx) => {
    // Simplify polygon
    const simplified = simplifyPoints(rawPoints, simplification);
    if (simplified.length < 3) return;

    // Convert into smooth Bezier curves
    const bezierPoints = fitSmoothBezierCurves(simplified, `traced-${idx}`, true);

    paths.push({
      id: `traced-path-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
      name: `${namePrefix} ${idx + 1}`,
      points: bezierPoints,
      closed: true,
      fill: fillColor,
      fillOpacity: 1,
      stroke: strokeColor,
      strokeWidth,
      strokeOpacity: 1,
      strokeCap: 'round',
      strokeJoin: 'round',
      pressureProfile: 'uniform',
    });
  });

  return paths;
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
    fillColor = '#CDFF5C',
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

  const textWidth = Math.ceil(metrics.width) + 40;
  const textHeight = Math.ceil(fontSize * 1.6) + 40;

  // Use 2x supersampling for high fidelity curve contours
  const scale = 2;
  canvas.width = textWidth * scale;
  canvas.height = textHeight * scale;

  ctx.scale(scale, scale);
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, textWidth, textHeight);

  ctx.font = fontSpec;
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillText(text, 20, textHeight / 2);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const tracedPaths = traceImageToVectorPaths(imgData, {
    threshold: 128,
    simplification: 1.2,
    minArea: 10,
    fillColor,
    strokeColor,
    strokeWidth,
    namePrefix: `Glyph "${text}"`,
  });

  // Scale down 2x and translate to origin
  return tracedPaths.map((p) => ({
    ...p,
    points: p.points.map((pt) => ({
      ...pt,
      x: pt.x / scale + originX - 20,
      y: pt.y / scale + originY - textHeight / 2,
      handleIn: pt.handleIn ? { x: pt.handleIn.x / scale + originX - 20, y: pt.handleIn.y / scale + originY - textHeight / 2 } : undefined,
      handleOut: pt.handleOut ? { x: pt.handleOut.x / scale + originX - 20, y: pt.handleOut.y / scale + originY - textHeight / 2 } : undefined,
    })),
  }));
}
