import React from 'react';
import { X } from 'lucide-react';

const STORAGE_KEY = 'pentix.toolPanels';

interface PanelMemory {
  /** Panel names the user has closed, so the choice survives a tool switch */
  closed: string[];
  /** Where each panel was scrolled to, so it is left where it was found */
  scroll: Record<string, number>;
}

function readMemory(): PanelMemory {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { closed: [], scroll: {} };
    const parsed = JSON.parse(raw) as Partial<PanelMemory>;
    return {
      closed: Array.isArray(parsed.closed) ? parsed.closed.filter((v) => typeof v === 'string') : [],
      scroll: parsed.scroll && typeof parsed.scroll === 'object' ? parsed.scroll : {},
    };
  } catch {
    return { closed: [], scroll: {} };
  }
}

function writeMemory(memory: PanelMemory) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(memory));
  } catch {
    /* private mode: the panel still works, it just forgets between sessions */
  }
}

/** Panels the user has closed, so a dismissed panel does not reopen itself */
export function readClosedPanels(): string[] {
  return readMemory().closed;
}

export function writeClosedPanels(closed: string[]) {
  writeMemory({ ...readMemory(), closed });
}

export function rememberPanelScroll(name: string, top: number) {
  const memory = readMemory();
  writeMemory({ ...memory, scroll: { ...memory.scroll, [name]: top } });
}

/**
 * A named panel for one job. The frame is the same whatever the tool is — name,
 * one line of guidance, a close button, and a body that scrolls inside itself —
 * so options never make the strip below change shape. It stays until it is
 * closed, and reopens where it was left.
 */
export const ToolPanel: React.FC<{
  name: string;
  hint?: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ name, hint, onClose, children }) => {
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const restored = React.useRef(false);

  React.useEffect(() => {
    if (restored.current || !bodyRef.current) return;
    restored.current = true;
    const top = readMemory().scroll[name] ?? 0;
    if (top > 0) bodyRef.current.scrollTop = top;
  }, [name]);

  return (
    <div className="mx-auto w-full max-w-3xl px-2 pt-1.5">
      <div className="overflow-hidden rounded-xl border border-line bg-ink-2/95 shadow-xl">
        <div className="flex items-center gap-2 border-b border-line/70 px-2 py-1">
          <span className="shrink-0 font-sans text-[9px] font-bold uppercase tracking-[0.1em] text-accent">
            {name}
          </span>
          {hint && <span className="min-w-0 flex-1 truncate text-[10.5px] text-mute">{hint}</span>}
          <span className="flex-1" />
          <button
            type="button"
            aria-label={`Close ${name} panel`}
            onClick={onClose}
            className="press grid h-6 w-6 place-items-center rounded-md text-mute hover:bg-ink-3 hover:text-text"
          >
            <X size={13} />
          </button>
        </div>
        <div
          ref={bodyRef}
          onScroll={(event) => rememberPanelScroll(name, event.currentTarget.scrollTop)}
          className="flex max-h-[34dvh] flex-wrap items-center gap-1.5 overflow-y-auto overscroll-contain px-2 py-2"
        >
          {children}
        </div>
      </div>
    </div>
  );
};
