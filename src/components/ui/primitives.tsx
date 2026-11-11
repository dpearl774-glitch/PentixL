import React from 'react';
import { X } from 'lucide-react';
import { haptic } from '../../theme';

/* ------------------------------------------------------------------
   Shared primitives. Everything in the studio is built from these so
   spacing, radii and states stay identical across every surface.
   ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

/* Spectrum keeps 1px borders, 4–6px radii and one shadow for transient
   surfaces. The studio follows that: square-ish controls, hairlines, no glow. */
const BTN_BASE =
  'press inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap rounded-md ' +
  'disabled:opacity-35 disabled:pointer-events-none select-none';

const BTN_VARIANT: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-ink-0 hover:bg-accent-dim',
  secondary: 'bg-ink-3 text-text border border-line hover:border-line-strong',
  quiet: 'text-dim hover:text-text hover:bg-ink-3',
  danger: 'bg-ink-3 text-danger border border-line hover:border-danger/50',
};

const BTN_SIZE: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[12px]',
  md: 'h-10 px-4 text-[13px]',
  lg: 'h-12 px-5 text-sm',
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'secondary',
  size = 'md',
  block,
  className = '',
  onClick,
  ...rest
}) => (
  <button
    type="button"
    onClick={(e) => {
      haptic(6);
      onClick?.(e);
    }}
    className={`${BTN_BASE} ${BTN_VARIANT[variant]} ${BTN_SIZE[size]} ${block ? 'w-full' : ''} ${className}`}
    {...rest}
  />
);

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  active?: boolean;
  tone?: 'default' | 'danger';
  size?: 'sm' | 'md';
}

export const IconButton: React.FC<IconButtonProps> = ({
  label,
  active = false,
  tone = 'default',
  size = 'md',
  className = '',
  children,
  onClick,
  ...rest
}) => (
  <button
    type="button"
    aria-label={label}
    aria-pressed={active}
    onClick={(e) => {
      haptic(6);
      onClick?.(e);
    }}
    className={`press grid place-items-center rounded-md border disabled:pointer-events-none disabled:opacity-30 ${
      size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
    } ${
      active
        ? 'bg-line-strong text-text border-line-strong'
        : tone === 'danger'
          ? 'bg-transparent text-danger border-transparent hover:bg-ink-3'
          : 'bg-transparent text-dim border-transparent hover:text-text hover:bg-ink-3'
    } ${className}`}
    {...rest}
  >
    {children}
  </button>
);

export interface ChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: React.ReactNode;
}

export const Chip: React.FC<ChipProps> = ({
  active = false,
  icon,
  className = '',
  children,
  onClick,
  ...rest
}) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={(e) => {
      haptic(6);
      onClick?.(e);
    }}
    className={`press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-3 text-[12px] font-semibold disabled:opacity-35 disabled:pointer-events-none ${
      active
        ? 'border-line-strong bg-line-strong text-text'
        : 'border-line bg-ink-2 text-dim hover:text-text hover:border-line-strong'
    } ${className}`}
    {...rest}
  >
    {icon}
    {children}
  </button>
);

export const SectionLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => <div className={`label-mono ${className}`}>{children}</div>;

/** Two-or-more option segmented switch. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T;
  options: { value: T; label: React.ReactNode }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1 rounded-md border border-line bg-ink-0 p-[3px] ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => {
            haptic(6);
            onChange(o.value);
          }}
          className={`press h-8 min-w-0 flex-1 truncate rounded-[5px] px-1.5 text-[11.5px] font-semibold ${
            value === o.value ? 'bg-ink-3 text-text' : 'text-dim hover:text-text'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Range input with click/drag intent detection. The native control stays in
 * place for keyboard access and painting, but the overlay owns pointer
 * gestures: a tap sets a value, horizontal movement scrubs, and vertical
 * movement is left to the sheet so scrolling never changes a slider.
 */
