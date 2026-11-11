import React, { useEffect, useState } from 'react';
import {
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Check,
  Trash2,
  Move,
} from 'lucide-react';
import { ModifierState } from '../types/vector';
import { haptic } from '../theme';

interface ThumbZoneProps {
  modifiers: ModifierState;
  onModifierChange: (mods: ModifierState) => void;
  onNudge: (dx: number, dy: number) => void;
  /** Finishing an in-progress pen or brush stroke */
  isDrawing: boolean;
  onFinishPath: () => void;
  hasSelection: boolean;
  onDuplicate: () => void;
  onDelete: () => void;
  visible: boolean;
  /** Reports the nudge pad being open, so the canvas can drop the transform
   *  rectangle while you are nudging instead of boxing in the view. */
  onNudgeOpenChange?: (open: boolean) => void;
}

/**
 * Each keycap gets its own colour when armed, so a glance tells you which
 * modifier is on without reading the glyph.
 */
const KEYCAPS: {
  key: keyof ModifierState;
  glyph: string;
  label: string;
  hint: string;
  activeClass: string;
}[] = [
  {
    key: 'shift',
    glyph: '⇧',
    label: 'Shift',
    hint: 'Constrain angle / equal size',
    activeClass: 'border-accent bg-accent text-ink-0 shadow-accent/25',
  },
  {
    key: 'ctrl',
    glyph: '⌃',
    label: 'Ctrl',
    hint: 'Direct select while held',
    activeClass: 'border-teal-300 bg-teal-300 text-ink-0 shadow-teal-300/25',
  },
  {
    key: 'alt',
    glyph: '⌥',
    label: 'Alt',
    hint: 'Break handle / erase',
    activeClass: 'border-amber-400 bg-amber-400 text-ink-0 shadow-amber-400/25',
  },
];

/**
 * Two-thumb controls. Left thumb: the modifier keys a keyboard would give you.
 * Right thumb: the actions you repeat constantly while drawing.
 */
export const ThumbZone: React.FC<ThumbZoneProps> = ({
  modifiers,
  onModifierChange,
  onNudge,
  isDrawing,
  onFinishPath,
  hasSelection,
  onDuplicate,
  onDelete,
  visible,
  onNudgeOpenChange,
}) => {
  const [showNudge, setShowNudge] = useState(false);
  const [step, setStep] = useState(1);

  useEffect(() => {
    onNudgeOpenChange?.(showNudge);
  }, [showNudge, onNudgeOpenChange]);

  // Nothing selected means nothing to nudge — drop the pad rather than
  // leave an open panel that hides the transform box for a stale selection.
  useEffect(() => {
    if (!hasSelection) setShowNudge(false);
  }, [hasSelection]);

  if (!visible) return null;

  const toggle = (key: keyof ModifierState) => {
    haptic(10);
    onModifierChange({ ...modifiers, [key]: !modifiers[key] });
  };

  return (
    <>
      {/* LEFT — modifier keys, stacked in the app's original thumb column */}
      <div className="pointer-events-none absolute bottom-2 left-1.5 z-20 flex flex-col gap-1.5">
        {KEYCAPS.map((cap) => {
          const active = modifiers[cap.key];
          return (
            <button
              key={cap.key}
              type="button"
              aria-label={`${cap.label}: ${cap.hint}`}
              aria-pressed={active}
              onClick={() => toggle(cap.key)}
              className={`press pointer-events-auto grid h-11 w-11 place-content-center gap-0.5 rounded-lg border shadow-lg ${
                active
                  ? `${cap.activeClass} shadow-lg`
                  : 'border-line bg-ink-2/90 text-dim shadow-black/30 backdrop-blur'
              }`}
            >
              <span className="font-mono text-[15px] leading-none">{cap.glyph}</span>
              <span
                className={`font-sans text-[8px] uppercase leading-none tracking-[0.06em] ${
                  active ? 'text-ink-0/75' : 'text-mute'
                }`}
              >
                {cap.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* RIGHT — repeat actions */}
      <div className="pointer-events-none absolute bottom-2 right-1.5 z-20 flex flex-col items-end gap-1.5">
        {showNudge && (
          <div className="anim-pop pointer-events-auto mb-1 w-[158px] rounded-xl border border-line bg-ink-2/95 p-2 shadow-2xl backdrop-blur">
            <div className="mx-auto grid w-[116px] grid-cols-3 grid-rows-3 gap-1">
              <span />
              <button
                type="button"
                onClick={() => onNudge(0, -step)}
                className="press grid h-9 place-items-center rounded-md bg-ink-3 text-dim hover:text-accent"
                aria-label="Nudge up"
              >
                <ChevronUp size={14} />
              </button>
              <span />
              <button
                type="button"
                onClick={() => onNudge(-step, 0)}
                className="press grid h-9 place-items-center rounded-md bg-ink-3 text-dim hover:text-accent"
                aria-label="Nudge left"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="grid h-9 place-items-center rounded-md bg-ink-0 font-mono text-[10px] font-bold text-accent">
                {step}
              </span>
              <button
                type="button"
                onClick={() => onNudge(step, 0)}
                className="press grid h-9 place-items-center rounded-md bg-ink-3 text-dim hover:text-accent"
                aria-label="Nudge right"
              >
                <ChevronRight size={14} />
              </button>
              <span />
              <button
                type="button"
                onClick={() => onNudge(0, step)}
                className="press grid h-9 place-items-center rounded-md bg-ink-3 text-dim hover:text-accent"
                aria-label="Nudge down"
              >
                <ChevronDown size={14} />
              </button>
              <span />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-0.5">
              {[0.5, 1, 5, 10].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStep(s)}
                  className={`press h-8 flex-1 rounded-md font-mono text-[10px] font-bold ${
                    step === s ? 'bg-accent text-ink-0' : 'bg-ink-3 text-mute'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <button
          type="button"
          aria-label="Duplicate selection"
          disabled={!hasSelection}
          onClick={() => {
            haptic(10);
            onDuplicate();
          }}
          className="press pointer-events-auto grid h-11 w-11 place-items-center rounded-lg border border-line bg-ink-2/90 text-dim shadow-lg shadow-black/30 backdrop-blur disabled:opacity-30"
        >
          <Copy size={16} />
        </button>

        {isDrawing ? (
          <button
            type="button"
            aria-label="Finish path"
            onClick={() => {
              haptic(14);
              onFinishPath();
            }}
            className="press pointer-events-auto grid h-12 w-11 place-items-center rounded-lg border border-accent bg-accent text-ink-0 shadow-lg shadow-accent/20"
          >
            <Check size={19} />
          </button>
        ) : (
          <button
            type="button"
            aria-label="Delete selection"
            disabled={!hasSelection}
            onClick={() => {
              haptic(14);
              onDelete();
            }}
            className="press pointer-events-auto grid h-11 w-11 place-items-center rounded-lg border border-line bg-ink-2/90 text-dim shadow-lg shadow-black/30 backdrop-blur disabled:opacity-30"
          >
            <Trash2 size={16} />
          </button>
        )}

        <button
          type="button"
          aria-label="Precision nudge pad"
          aria-pressed={showNudge}
          disabled={!hasSelection}
          onClick={() => {
            haptic(8);
            setShowNudge((v) => !v);
          }}
          className={`press pointer-events-auto grid h-11 w-11 place-items-center rounded-lg border shadow-lg shadow-black/30 backdrop-blur disabled:opacity-30 ${
            showNudge ? 'border-accent bg-accent text-ink-0' : 'border-line bg-ink-2/90 text-mute'
          }`}
        >
          <Move size={16} />
        </button>
      </div>
    </>
  );
};
