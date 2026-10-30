import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { haptic } from '../theme';

interface PrecisionPadProps {
  /** Screen-pixel movement for the crosshair. */
  onMove: (dx: number, dy: number) => void;
  /** A press begins at the crosshair. */
  onPress: () => void;
  /** The crosshair moved while pressed. */
  onDrag: () => void;
  /** The press ends. */
  onRelease: () => void;
  /** Scroll over the pad. `zoomIntent` is true while ⌘ or ctrl is held. */
  onWheel?: (dx: number, dy: number, zoomIntent: boolean) => void;
  onClose: () => void;
}

/** Cursor travel per pad pixel — a small pad still crosses the canvas. */
const SENSITIVITY = 1.7;
/** Hold this long to press, exactly like holding a mouse button. */
const HOLD_MS = 180;
/** Below this much finger travel a gesture still counts as a tap. */
const MOVE_SLOP = 8;

/**
 * A trackpad for the space between the thumb clusters.
 *
 * The finger never touches the artwork, so nodes under it stay visible. It
 * behaves the same way a laptop trackpad does: on touch you drag to move the
 * crosshair, tap to click and hold to press; with a mouse or trackpad the
 * crosshair simply follows the pointer, so no button is needed to aim.
 *
 * Scroll pans the canvas and ⌘/ctrl + scroll zooms — both anchored on the
 * crosshair, so precision work never jumps.
 *
 * The surface claims the touch completely: no scrolling, no text selection, no
 * long-press callout and no browser gesture may take the pointer away, because
 * on a phone every one of those cancels the press mid-drag.
 */
