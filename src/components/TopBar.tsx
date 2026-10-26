import React, { useEffect, useRef, useState } from 'react';
import { Layers, Menu, Pencil, Redo2, Share2, Undo2 } from 'lucide-react';
import { IconButton } from './ui/primitives';

interface TopBarProps {
  projectName: string;
  isSaved: boolean;
  layersCount: number;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onRenameProject: (name: string) => void;
  onOpenMenu: () => void;
  onOpenLayers: () => void;
  onOpenExport: () => void;
}

/**
 * Document bar. Undo/redo live here because they are the two actions you reach
 * for most often, and they stay put while the canvas viewport changes.
 */
export const TopBar: React.FC<TopBarProps> = ({
  projectName,
  isSaved,
  layersCount,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onRenameProject,
  onOpenMenu,
  onOpenLayers,
  onOpenExport,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(projectName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(projectName);
  }, [projectName, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const next = draft.trim();
    if (next && next !== projectName) onRenameProject(next);
    setEditing(false);
  };

  return (
    <header className="z-30 flex h-12 shrink-0 items-center gap-0.5 border-b border-line bg-ink-1 px-1.5">
      <IconButton label="Open menu" onClick={onOpenMenu}>
        <Menu size={18} />
      </IconButton>

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit();
            if (e.key === 'Escape') {
              setDraft(projectName);
              setEditing(false);
            }
          }}
          className="h-8 min-w-0 flex-1 rounded-lg border border-accent/60 bg-ink-0 px-2 text-[13px] font-semibold text-text outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="press -ml-0.5 flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1.5 py-1 text-left"
          title="Rename document"
        >
          <span className="truncate text-[13px] font-bold tracking-tight text-text">
            {projectName}
          </span>
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              isSaved ? 'bg-line-strong' : 'bg-accent'
            }`}
            title={isSaved ? 'Saved locally' : 'Unsaved changes'}
          />
          <Pencil size={10} className="shrink-0 text-mute" />
        </button>
      )}

      <div className="flex shrink-0 items-center rounded-xl border border-line bg-ink-0/60">
        <IconButton label="Undo" onClick={onUndo} disabled={!canUndo}>
          <Undo2 size={17} />
        </IconButton>
        <span className="h-5 w-px bg-line" />
        <IconButton label="Redo" onClick={onRedo} disabled={!canRedo}>
          <Redo2 size={17} />
        </IconButton>
      </div>

      <IconButton label="Layers and objects" onClick={onOpenLayers} className="relative">
        <Layers size={17} />
        {layersCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-line-strong px-1 font-mono text-[9px] font-bold text-text">
            {layersCount}
          </span>
        )}
      </IconButton>

      <button
        type="button"
        onClick={onOpenExport}
        aria-label="Export"
        title="Export"
        className="press ml-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent text-ink-0"
      >
        <Share2 size={16} />
      </button>
    </header>
  );
};
