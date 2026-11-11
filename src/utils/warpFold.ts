import { WarpSpec } from '../types/vector';
import { WarpBox, warpPoint } from './warpMath';

/**
 * Where a warp stops being a warp and starts turning the artwork inside out.
 *
 * The envelope's local behaviour is its Jacobian: determinant > 0 means area is
 * still oriented the way it started, 0 means the surface is pinched to nothing,
 * and < 0 means the region has flipped — letters cross each other and the bend
 * reads as a fold. Sampling the determinant on a grid is the cheap, honest test
 * (bilinear cells make it exact at the sample points), and it is what lets the
 * slider go past a fixed number instead of guessing a limit up front.
 */
export interface FoldSample {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Jacobian determinant at the cell centre */
  det: number;
}

export interface FoldReport {
  folded: boolean;
  /** Share of the box that is inside a fold, 0–1 */
  ratio: number;
  samples: FoldSample[];
}

const FOLD_THRESHOLD = 0.02;

export function warpFold(box: WarpBox, spec: WarpSpec, columns = 9, rows = 7): FoldReport {
  const width = Math.max(1, box.width);
  const height = Math.max(1, box.height);
  const delta = Math.max(0.5, Math.min(width, height) / 24);
  const cellW = width / columns;
  const cellH = height / rows;
  const samples: FoldSample[] = [];
  let foldedCells = 0;

  const determinant = (x: number, y: number) => {
    const right = warpPoint(x + delta, y, box, spec);
    const left = warpPoint(x - delta, y, box, spec);
    const down = warpPoint(x, y + delta, box, spec);
    const up = warpPoint(x, y - delta, box, spec);
    const a = (right.x - left.x) / (2 * delta);
    const c = (right.y - left.y) / (2 * delta);
    const b = (down.x - up.x) / (2 * delta);
    const d = (down.y - up.y) / (2 * delta);
    return a * d - c * b;
  };

  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < rows; row += 1) {
      const x = box.minX + (column + 0.5) * cellW;
      const y = box.minY + (row + 0.5) * cellH;
      const det = determinant(x, y);
      if (!Number.isFinite(det) || det <= FOLD_THRESHOLD) foldedCells += 1;
      samples.push({
        x: box.minX + column * cellW,
        y: box.minY + row * cellH,
        width: cellW,
        height: cellH,
        det,
      });
    }
  }

  return {
    folded: foldedCells > 0,
    ratio: samples.length ? foldedCells / samples.length : 0,
    samples,
  };
}
