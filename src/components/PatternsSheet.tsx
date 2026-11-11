import React, { useState } from 'react';
import { PatternSwatch } from '../types/vector';
import { patternFromSwatch, patternLayout, patternTransform } from '../utils/effects';
import { pathToSvgD } from '../utils/bezier';
import { Button, IconButton, SectionLabel, Sheet } from './ui/primitives';
import { Check, Plus, Trash2 } from 'lucide-react';

interface PatternsSheetProps {
  open: boolean;
  onClose: () => void;
  swatches: PatternSwatch[];
  /** Saves the current selection as a new swatch */
  onSaveFromSelection: () => void;
  /** Fills the current selection with a swatch */
  onApply: (id: string) => void;
  onUpdate: (id: string, patch: Partial<PatternSwatch>) => void;
  onDelete: (id: string) => void;
  hasSelection: boolean;
}

const TILE_TYPES: { type: NonNullable<PatternSwatch['tileType']>; label: string }[] = [
  { type: 'grid', label: 'Grid' },
  { type: 'brick-row', label: 'Brick ↓' },
  { type: 'brick-column', label: 'Brick →' },
  { type: 'hex', label: 'Hex' },
];

/** One tile of the swatch, drawn from the same layout the canvas uses. */
const SwatchPreview: React.FC<{ swatch: PatternSwatch }> = ({ swatch }) => {
  const layout = patternLayout(patternFromSwatch(swatch));
  const tiles = layout.copies.flatMap((copy, copyIndex) =>
    swatch.paths.map((tile, tileIndex) => {
      const d = pathToSvgD(tile);
      if (!d) return null;
      return (
        <path
          key={`${copyIndex}-${tileIndex}`}
          d={d}
          transform={`translate(${copy.dx} ${copy.dy})`}
          fill={tile.fill}
          fillOpacity={tile.fillOpacity ?? 1}
          fillRule="evenodd"
          stroke={tile.stroke}
          strokeWidth={tile.strokeWidth}
        />
      );
    })
  );

  return (
    <svg
      viewBox={`0 0 ${layout.width * 2} ${layout.height * 2}`}
      preserveAspectRatio="xMidYMid slice"
      className="h-14 w-full rounded-md border border-line bg-white"
      aria-label={`${swatch.name} preview`}
    >
      <defs>
        <pattern
          id={`swatch-preview-${swatch.id}`}
          patternUnits="userSpaceOnUse"
          width={layout.width}
          height={layout.height}
          patternTransform={patternTransform(patternFromSwatch(swatch))}
        >
          <g transform={`scale(${layout.scale})`}>{tiles}</g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#swatch-preview-${swatch.id})`} />
    </svg>
  );
};

/**
 * The document's pattern library. A swatch is paint, not an object: it can be
 * applied to anything, and editing it repaints every shape that uses it.
 */
export const PatternsSheet: React.FC<PatternsSheetProps> = ({
  open,
  onClose,
  swatches,
  onSaveFromSelection,
  onApply,
  onUpdate,
  onDelete,
  hasSelection,
}) => {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = swatches.find((swatch) => swatch.id === activeId) ?? null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Patterns"
      eyebrow="Library"
      subtitle="Named pattern swatches. Saved with the document."
      size="md"
      action={
        <IconButton
          label="Save selection as pattern"
          size="sm"
          onClick={() => {
            onSaveFromSelection();
          }}
        >
          <Plus size={15} />
        </IconButton>
      }
    >
      <div className="flex flex-col gap-2.5 pb-1">
        <div className="flex items-center justify-between">
          <SectionLabel>Swatches · {swatches.length}</SectionLabel>
          <button
            type="button"
            onClick={() => onSaveFromSelection()}
            disabled={!hasSelection}
            className="press flex h-8 items-center gap-1 rounded-lg border border-line bg-ink-2 px-2.5 text-[11px] font-semibold text-dim disabled:opacity-40"
          >
            <Plus size={12} /> From selection
          </button>
        </div>

        {swatches.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-line px-3 py-8 text-center">
            <p className="text-[12px] text-mute">
              Draw a motif, select it, then save it here to reuse anywhere.
            </p>
            <Button size="sm" variant="secondary" disabled={!hasSelection} onClick={onSaveFromSelection}>
              Save selection as pattern
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {swatches.map((swatch) => (
              <div
                key={swatch.id}
                className={`rounded-lg border p-1.5 ${
                  activeId === swatch.id ? 'border-accent bg-ink-2' : 'border-line bg-ink-2/70'
                }`}
              >
                <button
                  type="button"
                  className="block w-full"
                  onClick={() => setActiveId(swatch.id)}
                  aria-label={`Select pattern ${swatch.name}`}
                >
                  <SwatchPreview swatch={swatch} />
                  <span className="mt-1 block truncate text-left text-[11px] font-semibold text-text">
                    {swatch.name}
                  </span>
                </button>
                <Button
                  size="sm"
                  variant="secondary"
                  className="mt-1 w-full"
                  disabled={!hasSelection}
                  onClick={() => onApply(swatch.id)}
                >
                  <Check size={12} /> Apply
                </Button>
              </div>
            ))}
          </div>
        )}

        {active && (
          <div className="rounded-lg border border-line bg-ink-2/80 p-2">
            <div className="flex items-center justify-between">
              <SectionLabel>{active.name}</SectionLabel>
              <IconButton label="Delete pattern" size="sm" tone="danger" onClick={() => onDelete(active.id)}>
                <Trash2 size={13} />
              </IconButton>
            </div>
            <input
              value={active.name}
              onChange={(e) => onUpdate(active.id, { name: e.target.value.slice(0, 80) })}
              aria-label="Pattern name"
              className="mt-1 h-8 w-full rounded-md border border-line bg-ink-1 px-2 text-[12px] text-text"
            />
            <div className="mt-2 grid grid-cols-3 gap-1">
              {TILE_TYPES.map(({ type, label }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => onUpdate(active.id, { tileType: type })}
                  className={`press h-7 rounded-md text-[10px] font-semibold ${
                    (active.tileType ?? 'grid') === type
                      ? 'bg-accent/20 text-accent'
                      : 'bg-ink-3 text-dim hover:text-accent'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-1.5 flex items-center justify-between px-1">
              <span className="font-sans text-[9px] uppercase tracking-wider text-mute">Spacing</span>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  aria-label="Tighter spacing"
                  onClick={() =>
                    onUpdate(active.id, { spacing: Math.max(0, (active.spacing ?? 0) - 2) })
                  }
                  className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
                >
                  −
                </button>
                <span className="w-8 text-center font-mono text-[10px] font-bold text-text">
                  {active.spacing ?? 0}
                </span>
                <button
                  type="button"
                  aria-label="Looser spacing"
                  onClick={() =>
                    onUpdate(active.id, { spacing: Math.min(400, (active.spacing ?? 0) + 2) })
                  }
                  className="press grid h-6 w-6 place-items-center rounded-md bg-ink-3 text-dim"
                >
                  +
                </button>
              </div>
            </div>
            <p className="mt-1 px-1 text-[9.5px] leading-snug text-mute">
              Tile artwork is captured from the selection; editing this swatch repaints every shape
              using it.
            </p>
          </div>
        )}
      </div>
    </Sheet>
  );
};
