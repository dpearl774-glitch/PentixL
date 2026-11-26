import React from 'react';
import { ModifierState, ToolType } from '../types/vector';
import { haptic } from '../theme';

/**
 * The three switches. `hint` is the line inside the tray; `what` is what the
 * armed-key strip says for the tool in hand. These keys are sticky, not held,
 * so a lit glyph alone could not explain a tap that behaves differently three
 * gestures later.
 */
const CAPS: Array<{
  key: keyof ModifierState;
  glyph: string;
  label: string;
  hint: string;
  what: (tool: ToolType) => string;
}> = [
  {
    key: 'shift',
    glyph: '⇧',
    label: 'Shift',
    hint: 'Constrain angle / equal size',
    what: (tool) => {
      switch (tool) {
        case 'select':
          return 'tap still moves · corners keep proportions · rotate snaps 15°';
        case 'direct-select':
          return 'handles snap to 45° · nodes add to the selection';
        case 'pen':
          return 'new segments snap to 45°';
        case 'pressure-brush':
          return 'handles snap to 45°';
        case 'shape':
          return 'draws an equal-sided shape';
        default:
          return 'constrains angles and proportions';
      }
    },
  },
  {
    key: 'ctrl',
    glyph: '⌃',
    label: 'Ctrl',
    hint: 'Direct select while armed',
    what: () => 'tap adds to the selection',
  },
  {
    key: 'alt',
    glyph: '⌥',
    label: 'Alt',
    hint: 'Break handle / erase',
    what: () => 'breaks handles · pauses smart guides',
  },
];

/**
 * The armed keys, said out loud, for as long as they are armed. The pill alone
 * asked the user to remember that a lit glyph changes what a tap does; this
 * strip names the keys, says what they do to the current tool, and clears them
 * in one tap, so an armed modifier never reads as a broken app.
 */
export const ModifierNotice: React.FC<{
  modifiers: ModifierState;
  onChange: (next: ModifierState) => void;
  tool: ToolType;
}> = ({ modifiers, onChange, tool }) => {
  const armed = CAPS.filter((entry) => modifiers[entry.key]);
  if (armed.length === 0) return null;

  return (
    <div
      role="status"
      className="relative z-20 flex shrink-0 items-center gap-2 border-t border-accent/35 bg-accent/10 px-3 py-1.5"
    >
      <span className="flex shrink-0 items-center gap-1 font-mono text-[13px] font-bold leading-none text-accent">
        {armed.map((entry) => (
          <span key={entry.key}>{entry.glyph}</span>
        ))}
      </span>
      <span className="min-w-0 flex-1 truncate text-[10.5px] leading-tight text-text">
        {armed
          .map((entry) => `${entry.label} — ${entry.what(tool)}`)
          .join(' · ')}
      </span>
      <button
        type="button"
        onClick={() => {
          haptic(8);
          onChange({ shift: false, ctrl: false, alt: false });
        }}
        className="press shrink-0 rounded-md bg-ink-2/80 px-2 py-1 text-[10px] font-semibold text-dim hover:text-text"
      >
        Clear
      </button>
    </div>
  );
};

/**
 * The phone still needs Shift, Ctrl and Alt, but not a permanent rail of
 * keycaps over the artwork. One compact ⇧⌃⌥ pill opens three switches; the
 * armed glyphs stay lit on the pill so the state is readable after closing.
 */
export const ModifierTray: React.FC<{
  modifiers: ModifierState;
  onChange: (next: ModifierState) => void;
  /** The tray is a transient tool control: a tool switch dismisses it. */
  tool: ToolType;
}> = ({ modifiers, onChange, tool }) => {
  const [open, setOpen] = React.useState(false);
  const activeCount = CAPS.filter((cap) => modifiers[cap.key]).length;
  const active = activeCount > 0;

  React.useEffect(() => {
    setOpen(false);
  }, [tool]);

  const toggle = (key: keyof ModifierState) => {
    haptic(8);
    onChange({ ...modifiers, [key]: !modifiers[key] });
  };

  return (
    <div className="absolute right-2 top-[88px] z-30">
      <button
        type="button"
        aria-label={
          active
            ? `Modifiers: ${CAPS.filter((cap) => modifiers[cap.key])
                .map((cap) => cap.label)
                .join(', ')}`
            : 'Modifiers'
        }
        aria-expanded={open}
        title="Modifiers"
        onClick={() => {
          haptic(8);
          setOpen((value) => !value);
        }}
        className={`press relative z-30 flex h-8 items-center gap-0.5 rounded-full border px-2.5 font-mono text-[12px] font-bold backdrop-blur ${
          active
            ? 'border-accent/50 bg-accent/15'
            : 'border-line bg-ink-2/90'
        }`}
      >
        {CAPS.map((cap) => (
          <span key={cap.key} className={modifiers[cap.key] ? 'text-accent' : 'text-dim'}>
            {cap.glyph}
          </span>
        ))}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close modifiers"
            className="fixed inset-0 z-20 cursor-default bg-ink-0/35 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />
          <div
            role="group"
            aria-label="Modifier switches"
            className="anim-rise absolute right-0 top-10 z-30 w-[260px] rounded-2xl border border-line bg-ink-2 p-1.5 shadow-2xl shadow-black/50"
          >
            <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
              <span className="font-sans text-[10px] font-bold uppercase tracking-[0.12em] text-mute">
                Modifiers
              </span>
              <span className="font-sans text-[10px] text-mute">Arm, then Done</span>
            </div>

            {CAPS.map((cap) => {
              const on = modifiers[cap.key];
              return (
                <button
                  key={cap.key}
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={`${cap.label}: ${cap.hint}`}
                  onClick={() => toggle(cap.key)}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-xl px-2.5 text-left ${
                    on ? 'bg-accent/10' : 'hover:bg-ink-3'
                  }`}
                >
                  <span
                    className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border font-mono text-[14px] ${
                      on
                        ? 'border-accent/40 bg-accent/15 text-accent'
                        : 'border-line bg-ink-3 text-dim'
                    }`}
                  >
                    {cap.glyph}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-[12px] font-semibold ${
                        on ? 'text-accent' : 'text-text'
                      }`}
                    >
                      {cap.label}
                    </span>
                    <span className="block truncate text-[10.5px] text-mute">{cap.hint}</span>
                  </span>
                  <span
                    className={`relative h-5 w-9 shrink-0 rounded-full ${
                      on ? 'bg-accent' : 'bg-line-strong'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-[left] ${
                        on ? 'left-[18px]' : 'left-0.5'
                      }`}
                    />
                  </span>
                </button>
              );
            })}

            <div className="mt-1 flex items-center gap-1.5 border-t border-line px-1 pt-1.5">
              <button
                type="button"
                aria-label="Clear all modifiers"
                title="Release all armed modifiers"
                disabled={!active}
                onClick={() => {
                  haptic(8);
                  onChange({ shift: false, ctrl: false, alt: false });
                }}
                className="press h-9 flex-1 rounded-lg text-[11.5px] font-semibold text-dim hover:text-text disabled:opacity-30"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="press h-9 flex-1 rounded-lg bg-ink-3 text-[11.5px] font-semibold text-text"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