export const RangeInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = ({
  className = '',
  disabled,
  value,
  onChange,
  ...rest
}) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const gesture = React.useRef<{
    startX: number;
    startY: number;
    axis: 'x' | 'y' | null;
  } | null>(null);

  const setFromClientX = (clientX: number) => {
    const input = inputRef.current;
    if (!input) return;
    const rect = input.getBoundingClientRect();
    if (rect.width <= 0) return;
    const min = input.min === '' ? 0 : Number(input.min);
    const max = input.max === '' ? 100 : Number(input.max);
    const step = input.step === '' ? 1 : Number(input.step);
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const raw = min + ratio * (max - min);
    const decimals = Number.isFinite(step) && step > 0
      ? (String(step).split('.')[1]?.length ?? 0)
      : 0;
    const snapped = Number.isFinite(step) && step > 0
      ? Number((min + Math.round((raw - min) / step) * step).toFixed(Math.min(6, decimals)))
      : raw;
    const next = Math.min(max, Math.max(min, snapped));
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set;
    if (setter) setter.call(input, String(next));
    else input.value = String(next);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const finish = (clientX?: number) => {
    const state = gesture.current;
    if (state && state.axis !== 'y' && clientX !== undefined) setFromClientX(clientX);
    gesture.current = null;
  };

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        type="range"
        {...rest}
        disabled={disabled}
        value={value}
        onChange={onChange}
        className="pointer-events-none block w-full"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 touch-pan-y cursor-pointer"
        onPointerDown={(e) => {
          if (disabled) return;
          inputRef.current?.focus({ preventScroll: true });
          gesture.current = { startX: e.clientX, startY: e.clientY, axis: null };
          try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
        }}
        onPointerMove={(e) => {
          const state = gesture.current;
          if (!state) return;
          const dx = Math.abs(e.clientX - state.startX);
          const dy = Math.abs(e.clientY - state.startY);
          if (!state.axis) {
            if (dx < 4 && dy < 4) return;
            state.axis = dy > dx ? 'y' : 'x';
          }
          if (state.axis === 'x') setFromClientX(e.clientX);
        }}
        onPointerUp={(e) => finish(e.clientX)}
        onPointerCancel={() => finish()}
      />
    </div>
  );
};

/** Bottom sheet on phones, centred dialog from md up. */
export interface SheetProps {
  open: boolean;
  onClose: () => void;
  /** Optional action for the header Done button; falls back to onClose. */
  onDone?: () => void;
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Optional trailing element in the header row */
  action?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  bodyClassName?: string;
}

const SHEET_WIDTH: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'md:max-w-sm',
  md: 'md:max-w-lg',
  lg: 'md:max-w-3xl',
};

