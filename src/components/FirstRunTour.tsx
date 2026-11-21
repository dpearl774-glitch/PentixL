import React from 'react';
import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { haptic } from '../theme';

/** Shown once, on the first run, after the start sheet is closed. */
export const FIRST_RUN_TOUR_KEY = 'pentix.tourSeen';

interface TourStep {
  /** `data-tour` attribute of the thing the step is about */
  anchor: string;
  title: string;
  body: string;
}

/**
 * Three marks that name the places the panels now live in, in the order a first
 * logo is actually made. The anchors are attributes rather than selectors into
 * component internals, so moving a panel only means moving the attribute.
 */
export const FIRST_RUN_STEPS: TourStep[] = [
  {
    anchor: 'panel',
    title: 'Draw something',
    body: 'This panel holds the options for whichever tool is active. Pick a shape here, then drag on the artboard to size it.',
  },
  {
    anchor: 'strip',
    title: 'Combine it',
    body: 'Select two objects and the strip offers Group and Merge. Merge joins them into one path that stays editable — no rasterising.',
  },
  {
    anchor: 'export',
    title: 'Take it with you',
    body: 'Export SVG or PNG from here. Everything you drew is real vector, so the file scales to a billboard.',
  },
];

function measure(anchor: string, fallback: string): DOMRect | null {
  const target =
    document.querySelector(`[data-tour="${anchor}"]`) ??
    document.querySelector(`[data-tour="${fallback}"]`);
  return target ? target.getBoundingClientRect() : null;
}

export const FirstRunTour: React.FC<{
  open: boolean;
  step: number;
  onStep: (step: number) => void;
  onFinish: () => void;
}> = ({ open, step, onStep, onFinish }) => {
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const current = FIRST_RUN_STEPS[Math.min(step, FIRST_RUN_STEPS.length - 1)];
  const last = step >= FIRST_RUN_STEPS.length - 1;

  React.useEffect(() => {
    if (!open) return;
    const update = () => setRect(measure(current.anchor, 'strip'));
    update();
    // The panel is already laid out, but the fit-to-screen pass can settle a
    // frame later on a cold start.
    const timer = window.setTimeout(update, 150);
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, [open, current.anchor]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onFinish();
      if (event.key === 'Enter') onStep(last ? FIRST_RUN_STEPS.length : step + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, step, last, onStep, onFinish]);

  if (!open) return null;

  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;
  const above = rect ? rect.top > viewportHeight * 0.55 : false;
  const ring = rect
    ? {
        left: rect.left - 6,
        top: rect.top - 6,
        width: rect.width + 12,
        height: rect.height + 12,
      }
    : null;
  const cardStyle: React.CSSProperties = rect
    ? above
      ? { bottom: Math.max(12, viewportHeight - rect.top + 14), left: 12, right: 12 }
      : { top: Math.min(viewportHeight - 200, rect.bottom + 14), left: 12, right: 12 }
    : { bottom: 96, left: 12, right: 12 };

  const advance = () => {
    haptic(6);
    if (last) onFinish();
    else onStep(step + 1);
  };

  return (
    <div
      className="fixed inset-0 z-[70]"
      role="dialog"
      aria-modal="true"
      aria-label="Walkthrough"
    >
      {/* Catches taps so the app underneath cannot be driven mid-tour. */}
      <div className="absolute inset-0" onPointerDown={(event) => event.stopPropagation()} />
      {ring && (
        <div
          aria-hidden="true"
          data-tour-ring="true"
          className="pointer-events-none absolute rounded-lg border-2 border-accent/80"
          style={{ ...ring, boxShadow: '0 0 0 9999px rgba(4, 6, 10, 0.72)' }}
        />
      )}
      {!ring && <div className="absolute inset-0 bg-ink-0/70" />}

      <div
        className="absolute mx-auto flex max-w-[380px] flex-col gap-2 rounded-xl border border-line bg-ink-2 p-3 shadow-2xl"
        style={cardStyle}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="shrink-0 text-accent" />
          <span className="font-sans text-[9px] font-bold uppercase tracking-[0.1em] text-accent">
            Step {step + 1} of {FIRST_RUN_STEPS.length}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={onFinish}
            aria-label="Skip the walkthrough"
            className="press rounded-md px-1.5 py-1 text-[11px] font-semibold text-mute hover:text-text"
          >
            Skip
          </button>
        </div>

        <div className="text-[14px] font-bold tracking-tight text-text">{current.title}</div>
        <p className="text-[12px] leading-snug text-dim">{current.body}</p>

        <div className="mt-0.5 flex items-center gap-1.5">
          {FIRST_RUN_STEPS.map((s, index) => (
            <span
              key={s.anchor}
              className={`h-1.5 rounded-full transition-all ${
                index === step ? 'w-4 bg-accent' : 'w-1.5 bg-line-strong'
              }`}
            />
          ))}
          <span className="flex-1" />
          <button
            type="button"
            onClick={advance}
            aria-label={last ? 'Finish walkthrough' : 'Next step'}
            className="press flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-bold text-ink-0"
          >
            {last ? (
              <>
                Done <Check size={13} />
              </>
            ) : (
              <>
                Next <ArrowRight size={13} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
