import React, { useState } from 'react';
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
}

const KEYCAPS: { key: keyof ModifierState; glyph: string; label: string; hint: string }[] = [
  { key: 'shift', glyph: '⇧', label: 'Shift', hint: 'Constrain angle / equal size' },
  { key: 'ctrl', glyph: '⌃', label: 'Ctrl', hint: 'Direct select while held' },
  { key: 'alt', glyph: '⌥', label: 'Alt', hint: 'Break handle / erase' },
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
}) => {
  const [showNudge, setShowNudge] = useState(false);
  const [step, setStep] = useState(1);

  if (!visible) return null;

  const toggle = (key: keyof ModifierState) => {
    haptic(10);
    onModifierChange({ ...modifiers, [key]: !modifiers[key] });
  };

  return (
    <>
      {/* LEFT — modifier keys */}
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
              className={`press pointer-events-auto grid h-11 w-11 place-content-center gap-0.5 rounded-xl border shadow-lg shadow-black/30 ${
                active
                  ? 'border-accent bg-accent text-ink-0'
                  : 'border-line bg-ink-2/90 text-dim backdrop-blur'
              }`}
            >
              <span className="font-mono text-[15px] leading-none">{cap.glyph}</span>
              <span
                className={`font-mono text-[8px] uppercase leading-none tracking-[0.06em] ${
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
          <div className="anim-pop pointer-events-auto mb-1 w-[132px] rounded-2xl border border-line bg-ink-2/95 p-2 shadow-2xl backdrop-blur">
            <div className="mx-auto grid w-[92px] grid-cols-3 grid-rows-3 gap-0.5">
              <span />
              <button
                type="button"
                onClick={() => onNudge(0, -step)}
                className="press grid h-7 place-items-center rounded-md bg-ink-3 text-dim hover:text-accent"
                aria-label="Nudge up"
              >
                <ChevronUp size={14} />
              </button>
              <span />
              <button
                type="button"
                onClick={() => onNudge(-step, 0)}
                className="press grid h-7 place-items-center rounded-md bg-ink-3 text-dim hover:text-accent"
                aria-label="Nudge left"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="grid h-7 place-items-center rounded-md bg-ink-0 font-mono text-[10px] font-bold text-accent">
                {step}
              </span>
              <button
                type="button"
                onClick={() => onNudge(step, 0)}
                className="press grid h-7 place-items-center rounded-md bg-ink-3 text-dim hover:text-accent"
                aria-label="Nudge right"
              >
                <ChevronRight size={14} />
              </button>
              <span />
              <button
                type="button"
                onClick={() => onNudge(0, step)}
                className="press grid h-7 place-items-center rounded-md bg-ink-3 text-dim hover:text-accent"
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
                  className={`press h-6 flex-1 rounded-md font-mono text-[9px] font-bold ${
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
          className="press pointer-events-auto grid h-11 w-11 place-items-center rounded-xl border border-line bg-ink-2/90 text-dim shadow-lg shadow-black/30 backdrop-blur disabled:opacity-30"
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
            className="press pointer-events-auto grid h-12 w-11 place-items-center rounded-xl border border-accent bg-accent text-ink-0 shadow-lg shadow-accent/20"
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
            className="press pointer-events-auto grid h-11 w-11 place-items-center rounded-xl border border-line bg-ink-2/90 text-dim shadow-lg shadow-black/30 backdrop-blur disabled:opacity-30"
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
          className={`press pointer-events-auto grid h-11 w-11 place-items-center rounded-xl border shadow-lg shadow-black/30 backdrop-blur disabled:opacity-30 ${
            showNudge ? 'border-accent bg-accent text-ink-0' : 'border-line bg-ink-2/90 text-mute'
          }`}
        >
          <Move size={16} />
        </button>
      </div>
    </>
  );
};