export const Sheet: React.FC<SheetProps> = ({
  open,
  onClose,
  onDone,
  title,
  subtitle,
  eyebrow,
  children,
  footer,
  action,
  size = 'md',
  bodyClassName = '',
}) => {
  const [viewportHeight, setViewportHeight] = React.useState<number | null>(null);
  const [dragY, setDragY] = React.useState(0);
  const dragStartRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!open || !window.visualViewport) return;
    const vv = window.visualViewport;
    const update = () => setViewportHeight(vv.height);
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <button
        aria-label="Close"
        onClick={onClose}
        className="anim-scrim absolute inset-0 bg-black/65 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`anim-sheet sheet-surface relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-sheet md:rounded-xl ${SHEET_WIDTH[size]} md:anim-pop`}
        style={{
          maxHeight: viewportHeight ? Math.min(window.innerHeight * 0.88, viewportHeight - 12) : undefined,
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: dragY > 0 ? 'none' : undefined,
        }}
      >
        {/* Grab handle (phones) */}
        <div
          className="flex touch-none justify-center pt-2 md:hidden"
          onPointerDown={(e) => {
            dragStartRef.current = e.clientY;
            try {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
          }}
          onPointerMove={(e) => {
            if (dragStartRef.current === null) return;
            setDragY(Math.max(0, e.clientY - dragStartRef.current));
          }}
          onPointerUp={() => {
            if (dragY > 80) onClose();
            dragStartRef.current = null;
            setDragY(0);
          }}
          onPointerCancel={() => {
            dragStartRef.current = null;
            setDragY(0);
          }}
        >
          <div className="h-1 w-9 rounded-full bg-line-strong" />
        </div>

        <header className="flex items-start justify-between gap-3 px-5 pt-3 pb-3">
          <div className="min-w-0">
            {eyebrow && <div className="label-mono mb-1.5">{eyebrow}</div>}
            <h2 className="truncate text-[15px] font-bold tracking-tight text-text">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[11.5px] leading-snug text-mute">{subtitle}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {action}
            {/* Close from the top: long panels should never need a scroll to
                the very bottom before they can be dismissed. */}
            <button
              type="button"
              aria-label="Done"
              onClick={() => {
                haptic(6);
                (onDone ?? onClose)();
              }}
              className="press h-8 rounded-lg border border-line bg-ink-3 px-3 text-[12px] font-semibold text-text"
            >
              Done
            </button>
            <IconButton label="Close panel" onClick={onClose} size="sm">
              <X size={15} />
            </IconButton>
          </div>
        </header>

        <div className={`min-h-0 flex-1 overflow-y-auto px-5 pb-4 ${bodyClassName}`}>{children}</div>

        {footer && (
          <footer className="safe-bottom border-t border-line bg-ink-0/60 px-5 py-3">{footer}</footer>
        )}
      </div>
    </div>
  );
};

/**
 * Non-modal floating panel. No dimming scrim and a see-through surface, so the
 * artwork stays visible while you toggle layers or references.
 *
 * `interactive` drops the blocking backdrop entirely: the canvas underneath
 * stays live, so you can keep drawing and watch the change happen.
 */
export interface PanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  eyebrow?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Let canvas gestures pass through the area outside the panel */
  interactive?: boolean;
}

export const Panel: React.FC<PanelProps> = ({
  open,
  onClose,
  title,
  eyebrow = 'Panel',
  action,
  children,
  footer,
  interactive = false,
}) => {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className={`fixed inset-0 z-40 ${interactive ? 'pointer-events-none' : ''}`}>
      <button
        aria-label="Close panel"
        onClick={onClose}
        className={`absolute inset-0 h-full w-full ${
          interactive ? 'pointer-events-none' : 'cursor-default'
        }`}
      />
      <aside
        role="dialog"
        aria-label={title}
        className={`anim-rise absolute inset-x-2 bottom-[calc(100px+env(safe-area-inset-bottom,0px))] flex max-h-[42dvh] flex-col overflow-hidden rounded-[10px] border shadow-[0_12px_32px_-16px_rgba(0,0,0,0.85)] md:inset-x-auto md:bottom-[112px] md:right-3 md:top-14 md:max-h-none md:w-[336px] ${
          interactive
            ? 'pointer-events-auto border-line/80 bg-ink-1/75 backdrop-blur-[2px]'
            : 'border-line bg-ink-1/95'
        }`}
      >
        <header className="flex items-center justify-between gap-2 border-b border-line/70 bg-ink-1/70 px-3 py-2">
          <div className="min-w-0">
            <div className="label-mono mb-0.5">{eyebrow}</div>
            <h2 className="truncate text-[13px] font-bold tracking-tight text-text">{title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {action}
            <IconButton label="Close panel" size="sm" onClick={onClose}>
              <X size={14} />
            </IconButton>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">{children}</div>
        {footer && <footer className="border-t border-line/70 px-3 py-2">{footer}</footer>}
      </aside>
    </div>
  );
};

/** Small floating message shown above the dock. */
export const Toast: React.FC<{ message: string | null }> = ({ message }) => {
  if (!message) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-14 z-40 flex justify-center px-4">
      <div className="anim-rise flex items-center gap-2 rounded-md border border-line bg-ink-2/95 px-3.5 py-2 text-[12px] font-medium text-text shadow-lg">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        {message}
      </div>
    </div>
  );
};
