import React from 'react';
import {
  ArrowDownToLine,
  ArrowUpToLine,
  Combine,
  Copy,
  EyeOff,
  Lock,
  LockOpen,
  Trash2,
  X,
} from 'lucide-react';

interface QuickActionsProps {
  name: string;
  combined?: boolean;
  locked: boolean;
  /** Two or more closed shapes exist, so the builder has regions to brush */
  canBuild: boolean;
  onDuplicate: () => void;
  onToFront: () => void;
  onToBack: () => void;
  onToggleLock: () => void;
  onHide: () => void;
  onDelete: () => void;
  onBuild: () => void;
  onClose: () => void;
}

/**
 * What a held finger gets instead of a context menu: one thumb-sized card with
 * the moves that are otherwise two taps deep in Arrange or Layers. It is a
 * shortcut, not a second toolbar — everything here also lives in a panel.
 */
export const QuickActions: React.FC<QuickActionsProps> = ({
  name,
  combined = false,
  locked,
  canBuild,
  onDuplicate,
  onToFront,
  onToBack,
  onToggleLock,
  onHide,
  onDelete,
  onBuild,
  onClose,
}) => {
  const actions = [
    { label: 'Duplicate', icon: <Copy size={14} />, onClick: onDuplicate },
    { label: 'To front', icon: <ArrowUpToLine size={14} />, onClick: onToFront },
    { label: 'To back', icon: <ArrowDownToLine size={14} />, onClick: onToBack },
    {
      label: locked ? 'Unlock' : 'Lock',
      icon: locked ? <LockOpen size={14} /> : <Lock size={14} />,
      onClick: onToggleLock,
    },
    { label: 'Hide', icon: <EyeOff size={14} />, onClick: onHide },
    { label: 'Delete', icon: <Trash2 size={14} />, onClick: onDelete, danger: true },
  ];

  return (
    <div
      className="absolute inset-0 z-30"
      onClick={onClose}
      role="presentation"
      data-quick-actions="open"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="anim-rise absolute inset-x-2 bottom-2 rounded-2xl border border-line bg-ink-2/97 p-2 shadow-2xl shadow-black/50 backdrop-blur"
      >
        <div className="mb-1.5 flex items-center gap-1.5 px-1">
          <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-text">
            {name}
          </span>
          <span className="shrink-0 font-sans text-[9px] font-bold uppercase tracking-[0.12em] text-mute">
            Quick actions
          </span>
          <button
            type="button"
            aria-label="Close quick actions"
            onClick={onClose}
            className="press grid h-8 w-8 shrink-0 place-items-center rounded-lg text-mute hover:bg-ink-3 hover:text-text"
          >
            <X size={15} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              onClick={action.onClick}
              className={`press flex h-11 flex-col items-center justify-center gap-1 rounded-lg bg-ink-3 font-sans text-[9px] font-bold uppercase tracking-[0.04em] ${
                action.danger ? 'text-danger' : 'text-dim hover:text-accent'
              }`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>

        {canBuild && (
          <button
            type="button"
            onClick={onBuild}
            className="press mt-1 flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-accent/15 font-sans text-[10px] font-bold uppercase tracking-[0.06em] text-accent"
          >
            <Combine size={14} /> Shape builder
          </button>
        )}

        {combined && (
          <p className="px-1 pt-1.5 text-[9.5px] leading-snug text-mute">
            Every action here covers the whole selection, lock and hide included.
          </p>
        )}
      </div>
    </div>
  );
};
