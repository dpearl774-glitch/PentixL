import React, { useEffect, useState } from 'react';
import { Lock, LockOpen, Ruler, Trash2, Grid3x3, Magnet } from 'lucide-react';
import { Guide } from '../types/vector';
import { Button, SectionLabel, Segmented, Sheet } from './ui/primitives';

interface CanvasSettingsSheetProps {
  open: boolean;
  onClose: () => void;
  width: number;
  height: number;
  onResize: (width: number, height: number) => void;
  /* grid */
  gridVisible: boolean;
  onToggleGrid: () => void;
  gridSnap: boolean;
  onToggleGridSnap: () => void;
  gridSpacingX: number;
  gridSpacingY: number;
  onSpacingChange: (x: number, y: number) => void;
  gridOpacity: number;
  onGridOpacityChange: (value: number) => void;
  gridLocked: boolean;
  onToggleGridLock: () => void;
  /* rulers & guides */
  rulersVisible: boolean;
  onToggleRulers: () => void;
  guides: Guide[];
  onUpdateGuide: (id: string, patch: Partial<Guide>) => void;
  onRemoveGuide: (id: string) => void;
  onClearGuides: () => void;
  /* artboard */
  artboardColor: string;
  onEditBackground: () => void;
}

type Unit = 'px' | 'cm' | 'in';

const PX_PER_IN = 96;
const PX_PER_CM = PX_PER_IN / 2.54;
const MAX_DIM = 5000;

const toUnit = (px: number, unit: Unit): number => {
  if (unit === 'px') return Math.round(px);
  if (unit === 'cm') return Math.round((px / PX_PER_CM) * 100) / 100;
  return Math.round((px / PX_PER_IN) * 100) / 100;
};

const fromUnit = (value: number, unit: Unit): number => {
  if (unit === 'px') return Math.round(value);
  if (unit === 'cm') return Math.round(value * PX_PER_CM);
  return Math.round(value * PX_PER_IN);
};

const parseDim = (raw: string): number | null => {
  const n = Number(raw.replace(',', '.').trim());
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return null;
  return n;
};

/** Compact stepper used for grid spacing in px. */
const Stepper: React.FC<{
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}> = ({ label, value, disabled, onChange }) => (
  <div className="flex items-center justify-between gap-2 rounded-xl border border-line bg-ink-0 px-3 py-2">
    <span className="text-[12px] font-semibold text-text">{label}</span>
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        disabled={disabled || value <= 1}
        onClick={() => onChange(Math.max(1, value - 5))}
        className="press grid h-7 w-7 place-items-center rounded-lg border border-line bg-ink-2 text-dim disabled:opacity-30"
        aria-label={`Decrease ${label}`}
      >
        −
      </button>
      <input
        type="number"
        min={1}
        max={500}
        disabled={disabled}
        value={value}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          if (Number.isFinite(n)) onChange(Math.min(500, Math.max(1, n)));
        }}
        className="h-7 w-14 rounded-lg border border-line bg-ink-1 text-center font-mono text-[12px] font-bold text-text outline-none focus:border-accent/60 disabled:opacity-40"
        aria-label={label}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(Math.min(500, value + 5))}
        className="press grid h-7 w-7 place-items-center rounded-lg border border-line bg-ink-2 text-dim disabled:opacity-30"
        aria-label={`Increase ${label}`}
      >
        +
      </button>
      <span className="w-4 font-mono text-[10px] text-mute">px</span>
    </div>
  </div>
);

