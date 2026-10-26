import React from 'react';
import { X } from 'lucide-react';
import { haptic } from '../../theme';

/* ------------------------------------------------------------------
   Shared primitives. Everything in the studio is built from these so
   spacing, radii and states stay identical across every surface.
   ------------------------------------------------------------------ */

type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

const BTN_BASE =
  'press inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap rounded-xl ' +
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
    className={`press grid place-items-center rounded-xl border disabled:pointer-events-none disabled:opacity-30 ${
      size === 'sm' ? 'h-8 w-8' : 'h-10 w-10'
    } ${
      active
        ? 'bg-accent text-ink-0 border-accent'
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
    className={`press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold disabled:opacity-35 disabled:pointer-events-none ${
      active
        ? 'border-accent bg-accent text-ink-0'
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
    <div className={`flex items-center gap-1 rounded-xl border border-line bg-ink-0 p-1 ${className}`}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => {
            haptic(6);
            onChange(o.value);
          }}
          className={`press h-8 min-w-0 flex-1 truncate rounded-lg px-1.5 text-[11.5px] font-semibold ${
            value === o.value ? 'bg-accent text-ink-0' : 'text-dim hover:text-text'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Bottom sheet on phones, centred dialog from md up. */
export interface SheetProps {
  open: boolean;
  onClose: () => void;
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
  title,
  subtitle,
  eyebrow,
  children,
  footer,
  action,
  size = 'md',
  bodyClassName = '',
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
        className={`anim-sheet sheet-surface relative flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-sheet md:rounded-2xl ${SHEET_WIDTH[size]} md:anim-pop`}
      >
        {/* Grab handle (phones) */}
        <div className="flex justify-center pt-2 md:hidden">
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
    <div className="fixed inset-0 z-40">
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
        className={`anim-rise absolute inset-x-2 bottom-[calc(100px+env(safe-area-inset-bottom,0px))] flex max-h-[42dvh] flex-col overflow-hidden rounded-2xl border shadow-[0_24px_60px_-24px_rgba(0,0,0,0.95)] md:inset-x-auto md:bottom-[112px] md:right-3 md:top-14 md:max-h-none md:w-[336px] ${
          interactive
            ? 'border-line/80 bg-ink-1/55 backdrop-blur-[3px]'
            : 'border-line bg-ink-1/80 backdrop-blur-xl'
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
      <div className="anim-rise flex items-center gap-2 rounded-full border border-line bg-ink-2/95 px-3.5 py-2 text-[12px] font-medium text-text shadow-2xl backdrop-blur">
        <span className="h-1.5 w-1.5 rounded-full bg-accent" />
        {message}
      </div>
    </div>
  );
};
