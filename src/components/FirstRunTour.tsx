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
const STEPS: TourStep[] = [
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

/** The ring sits six pixels proud of the control it points at. */
const RING = 6;
const GAP = 10;

function anchorRect(anchor: string): DOMRect | null {
  const target =
    document.querySelector(`[data-tour="${anchor}"]`) ?? document.querySelector('[data-tour="strip"]');
  return target ? target.getBoundingClientRect() : null;
}

export const FirstRunTour: React.FC<{
  /** Null keeps the tour off the screen entirely */
  step: number | null;
  onStep: (step: number) => void;
  onFinish: () => void;
}> = ({ step, onStep, onFinish }) => {
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [cardHeight, setCardHeight] = React.useState(0);
  const cardRef = React.useRef<HTMLDivElement>(null);
  const open = step !== null;
  const index = Math.min(step ?? 0, STEPS.length - 1);
  const current = STEPS[index];
  const last = index === STEPS.length - 1;

  React.useEffect(() => {
    if (!open) return;
    const update = () => setRect(anchorRect(current.anchor));
    update();
    // The panel is laid out already, but the fit-to-screen pass can settle a
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
    const height = cardRef.current?.getBoundingClientRect().height ?? 0;
    if (height) setCardHeight(height);
  }, [index, rect, open]);

  // Escape only: Enter would double-fire with the focused button and skip a step.
  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onFinish();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onFinish]);

  if (!open) return null;

  const viewport = typeof window === 'undefined' ? 800 : window.innerHeight;
  const viewportWidth = typeof window === 'undefined' ? 900 : window.innerWidth;

  /**
   * The card goes on the roomier side of its target, and is capped to the space
   * there — so it never lands on top of the control it is pointing at, however
   * short the screen is. Measuring the card first is what makes that possible.
   */
  const place = (): { style: React.CSSProperties; maxHeight?: number } => {
    const style: React.CSSProperties = { left: 12, right: 12 };
    if (!rect) return { style: { ...style, bottom: 96 } };
    const above = rect.top - RING - GAP;
    const below = viewport - rect.bottom - RING - GAP;
    const fitsAbove = above >= cardHeight;
    const fitsBelow = below >= cardHeight;
    const useAbove = fitsAbove && (above >= below || !fitsBelow);
    if (useAbove) {
      return {
        style: { ...style, bottom: Math.max(12, viewport - rect.top + RING + GAP) },
        maxHeight: Math.max(140, above),
      };
    }
    return {
      style: {
        ...style,
        top: Math.max(12, Math.min(viewport - (cardHeight || 170) - 12, rect.bottom + RING + GAP)),
      },
      maxHeight: Math.max(140, below),
    };
  };
  const { style: cardStyle, maxHeight } = place();

  // A ring that ran off the edge would hide its own border on a phone whose
  // strip is wider than the screen.
  const ringBox = rect
    ? {
        left: Math.max(0, rect.left - RING),
        top: Math.max(0, rect.top - RING),
        width:
          Math.min(viewportWidth, rect.right + RING) - Math.max(0, rect.left - RING),
        height:
          Math.min(viewport, rect.bottom + RING) - Math.max(0, rect.top - RING),
      }
    : null;

  const advance = () => {
    haptic(6);
    if (last) onFinish();
    else onStep(index + 1);
  };

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-modal="true" aria-label="Walkthrough">
      {/* Catches taps so the app underneath cannot be driven mid-tour. */}
      <div className="absolute inset-0" />
      {ringBox ? (
        <div
          aria-hidden="true"
          data-tour-ring="true"
          className="pointer-events-none absolute rounded-lg border-2 border-accent/80"
          style={{ ...ringBox, boxShadow: '0 0 0 9999px rgba(4, 6, 10, 0.72)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-ink-0/70" />
      )}

      <div
        ref={cardRef}
        className="absolute mx-auto flex max-w-[380px] flex-col gap-2 overflow-y-auto rounded-xl border border-line bg-ink-2 p-3 shadow-2xl"
        style={{ ...cardStyle, maxHeight, opacity: cardHeight ? 1 : 0 }}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="shrink-0 text-accent" />
          <span className="font-sans text-[9px] font-bold uppercase tracking-[0.1em] text-accent">
            Step {index + 1} of {STEPS.length}
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
          {STEPS.map((tourStep, dot) => (
            <span
              key={tourStep.anchor}
              className={`h-1.5 rounded-full transition-all ${
                dot === index ? 'w-4 bg-accent' : 'w-1.5 bg-line-strong'
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