export const PrecisionPad: React.FC<PrecisionPadProps> = ({
  onMove,
  onPress,
  onDrag,
  onRelease,
  onWheel,
  onClose,
}) => {
  const surfaceRef = useRef<HTMLDivElement>(null);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const holdRef = useRef<number | null>(null);
  const activeIdRef = useRef<number | null>(null);
  const pressedRef = useRef(false);
  const movedRef = useRef(false);
  /** Last hover position, for pointer devices that move without a button */
  const hoverRef = useRef<{ x: number; y: number } | null>(null);
  const [pressed, setPressed] = React.useState(false);

  // Callbacks are read through a ref so the hold timer never calls a stale one.
  const handlers = useRef({ onMove, onPress, onDrag, onRelease });
  handlers.current = { onMove, onPress, onDrag, onRelease };

  const clearHold = () => {
    if (holdRef.current !== null) {
      window.clearTimeout(holdRef.current);
      holdRef.current = null;
    }
  };

  const beginPress = () => {
    clearHold();
    if (pressedRef.current) return;
    pressedRef.current = true;
    setPressed(true);
    haptic(12);
    handlers.current.onPress();
  };

  /* Wheel and trackpad scroll are attached natively so preventDefault works —
     React's synthetic wheel listener cannot stop the page from scrolling. */
  useEffect(() => {
    const el = surfaceRef.current;
    if (!el) return;
    const onScroll = (event: WheelEvent) => {
      event.preventDefault();
      onWheel?.(event.deltaX, event.deltaY, event.ctrlKey || event.metaKey);
    };
    el.addEventListener('wheel', onScroll, { passive: false });
    return () => el.removeEventListener('wheel', onScroll);
  }, [onWheel]);

  const handleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    // Stop the browser from turning the touch into a scroll, selection or
    // long-press callout — each of those cancels the pointer stream.
    e.preventDefault();
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    // One finger owns the pad; a second one must not mix into the same gesture
    if (activeIdRef.current !== null) return;
    activeIdRef.current = e.pointerId;

    try {
      surfaceRef.current?.setPointerCapture(e.pointerId);
    } catch {
      /* no capture support — the gesture still tracks inside the pad */
    }
    lastRef.current = { x: e.clientX, y: e.clientY };
    startRef.current = { x: e.clientX, y: e.clientY };
    hoverRef.current = { x: e.clientX, y: e.clientY };
    pressedRef.current = false;
    movedRef.current = false;
    clearHold();
    holdRef.current = window.setTimeout(beginPress, HOLD_MS);
  };

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // No button down: a mouse or trackpad steers the crosshair on hover, which
    // is what makes the pad usable from a laptop without clicking to aim.
    if (activeIdRef.current === null) {
      if (e.pointerType === 'touch') return;
      const last = hoverRef.current;
      hoverRef.current = { x: e.clientX, y: e.clientY };
      if (!last) return;
      const hx = e.clientX - last.x;
      const hy = e.clientY - last.y;
      if (hx === 0 && hy === 0) return;
      handlers.current.onMove(hx * SENSITIVITY, hy * SENSITIVITY);
      return;
    }

    if (e.pointerId !== activeIdRef.current) return;
    e.preventDefault();

    const last = lastRef.current;
    if (!last) return;

    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    if (dx === 0 && dy === 0) return;
    lastRef.current = { x: e.clientX, y: e.clientY };
    handlers.current.onMove(dx * SENSITIVITY, dy * SENSITIVITY);

    if (pressedRef.current) {
      handlers.current.onDrag();
      return;
    }

    const start = startRef.current;
    if (!movedRef.current && start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_SLOP) {
      movedRef.current = true;
      clearHold();
    }
  };

  const finish = (e: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    if (e.pointerId !== activeIdRef.current) return;
    activeIdRef.current = null;
    clearHold();
    try {
      surfaceRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    lastRef.current = null;
    startRef.current = null;

    if (pressedRef.current) {
      pressedRef.current = false;
      setPressed(false);
      handlers.current.onRelease();
      return;
    }

    if (cancelled || movedRef.current) return;

    // A tap is a click at the crosshair. Releasing on the next task lets the
    // canvas finish reacting to the press before it sees the release.
    handlers.current.onPress();
    window.setTimeout(() => handlers.current.onRelease(), 0);
  };

  return (
    <div
      className="pointer-events-none absolute bottom-2 left-1/2 z-20 -translate-x-1/2"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="pointer-events-auto relative">
        <div
          ref={surfaceRef}
          role="application"
          aria-label="Precision pad. Move or drag to steer the crosshair, tap or click to press, hold and drag to pull a node or handle. Scroll pans and Command-scroll zooms."
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={(e) => finish(e)}
          onPointerCancel={(e) => finish(e, true)}
          onPointerLeave={() => {
            if (activeIdRef.current === null) hoverRef.current = null;
          }}
          onContextMenu={(e) => e.preventDefault()}
          style={{
            touchAction: 'none',
            WebkitTouchCallout: 'none',
            WebkitUserSelect: 'none',
            userSelect: 'none',
            WebkitTapHighlightColor: 'transparent',
            overscrollBehavior: 'contain',
          }}
          className={`relative h-[78px] w-[210px] touch-none select-none overflow-hidden rounded-2xl border bg-ink-2/85 shadow-lg shadow-black/40 backdrop-blur transition-colors ${
            pressed ? 'border-accent/70' : 'border-line'
          }`}
        >
          {/* Faint grain so the surface reads as a pad, not a card */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.5]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.09) 1px, transparent 0)',
              backgroundSize: '7px 7px',
            }}
          />
          {/* Centre reticle */}
          <span
            aria-hidden
            className={`pointer-events-none absolute left-1/2 top-1/2 h-px w-3.5 -translate-x-1/2 -translate-y-1/2 ${
              pressed ? 'bg-accent/70' : 'bg-dim/30'
            }`}
          />
          <span
            aria-hidden
            className={`pointer-events-none absolute left-1/2 top-1/2 h-3.5 w-px -translate-x-1/2 -translate-y-1/2 ${
              pressed ? 'bg-accent/70' : 'bg-dim/30'
            }`}
          />
          <span
            aria-hidden
            className={`pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[8px] uppercase tracking-[0.14em] ${
              pressed ? 'text-accent/80' : 'text-mute/70'
            }`}
          >
            {pressed ? 'press' : 'aim · tap · hold'}
          </span>
        </div>

        <button
          type="button"
          aria-label="Close precision pad"
          onClick={() => {
            haptic(8);
            onClose();
          }}
          className="press absolute -right-1.5 -top-1.5 grid h-[19px] w-[19px] place-items-center rounded-full border border-line bg-ink-1 text-mute hover:text-text"
        >
          <X size={10} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
};