const Toggle: React.FC<{ on: boolean; onClick: () => void; label: string }> = ({
  on,
  onClick,
  label,
}) => (
  <button
    type="button"
    role="switch"
    aria-checked={on}
    aria-label={label}
    onClick={onClick}
    className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
      on ? 'border-accent bg-accent/25' : 'border-line-strong bg-ink-0'
    }`}
  >
    <span
      className={`absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-all ${
        on ? 'left-[18px] bg-accent' : 'left-[3px] bg-line-strong'
      }`}
    />
  </button>
);

export const CanvasSettingsSheet: React.FC<CanvasSettingsSheetProps> = ({
  open,
  onClose,
  width,
  height,
  onResize,
  gridVisible,
  onToggleGrid,
  gridSnap,
  onToggleGridSnap,
  gridSpacingX,
  gridSpacingY,
  onSpacingChange,
  gridOpacity,
  onGridOpacityChange,
  gridLocked,
  onToggleGridLock,
  rulersVisible,
  onToggleRulers,
  guides,
  onUpdateGuide,
  onRemoveGuide,
  onClearGuides,
  artboardColor,
  onEditBackground,
}) => {
  const [unit, setUnit] = useState<Unit>('px');
  const [wDraft, setWDraft] = useState(String(width));
  const [hDraft, setHDraft] = useState(String(height));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setWDraft(String(toUnit(width, unit)));
    setHDraft(String(toUnit(height, unit)));
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, width, height]);

  const applySize = () => {
    const w = parseDim(wDraft);
    const h = parseDim(hDraft);
    if (w === null || h === null) {
      setError('Enter a positive number for both width and height.');
      return;
    }
    const pxW = fromUnit(w, unit);
    const pxH = fromUnit(h, unit);
    if (pxW < 16 || pxH < 16 || pxW > MAX_DIM || pxH > MAX_DIM) {
      setError(`Size must be between 16 and ${MAX_DIM} px (${(16 / PX_PER_IN).toFixed(2)}–${(MAX_DIM / PX_PER_IN).toFixed(1)} in).`);
      return;
    }
    setError(null);
    onResize(pxW, pxH);
    setWDraft(String(toUnit(pxW, unit)));
    setHDraft(String(toUnit(pxH, unit)));
  };

  const switchUnit = (next: Unit) => {
    setUnit(next);
    setWDraft(String(toUnit(width, next)));
    setHDraft(String(toUnit(height, next)));
    setError(null);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Canvas"
      eyebrow="Document"
      subtitle="Size, grid, rulers and artboard colour"
      size="md"
      footer={
        <Button variant="primary" block onClick={onClose}>
          Done
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        {/* ------------------------------ Size ------------------------------ */}
        <section className="flex flex-col gap-2.5 rounded-xl border border-line bg-ink-0 p-3">
          <div className="flex items-center justify-between">
            <SectionLabel>Artboard size</SectionLabel>
            <Segmented
              className="w-36"
              value={unit}
              onChange={switchUnit}
              options={[
                { value: 'px', label: 'px' },
                { value: 'cm', label: 'cm' },
                { value: 'in', label: 'in' },
              ]}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-mute">Width</span>
              <input
                inputMode="decimal"
                value={wDraft}
                onChange={(e) => setWDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applySize();
                }}
                className="h-9 rounded-lg border border-line bg-ink-1 px-2.5 font-mono text-[13px] font-bold text-text outline-none focus:border-accent/60"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-mono text-[10px] uppercase tracking-wider text-mute">Height</span>
              <input
                inputMode="decimal"
                value={hDraft}
                onChange={(e) => setHDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applySize();
                }}
                className="h-9 rounded-lg border border-line bg-ink-1 px-2.5 font-mono text-[13px] font-bold text-text outline-none focus:border-accent/60"
              />
            </label>
          </div>

          {error && <p className="text-[11.5px] text-danger">{error}</p>}

          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-mute">
              {width} × {height} px now · artwork stays in place
            </span>
            <Button variant="primary" size="sm" onClick={applySize}>
              Apply
            </Button>
          </div>
        </section>

        {/* ------------------------------ Grid ------------------------------ */}
        <section className="flex flex-col gap-2 rounded-xl border border-line bg-ink-0 p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Grid3x3 size={14} className="text-accent" />
              <SectionLabel>Grid</SectionLabel>
            </span>
            <span className="flex items-center gap-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-mute">
                {gridLocked ? 'Locked' : 'Unlocked'}
              </span>
              <button
                type="button"
                onClick={onToggleGridLock}
                aria-pressed={gridLocked}
                aria-label={gridLocked ? 'Unlock grid' : 'Lock grid'}
                className={`press grid h-7 w-7 place-items-center rounded-lg border ${
                  gridLocked ? 'border-accent bg-accent text-ink-0' : 'border-line bg-ink-2 text-dim'
                }`}
              >
                {gridLocked ? <Lock size={13} /> : <LockOpen size={13} />}
              </button>
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-line bg-ink-1 px-3 py-2">
            <span className="flex items-center gap-2 text-[12px] font-semibold text-text">
              Show gridlines
            </span>
            <Toggle on={gridVisible} onClick={onToggleGrid} label="Show grid" />
          </div>

          <Stepper
            label="Horizontal"
            value={gridSpacingX}
            disabled={gridLocked}
            onChange={(x) => onSpacingChange(x, gridSpacingY)}
          />
          <Stepper
            label="Vertical"
            value={gridSpacingY}
            disabled={gridLocked}
            onChange={(y) => onSpacingChange(gridSpacingX, y)}
          />

          <div className={`flex items-center gap-2 ${gridLocked ? 'opacity-50' : ''}`}>
            <span className="w-20 font-mono text-[10px] uppercase tracking-wider text-mute">Lines</span>
            <input
              type="range"
              min={5}
              max={100}
              step={5}
              value={Math.round(gridOpacity * 100)}
              disabled={gridLocked}
              onChange={(e) => onGridOpacityChange(parseInt(e.target.value, 10) / 100)}
              aria-label="Grid line visibility"
              className="min-w-0 flex-1"
            />
            <span className="w-9 text-right font-mono text-[11px] font-bold text-dim">
              {Math.round(gridOpacity * 100)}%
            </span>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-line bg-ink-1 px-3 py-2">
            <span className="flex items-center gap-2 text-[12px] font-semibold text-text">
              <Magnet size={14} className={gridSnap ? 'text-accent' : 'text-mute'} />
              Snap objects to grid
            </span>
            <Toggle on={gridSnap} onClick={onToggleGridSnap} label="Snap to grid" />
          </div>

          <p className="text-[11px] leading-snug text-mute">
            {gridLocked
              ? 'Locked — spacing and appearance are fixed. Visibility and snapping still work, and artwork stays editable.'
              : 'Locking freezes spacing and appearance only; it never blocks editing artwork.'}
          </p>
        </section>

        {/* -------------------------- Rulers & guides -------------------------- */}
        <section className="flex flex-col gap-2 rounded-xl border border-line bg-ink-0 p-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Ruler size={14} className="text-accent" />
              <SectionLabel>Rulers & guides</SectionLabel>
            </span>
            <Toggle on={rulersVisible} onClick={onToggleRulers} label="Show rulers" />
          </div>

          <p className="text-[11px] leading-snug text-mute">
            Drag off a ruler to pull out a guide — a tap on the ruler does nothing. The guide you
            drag lights up with its position. Undo removes the last guide. Guides never export.
          </p>

          {guides.length > 0 && (
            <div className="flex flex-col gap-1.5">
              {guides.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center gap-2 rounded-lg border border-line bg-ink-1 px-2.5 py-1.5"
                >
                  <span className="w-4 font-mono text-[11px] font-bold text-accent">
                    {g.axis === 'v' ? 'X' : 'Y'}
                  </span>
                  <span className="min-w-0 flex-1 font-mono text-[12px] text-text">
                    {Math.round(g.position)} px
                  </span>
                  <button
                    type="button"
                    onClick={() => onUpdateGuide(g.id, { locked: !g.locked })}
                    aria-label={g.locked ? 'Unlock guide' : 'Lock guide'}
                    className={`press grid h-7 w-7 place-items-center rounded-lg border ${
                      g.locked ? 'border-accent bg-accent text-ink-0' : 'border-line bg-ink-2 text-dim'
                    }`}
                  >
                    {g.locked ? <Lock size={12} /> : <LockOpen size={12} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveGuide(g.id)}
                    aria-label="Remove guide"
                    className="press grid h-7 w-7 place-items-center rounded-lg border border-line bg-ink-2 text-danger"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
              <Button variant="quiet" size="sm" onClick={onClearGuides}>
                Clear all guides
              </Button>
            </div>
          )}
        </section>

        {/* --------------------------- Background --------------------------- */}
        <section className="flex flex-col gap-2 rounded-xl border border-line bg-ink-0 p-3">
          <SectionLabel>Artboard background</SectionLabel>
          <button
            type="button"
            onClick={onEditBackground}
            className="press flex items-center justify-between gap-3 rounded-xl border border-line bg-ink-1 px-3 py-2.5"
          >
            <span className="flex items-center gap-3">
              <span
                className="h-8 w-8 rounded-lg border border-line-strong"
                style={{ backgroundColor: artboardColor }}
              />
              <span className="min-w-0 text-left">
                <span className="block font-mono text-[12px] font-bold uppercase text-text">
                  {artboardColor}
                </span>
                <span className="block text-[11px] text-mute">Change colour · pick, hex or reset</span>
              </span>
            </span>
            <span className="font-mono text-[11px] text-accent">Edit</span>
          </button>
        </section>
      </div>
    </Sheet>
  );
};
