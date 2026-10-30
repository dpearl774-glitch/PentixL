import React, { useEffect, useRef, useState } from 'react';
import { Ban, Check, Info, Pipette, Plus, Trash2, RotateCcw } from 'lucide-react';
import { GradientDef, StrokeCap, StrokeJoin } from '../types/vector';
import { gradientCss, mixHex, sortedStops } from '../utils/gradients';
import { Button, SectionLabel, Segmented, Sheet } from './ui/primitives';

type ColorMode = 'fill' | 'stroke' | 'background';

interface ColorSheetProps {
  open: boolean;
  onClose: () => void;
  mode: ColorMode;
  onModeChange: (mode: ColorMode) => void;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  strokeCap: StrokeCap;
  strokeJoin: StrokeJoin;
  fillOpacity: number;
  strokeOpacity: number;
  onUpdateFill: (color: string) => void;
  onUpdateStroke: (color: string) => void;
  onUpdateFillOpacity: (value: number) => void;
  onUpdateStrokeOpacity: (value: number) => void;
  onUpdateStrokeWidth: (width: number) => void;
  onUpdateStrokeCap: (cap: StrokeCap) => void;
  onUpdateStrokeJoin: (join: StrokeJoin) => void;
  /** Fill paint style — solid swatch or a gradient definition */
  fillType: 'solid' | 'gradient';
  fillGradient: GradientDef | null;
  onSetFillType: (type: 'solid' | 'gradient') => void;
  onUpdateFillGradient: (gradient: GradientDef) => void;
  stopIndex: number;
  onStopIndexChange: (index: number) => void;
  artboardColor: string;
  onUpdateBackground: (color: string) => void;
  onResetBackground: () => void;
  /** Ask the canvas to sample a colour from the artwork */
  onSample: () => void;
  sampling: boolean;
  /** 0 means nothing is selected: edits become the default style */
  selectedCount?: number;
}

const PALETTE = [
  '#FFFFFF',
  '#D9DDE3',
  '#8A919B',
  '#4B5158',
  '#23262B',
  '#0B0C0E',
  '#4C8DFF',
  '#9CC4FF',
  '#5CE1C5',
  '#5B8DEF',
  '#7C6BFF',
  '#FF7AB6',
  '#FF6B6B',
  '#FF9F45',
  '#FFC15E',
  '#F0E4CC',
];

const HEX = /^#?([0-9a-fA-F]{6})$/;

/* --------------------------- colour conversions --------------------------- */

const hexToRgb = (hex: string): [number, number, number] => {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return [76, 141, 255];
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
};

