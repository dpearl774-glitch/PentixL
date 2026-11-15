import React from 'react';
import { Newspaper, RefreshCw } from 'lucide-react';

interface UpdateBannerProps {
  open: boolean;
  onReload: () => void;
  onDismiss: () => void;
  onWhatsNew: () => void;
}

/**
 * A new build is downloaded and waiting. It does not swap itself in: the work
 * in progress has to survive, so the reload is the user's decision.
 */
export const UpdateBanner: React.FC<UpdateBannerProps> = ({
  open,
  onReload,
  onDismiss,
  onWhatsNew,
}) => {
  if (!open) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-40 flex justify-center px-3">
      <div className="anim-rise pointer-events-auto w-full max-w-[420px] rounded-xl border border-accent/40 bg-ink-2/95 px-3 py-2.5 shadow-xl shadow-black/50 backdrop-blur">
        <div className="flex items-center gap-2">
          <RefreshCw size={14} className="shrink-0 text-accent" />
          <span className="min-w-0 flex-1 text-[12px] font-semibold text-text">
            A new version is ready
          </span>
          <button
            type="button"
            onClick={onDismiss}
            className="press shrink-0 rounded-md px-2 py-1 text-[11px] font-semibold text-mute"
          >
            Later
          </button>
          <button
            type="button"
            onClick={onReload}
            className="press shrink-0 rounded-md bg-accent/20 px-2.5 py-1 text-[11px] font-bold text-accent"
          >
            Reload
          </button>
        </div>
        <button
          type="button"
          onClick={onWhatsNew}
          className="press mt-1 flex items-center gap-1.5 pl-6 text-[11px] text-dim"
        >
          <Newspaper size={11} className="text-accent/80" />
          See what changed
        </button>
      </div>
    </div>
  );
};
