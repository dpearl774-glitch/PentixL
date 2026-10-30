import React from 'react';
import { Minus, Plus, Check } from 'lucide-react';
import { ShapeKind } from '../types/vector';
import { Button, IconButton, SectionLabel, Sheet } from './ui/primitives';

interface ShapeSheetProps {
  open: boolean;
  onClose: () => void;
  selectedShape: ShapeKind;
  sides: number;
  onSelectShape: (kind: ShapeKind) => void;
  onChangeSides: (sides: number) => void;
}

const SHAPES: { kind: ShapeKind; label: string; d: string }[] = [
  { kind: 'rectangle', label: 'Square', d: 'M 10 10 H 90 V 90 H 10 Z' },
  { kind: 'rounded-rect', label: 'Rounded', d: 'M 28 10 H 72 A 18 18 0 0 1 90 28 V 72 A 18 18 0 0 1 72 90 H 28 A 18 18 0 0 1 10 72 V 28 A 18 18 0 0 1 28 10 Z' },
  { kind: 'circle', label: 'Circle', d: 'M 50 10 A 40 40 0 1 0 50 90 A 40 40 0 1 0 50 10 Z' },
  { kind: 'semicircle', label: 'Dome', d: 'M 10 80 A 40 40 0 0 1 90 80 Z' },
  { kind: 'triangle', label: 'Triangle', d: 'M 50 12 L 90 88 H 10 Z' },
  { kind: 'polygon', label: 'Polygon', d: 'M 50 10 L 87 32 L 87 75 L 50 97 L 13 75 L 13 32 Z' },
  { kind: 'octagon', label: 'Octagon', d: 'M 35 10 H 65 L 90 35 V 65 L 65 90 H 35 L 10 65 V 35 Z' },
  { kind: 'star', label: 'Star', d: 'M 50 10 L 62 38 L 92 40 L 69 58 L 77 88 L 50 71 L 23 88 L 31 58 L 8 40 L 38 38 Z' },
  { kind: 'star8', label: 'Star 8', d: 'M 50 10 L 61 27 L 78 12 L 73 33 L 93 38 L 77 50 L 93 62 L 73 67 L 78 88 L 61 73 L 50 90 L 39 73 L 22 88 L 27 67 L 7 62 L 23 50 L 7 38 L 27 33 L 22 12 L 39 27 Z' },
  { kind: 'heart', label: 'Heart', d: 'M 50 30 C 50 15, 20 10, 20 35 C 20 60, 50 80, 50 90 C 50 80, 80 60, 80 35 C 80 10, 50 15, 50 30 Z' },
  { kind: 'shield', label: 'Shield', d: 'M 15 15 H 85 V 50 C 85 75, 50 90, 50 90 C 50 90, 15 75, 15 50 Z' },
  { kind: 'arrow', label: 'Arrow', d: 'M 10 35 H 55 V 15 L 90 50 L 55 85 V 65 H 10 Z' },
  { kind: 'diamond', label: 'Diamond', d: 'M 50 10 L 90 50 L 50 90 L 10 50 Z' },
  { kind: 'pill', label: 'Pill', d: 'M 30 20 H 70 A 30 30 0 0 1 70 80 H 30 A 30 30 0 0 1 30 20 Z' },
  { kind: 'crescent', label: 'Crescent', d: 'M 50 10 A 40 40 0 0 1 90 70 A 35 35 0 1 0 50 10 Z' },
  { kind: 'ring', label: 'Ring', d: 'M 50 10 A 40 40 0 1 0 50 90 A 40 40 0 1 0 50 10 M 50 32 A 18 18 0 1 1 50 68 A 18 18 0 1 1 50 32 Z' },
  { kind: 'line', label: 'Line', d: 'M 12 50 H 88' },
];

export const ShapeSheet: React.FC<ShapeSheetProps> = ({
  open,
  onClose,
  selectedShape,
  sides,
  onSelectShape,
  onChangeSides,
}) => (
  <Sheet
    open={open}
    onClose={onClose}
    title="Shapes"
    eyebrow="Insert"
    subtitle="Pick a shape, then drag to size it."
    footer={
      <Button variant="primary" block onClick={onClose}>
        <Check size={15} /> Draw “{selectedShape.replace('-', ' ')}”
      </Button>
    }
  >
    <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
      {SHAPES.map((s) => {
        const active = selectedShape === s.kind;
        return (
          <button
            key={s.kind}
            type="button"
            onClick={() => onSelectShape(s.kind)}
            className={`press flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border ${
              active
                ? 'border-accent/60 bg-accent/10 text-accent'
                : 'border-line bg-ink-2 text-dim hover:border-line-strong hover:text-text'
            }`}
          >
            <svg viewBox="0 0 100 100" className="h-7 w-7" aria-hidden>
              <path
                d={s.d}
                fill={s.kind === 'line' ? 'none' : 'currentColor'}
                fillOpacity={0.18}
                stroke="currentColor"
                strokeWidth={4}
                strokeLinejoin="round"
              />
            </svg>
            <span className="font-mono text-[8.5px] uppercase tracking-wide">{s.label}</span>
          </button>
        );
      })}
    </div>

    {selectedShape === 'polygon' && (
      <div className="mt-4 flex items-center justify-between rounded-xl border border-line bg-ink-0 px-3 py-2">
        <SectionLabel>Sides</SectionLabel>
        <div className="flex items-center gap-2">
          <IconButton
            label="Fewer sides"
            size="sm"
            onClick={() => onChangeSides(Math.max(3, sides - 1))}
          >
            <Minus size={13} />
          </IconButton>
          <span className="w-6 text-center font-mono text-[13px] font-bold text-accent">{sides}</span>
          <IconButton
            label="More sides"
            size="sm"
            onClick={() => onChangeSides(Math.min(12, sides + 1))}
          >
            <Plus size={13} />
          </IconButton>
        </div>
      </div>
    )}

  </Sheet>
);
