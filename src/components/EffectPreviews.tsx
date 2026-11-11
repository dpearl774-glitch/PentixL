import React from 'react';
import { WarpKind } from '../types/vector';
import { warpPoint } from '../utils/warpMath';
import { warpFold } from '../utils/warpFold';
import { TextPathAlign } from '../utils/textPath';

/**
 * Previews for the effect panels. Illustrator shows a style's shape before you
 * apply it; a list of names made the warp panel a guessing game, so every style
 * draws a warped grid and the current setting gets a larger live one.
 */

const IS_PERCENT: ReadonlySet<WarpKind> = new Set<WarpKind>([
  'bulge',
  'pinch',
  'perspective',
  'fisheye',
  'inflate',
  'twist',
]);

/** Fits an artboard-sized amount into the thumbnail's 34 × 20 box. */
function thumbnailBend(kind: WarpKind, amount?: number): number {
  if (amount === undefined) return IS_PERCENT.has(kind) ? 40 : 4;
  if (IS_PERCENT.has(kind)) return Math.max(-85, Math.min(85, amount * 0.85));
  // The panel now allows far stronger bends, so the thumbnail has to show them
  // instead of saturating at a few pixels and looking unchanged.
  return Math.max(-14, Math.min(14, amount * 0.16));
}

const THUMB = { minX: -17, minY: -10, width: 34, height: 20 };

export const WarpThumb: React.FC<{
  kind: WarpKind;
  amount?: number;
  className?: string;
  /** Tint the region the envelope would turn inside out */
  showFold?: boolean;
}> = ({ kind, amount, className = 'h-5 w-8', showFold = false }) => {
  const spec = { kind, amount: thumbnailBend(kind, amount), sway: 0, cycles: 1 };
  const fold = showFold ? warpFold(THUMB, spec) : null;
  const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 0.9 } as const;
  const lines: React.ReactNode[] = [];

  const pointAt = (x: number, y: number) => {
    const moved = warpPoint(x, y, THUMB, spec);
    return `${moved.x.toFixed(2)},${moved.y.toFixed(2)}`;
  };

  for (let row = 0; row < 3; row += 1) {
    const y = -10 + row * 10;
    const points = [-17, 0, 17].map((x) => pointAt(x, y)).join(' ');
    lines.push(<polyline key={`h${row}`} points={points} {...stroke} />);
  }
  for (let column = 0; column < 5; column += 1) {
    const x = -17 + column * 8.5;
    const points = [-10, 0, 10].map((y) => pointAt(x, y)).join(' ');
    lines.push(<polyline key={`v${column}`} points={points} {...stroke} />);
  }

  return (
    <svg
      viewBox="-19 -13 38 26"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      role="img"
      aria-label={`${kind} warp preview`}
    >
      {lines}
      {fold?.folded &&
        fold.samples
          .filter((cell) => !Number.isFinite(cell.det) || cell.det <= 0.02)
          .map((cell, index) => (
            <rect
              key={`fold-${index}`}
              x={cell.x}
              y={cell.y}
              width={cell.width}
              height={cell.height}
              fill="#ff5d5d"
              opacity={0.22}
            />
          ))}
    </svg>
  );
};

const ALIGN_LINE: Record<TextPathAlign, number> = {
  baseline: 0,
  center: -3.2,
  ascender: -6,
  descender: 1.6,
};

/** A curve with the string's line sitting where that alignment puts it. */
export const PathAlignThumb: React.FC<{
  align: TextPathAlign;
  className?: string;
}> = ({ align, className = 'h-4 w-7' }) => (
  <svg viewBox="0 0 28 16" className={className} role="img" aria-label={`${align} alignment`}>
    <path
      d="M2 12 Q 14 3 26 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="0.9"
      opacity="0.55"
    />
    <rect
      x="5"
      y={12 + ALIGN_LINE[align] - 1.6}
      width="18"
      height="3.2"
      rx="1"
      fill="currentColor"
    />
  </svg>
);