const rgbToHex = (r: number, g: number, b: number): string =>
  `#${[r, g, b]
    .map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();

function hexToHsv(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, max === 0 ? 0 : d / max, max];
}

function hsvToHex(h: number, s: number, v: number): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let rgb: [number, number, number];
  if (h < 60) rgb = [c, x, 0];
  else if (h < 120) rgb = [x, c, 0];
  else if (h < 180) rgb = [0, c, x];
  else if (h < 240) rgb = [0, x, c];
  else if (h < 300) rgb = [x, 0, c];
  else rgb = [c, 0, x];
  return rgbToHex((rgb[0] + m) * 255, (rgb[1] + m) * 255, (rgb[2] + m) * 255);
}

/* --------------------------- pointer helpers --------------------------- */

const useDragValue = (
  onValue: (clientX: number, clientY: number, rect: DOMRect) => void
) => {
  const ref = useRef<HTMLElement | null>(null);
  const handle = (e: React.PointerEvent) => {
    const el = e.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    ref.current = el;
    onValue(e.clientX, e.clientY, rect);
    e.stopPropagation();
  };
  const move = (e: React.PointerEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    onValue(e.clientX, e.clientY, rect);
  };
  const end = () => {
    ref.current = null;
  };
  return { onPointerDown: handle, onPointerMove: move, onPointerUp: end, onPointerCancel: end };
};

export const ColorSheet: React.FC<ColorSheetProps> = ({
  open,
  onClose,
  mode,
  onModeChange,
  fillColor,
  strokeColor,
  strokeWidth,
  strokeCap,
  strokeJoin,
  fillOpacity,
  strokeOpacity,
  onUpdateFill,
  onUpdateStroke,
  onUpdateFillOpacity,
  onUpdateStrokeOpacity,
  onUpdateStrokeWidth,
  onUpdateStrokeCap,
  onUpdateStrokeJoin,
  fillType,
  fillGradient,
  onSetFillType,
  onUpdateFillGradient,
  stopIndex,
  onStopIndexChange,
  artboardColor,
  onUpdateBackground,
  onResetBackground,
  onSample,
  sampling,
  selectedCount = 0,
}) => {
  const isGradient = mode === 'fill' && fillType === 'gradient' && !!fillGradient;
  const stops = fillGradient ? sortedStops(fillGradient.stops) : [];
  const setStopIndex = onStopIndexChange;
  const [hexDraft, setHexDraft] = useState('');

  // The colour currently under the editor: solid paint, a gradient stop, or the artboard.
  const current =
    mode === 'background'
      ? artboardColor
      : isGradient
        ? stops[Math.min(stopIndex, stops.length - 1)]?.color ?? '#CDFF5C'
        : mode === 'fill'
          ? fillColor
          : strokeColor;
  const isNone = !isGradient && mode !== 'background' && current === 'none';
  const effective = isNone ? '#CDFF5C' : current.toUpperCase();

  const [h, s, v] = hexToHsv(effective);
  const opacityValue =
    mode === 'background' ? 1 : isGradient
      ? stops[Math.min(stopIndex, stops.length - 1)]?.opacity ?? 1
      : mode === 'fill'
        ? fillOpacity
        : strokeOpacity;

  useEffect(() => {
    setHexDraft(isNone ? 'NONE' : effective);
  }, [effective, isNone]);

  useEffect(() => {
    if (stopIndex >= stops.length) setStopIndex(0);
  }, [stops.length, stopIndex]);

  const apply = (hex: string) => {
    if (mode === 'background') {
      onUpdateBackground(hex);
      return;
    }
    if (isGradient && fillGradient) {
      const idx = Math.min(stopIndex, stops.length - 1);
      const next = stops.map((st, i) => (i === idx ? { ...st, color: hex } : st));
      onUpdateFillGradient({ ...fillGradient, stops: next });
      return;
    }
    if (mode === 'fill') onUpdateFill(hex);
    else onUpdateStroke(hex);
  };

  const applyOpacity = (value: number) => {
    if (mode === 'background' || isNone) return;
    if (isGradient && fillGradient) {
      const idx = Math.min(stopIndex, stops.length - 1);
      const next = stops.map((st, i) => (i === idx ? { ...st, opacity: value } : st));
      onUpdateFillGradient({ ...fillGradient, stops: next });
      return;
    }
    if (mode === 'fill') onUpdateFillOpacity(value);
    else onUpdateStrokeOpacity(value);
  };

  const commitHex = (raw: string) => {
    const match = HEX.exec(raw.trim());
    if (match) apply(`#${match[1].toUpperCase()}`);
    else setHexDraft(isNone ? 'NONE' : effective);
  };

  const svDrag = useDragValue((cx, cy, rect) => {
    const ns = Math.min(1, Math.max(0, (cx - rect.left) / rect.width));
    const nv = 1 - Math.min(1, Math.max(0, (cy - rect.top) / rect.height));
    apply(hsvToHex(h, ns, nv));
  });

  const hueDrag = useDragValue((cx, _cy, rect) => {
    const nh = Math.min(359, Math.max(0, ((cx - rect.left) / rect.width) * 360));
    apply(hsvToHex(nh, s || 1, v || 1));
  });

  const patchGradient = (patch: Partial<GradientDef>) => {
    if (!fillGradient) return;
    onUpdateFillGradient({ ...fillGradient, ...patch });
  };

  const addStopAt = (offset: number) => {
    if (!fillGradient) return;
    const sorted = sortedStops(fillGradient.stops);
    const clamped = Math.min(0.99, Math.max(0.01, offset));
    const left = [...sorted].reverse().find((st) => st.offset <= clamped) ?? sorted[0];
    const right = sorted.find((st) => st.offset >= clamped) ?? sorted[sorted.length - 1];
    const span = right.offset - left.offset;
    const t = span > 0 ? (clamped - left.offset) / span : 0.5;
    const color = mixHex(left.color, right.color, t);
    const opacity = left.opacity + (right.opacity - left.opacity) * t;
    const next = sortedStops([...sorted, { offset: clamped, color, opacity }]);
    onUpdateFillGradient({ ...fillGradient, stops: next });
    setStopIndex(next.findIndex((st) => Math.abs(st.offset - clamped) < 0.0001));
  };

  const removeStop = () => {
    if (!fillGradient || stops.length <= 2) return;
    const next = stops.filter((_, i) => i !== stopIndex);
    onUpdateFillGradient({ ...fillGradient, stops: next });
    setStopIndex(Math.max(0, Math.min(stopIndex, next.length - 1)));
  };

  const title = mode === 'background' ? 'Artboard' : 'Paint';
  const subtitle =
    mode === 'background'
      ? 'Background only — artwork colours stay put.'
      : mode === 'fill'
        ? 'Fill colour'
        : 'Stroke colour';

  return (
    <Sheet open={open} onClose={onClose} title={title} eyebrow="Appearance" subtitle={subtitle}>
      <div className="flex flex-col gap-5 pb-1">
        {mode !== 'background' && (
          <Segmented
            value={mode}
            onChange={onModeChange}
            options={[
              { value: 'fill', label: 'Fill' },
              { value: 'stroke', label: 'Stroke' },
            ]}
          />
        )}

        <div className="flex items-center gap-1.5 rounded-lg border border-line bg-ink-0 px-2.5 py-1.5 text-[11px] leading-snug text-mute">
          <Info size={12} className="shrink-0 text-accent" />
          {mode === 'background'
            ? 'Behind the artwork, in exports too.'
            : selectedCount > 0
              ? `Editing ${selectedCount} selected object${selectedCount > 1 ? 's' : ''}`
              : 'No selection — this styles the next object.'}
        </div>

        {/* Embedded picker: saturation/value square + hue rail */}
        <div className="flex flex-col gap-2.5">
          <div
            role="slider"
            aria-label="Saturation and brightness"
            aria-valuetext={`${Math.round(s * 100)}% saturation, ${Math.round(v * 100)}% brightness`}
            tabIndex={0}
            onPointerDown={svDrag.onPointerDown}
            onPointerMove={svDrag.onPointerMove}
            onPointerUp={svDrag.onPointerUp}
            onPointerCancel={svDrag.onPointerCancel}
            className="relative h-32 w-full cursor-crosshair touch-none overflow-hidden rounded-xl border border-line-strong"
            style={{
              backgroundColor: hsvToHex(h, 1, 1),
              backgroundImage:
                'linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent)',
            }}
          >
            <span
              className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.6)]"
              style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }}
            />
          </div>

          <div
            role="slider"
            aria-label="Hue"
            aria-valuenow={Math.round(h)}
            tabIndex={0}
            onPointerDown={hueDrag.onPointerDown}
            onPointerMove={hueDrag.onPointerMove}
            onPointerUp={hueDrag.onPointerUp}
            onPointerCancel={hueDrag.onPointerCancel}
            className="relative h-4 w-full cursor-ew-resize touch-none rounded-full border border-line"
            style={{
              backgroundImage:
                'linear-gradient(90deg, #f00, #ff0 17%, #0f8, #0ff 50%, #00f, #f0f 83%, #f00)',
            }}
          >
            <span
              className="pointer-events-none absolute top-1/2 h-5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-white bg-white/20 shadow"
              style={{ left: `${(h / 360) * 100}%` }}
            />
          </div>
        </div>

        {/* Hex + eyedropper + none */}
        <div className="flex items-center gap-3">
          <span
            className="h-14 w-14 shrink-0 rounded-xl border border-line-strong"
            style={{
              backgroundColor: isNone ? 'transparent' : effective,
              backgroundImage: isNone
                ? 'linear-gradient(45deg,#FF6B6B 1.5px,transparent 1.5px 50%,#FF6B6B 50%,#FF6B6B 51.5px,transparent 51.5px)'
                : undefined,
            }}
          />

          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex items-center gap-2">
              <input
                value={hexDraft}
                onChange={(e) => setHexDraft(e.target.value)}
                onBlur={(e) => commitHex(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitHex((e.target as HTMLInputElement).value);
                }}
                spellCheck={false}
                className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-ink-0 px-2.5 font-mono text-[12px] font-bold uppercase tracking-wider text-text outline-none focus:border-accent/60"
                aria-label="Hex value"
              />
              <button
                type="button"
                onClick={onSample}
                aria-pressed={sampling}
                title="Sample a colour from the artwork"
                className={`press grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${
                  sampling ? 'border-accent bg-accent text-ink-0' : 'border-line bg-ink-2 text-dim'
                }`}
              >
                <Pipette size={14} />
              </button>
              {mode !== 'background' && (
                <button
                  type="button"
                  onClick={() => apply('none')}
                  aria-pressed={isNone}
                  className={`press grid h-9 w-9 shrink-0 place-items-center rounded-lg border ${
                    isNone ? 'border-danger bg-danger/15 text-danger' : 'border-line bg-ink-2 text-mute'
                  }`}
                  title="No colour"
                >
                  <Ban size={14} />
                </button>
              )}
            </div>

            {/* Opacity */}
            {mode !== 'background' && !isNone && (
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-mute">Alpha</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round(opacityValue * 100)}
                  onChange={(e) => applyOpacity(parseInt(e.target.value, 10) / 100)}
                  aria-label="Opacity"
                  className="min-w-0 flex-1"
                />
                <span className="w-9 text-right font-mono text-[11px] font-bold text-dim">
                  {Math.round(opacityValue * 100)}%
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ---------------------- Gradient (fill only) ---------------------- */}
        {mode === 'fill' && (
          <section className="flex flex-col gap-2.5 rounded-xl border border-line bg-ink-0 p-3">
            <div className="flex items-center justify-between">
              <SectionLabel>Fill type</SectionLabel>
              <Segmented
                className="w-40"
                value={fillType}
                onChange={onSetFillType}
                options={[
                  { value: 'solid', label: 'Solid' },
                  { value: 'gradient', label: 'Gradient' },
                ]}
              />
            </div>

            {isGradient && fillGradient && (
              <>
                <Segmented
                  value={fillGradient.type}
                  onChange={(type) => patchGradient({ type })}
                  options={[
                    { value: 'linear', label: 'Linear' },
                    { value: 'radial', label: 'Radial' },
                  ]}
                />

                {/* Stop bar */}
                <div className="flex flex-col gap-1.5">
                  <div
                    className="relative h-8 touch-none rounded-lg border border-line"
                    style={{ backgroundImage: gradientCss(fillGradient) }}
                    onPointerDown={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      addStopAt((e.clientX - rect.left) / rect.width);
                    }}
                  >
                    {stops.map((st, i) => (
                      <button
                        key={`${st.offset}-${i}`}
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          setStopIndex(i);
                        }}
                        aria-label={`Stop ${i + 1}`}
                        className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow ${
                          i === stopIndex ? 'border-accent scale-110' : 'border-white/80'
                        }`}
                        style={{
                          left: `${st.offset * 100}%`,
                          backgroundColor: st.color,
                          opacity: 0.35 + st.opacity * 0.65,
                        }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => addStopAt(0.5)}
                      className="press grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-ink-2 text-dim"
                      aria-label="Add stop"
                    >
                      <Plus size={13} />
                    </button>
                    <button
                      type="button"
                      onClick={removeStop}
                      disabled={stops.length <= 2}
                      className="press grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-ink-2 text-dim disabled:opacity-30"
                      aria-label="Remove stop"
                    >
                      <Trash2 size={13} />
                    </button>
                    <span className="min-w-0 flex-1 truncate text-[11px] text-mute">
                      Tap the bar to add a stop
                    </span>
                  </div>
                </div>

                {/* Stop position */}
                <div className="flex items-center gap-2">
                  <span className="w-14 font-mono text-[10px] uppercase tracking-wider text-mute">Pos</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round((stops[stopIndex]?.offset ?? 0) * 100)}
                    onChange={(e) => {
                      if (!fillGradient) return;
                      const offset = parseInt(e.target.value, 10) / 100;
                      const next = stops.map((st, i) => (i === stopIndex ? { ...st, offset } : st));
                      onUpdateFillGradient({ ...fillGradient, stops: next });
                    }}
                    aria-label="Stop position"
                    className="min-w-0 flex-1"
                  />
                  <span className="w-9 text-right font-mono text-[11px] font-bold text-dim">
                    {Math.round((stops[stopIndex]?.offset ?? 0) * 100)}%
                  </span>
                </div>

                {/* Direction */}
                {fillGradient.type === 'linear' && (
                  <div className="flex items-center gap-2">
                    <span className="w-14 font-mono text-[10px] uppercase tracking-wider text-mute">Angle</span>
                    <input
                      type="range"
                      min={0}
                      max={359}
                      step={1}
                      value={Math.round(fillGradient.angle)}
                      onChange={(e) => patchGradient({ angle: parseInt(e.target.value, 10) })}
                      aria-label="Gradient angle"
                      className="min-w-0 flex-1"
                    />
                    <span className="w-9 text-right font-mono text-[11px] font-bold text-dim">
                      {Math.round(fillGradient.angle)}°
                    </span>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* Palette */}
        <section className="flex flex-col gap-2">
          <SectionLabel>Palette</SectionLabel>
          <div className="grid grid-cols-8 gap-1.5">
            {PALETTE.map((c) => {
              const active = current.toUpperCase() === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => apply(c)}
                  aria-label={c}
                  className={`press relative aspect-square rounded-lg border ${
                    active ? 'border-accent' : 'border-line'
                  }`}
                  style={{ backgroundColor: c }}
                >
                  {active && (
                    <Check
                      size={12}
                      className="absolute inset-0 m-auto"
                      style={{
                        color: ['#FFFFFF', '#D9DDE3', '#CDFF5C', '#F0E4CC', '#FFC15E', '#5CE1C5'].includes(c)
                          ? '#0B0C0E'
                          : '#FFFFFF',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        {/* Background controls */}
        {mode === 'background' && (
          <section className="flex flex-col gap-2">
            <SectionLabel>Artboard colour</SectionLabel>
            <div className="flex items-center justify-between rounded-xl border border-line bg-ink-0 px-3 py-2.5">
              <div className="min-w-0">
                <div className="font-mono text-[12px] font-bold uppercase text-text">
                  {artboardColor}
                </div>
                <div className="text-[11px] text-mute">Default is #101216</div>
              </div>
              <Button variant="secondary" size="sm" onClick={onResetBackground}>
                <RotateCcw size={13} /> Reset
              </Button>
            </div>
          </section>
        )}

        {/* Stroke specifics */}
        {mode === 'stroke' && (
          <section className="flex flex-col gap-3 rounded-xl border border-line bg-ink-0 p-3">
            <div className="flex items-center justify-between">
              <SectionLabel>Weight</SectionLabel>
              <span className="font-mono text-[11px] font-bold text-accent">{strokeWidth} px</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={32}
              step={0.5}
              value={strokeWidth}
              onChange={(e) => onUpdateStrokeWidth(parseFloat(e.target.value))}
              aria-label="Stroke weight"
            />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <SectionLabel>Cap</SectionLabel>
                <Segmented
                  value={strokeCap}
                  onChange={onUpdateStrokeCap}
                  options={[
                    { value: 'round', label: 'Round' },
                    { value: 'square', label: 'Square' },
                    { value: 'butt', label: 'Flat' },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <SectionLabel>Join</SectionLabel>
                <Segmented
                  value={strokeJoin}
                  onChange={onUpdateStrokeJoin}
                  options={[
                    { value: 'round', label: 'Round' },
                    { value: 'miter', label: 'Miter' },
                    { value: 'bevel', label: 'Bevel' },
                  ]}
                />
              </div>
            </div>
          </section>
        )}
      </div>

      <div className="mt-4">
        <Button variant="primary" block onClick={onClose}>
          <Check size={15} /> Done
        </Button>
      </div>
    </Sheet>
  );
};
