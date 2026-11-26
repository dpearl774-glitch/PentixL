import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Eye,
  Grid3x3,
  Layers,
  Menu,
  MoreHorizontal,
  Pencil,
  Redo2,
  Share2,
  Undo2,
} from 'lucide-react';
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
  /** Alignment grid — off by default, so it needs one tap from the bar */
  gridVisible: boolean;
  onToggleGrid: () => void;
  onOpenExport: () => void;
  /** Shows only the artboard, hiding every panel and editing aid */
  onPreview: () => void;
}

/**
 * Document bar. The phone gets one primary action (Export) and one overflow
 * menu; undo/redo stay visible because they are the two actions reached for
 * most often. Layers, grid and preview no longer compete for the same 346 px.
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
  gridVisible,
  onToggleGrid,
  onOpenExport,
  onPreview,
}) => {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(projectName);
  const [moreOpen, setMoreOpen] = useState(false);
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
    <header className="relative z-30 flex h-14 shrink-0 items-center gap-1 border-b border-line bg-ink-1 px-2">
      <IconButton label="Open menu" onClick={onOpenMenu}>
        <Menu size={19} />
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
          className="h-9 min-w-0 flex-1 rounded-lg border border-accent/60 bg-ink-0 px-2.5 text-[14px] font-semibold text-text outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="press -ml-0.5 flex h-9 min-w-0 flex-1 items-center gap-1.5 rounded-lg px-1.5 text-left"
          title="Rename document"
        >
          <span className="truncate text-[13.5px] font-semibold tracking-[-0.01em] text-text">
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

      <div className="flex shrink-0 items-center">
        <IconButton label="Undo" onClick={onUndo} disabled={!canUndo}>
          <Undo2 size={18} />
        </IconButton>
        <IconButton label="Redo" onClick={onRedo} disabled={!canRedo}>
          <Redo2 size={18} />
        </IconButton>
      </div>

      <IconButton
        label="More actions"
        active={moreOpen}
        aria-expanded={moreOpen}
        onClick={() => setMoreOpen((open) => !open)}
      >
        <MoreHorizontal size={19} />
      </IconButton>

      <button
        type="button"
        onClick={onOpenExport}
        aria-label="Export"
        data-tour="export"
        title="Export"
        className="press ml-0.5 flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-3 font-sans text-[11px] font-bold text-ink-0"
      >
        <Share2 size={14} />
        Export
      </button>

      {moreOpen && (
        <button
          type="button"
          aria-label="Close more actions"
          className="fixed inset-0 z-20 cursor-default"
          onClick={() => setMoreOpen(false)}
        />
      )}

      {/* Kept mounted so the bar has one stable markup; hidden when closed. */}
      <div
        className={`absolute right-2 top-[54px] z-40 w-56 overflow-hidden rounded-xl border border-line bg-ink-2 p-1 shadow-2xl shadow-black/50 ${
          moreOpen ? '' : 'hidden'
        }`}
      >
        <button
          type="button"
          aria-label="Layers and objects"
          onClick={() => {
            setMoreOpen(false);
            onOpenLayers();
          }}
          className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[12.5px] font-medium text-text hover:bg-ink-3"
        >
          <Layers size={17} className="text-dim" />
          Layers
          {layersCount > 0 && (
            <span className="ml-auto rounded-full bg-ink-3 px-2 py-0.5 font-mono text-[10px] text-dim">
              {layersCount}
            </span>
          )}
        </button>
        <button
          type="button"
          aria-label="Alignment grid"
          aria-pressed={gridVisible}
          onClick={() => {
            onToggleGrid();
            setMoreOpen(false);
          }}
          className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[12.5px] font-medium text-text hover:bg-ink-3"
        >
          <Grid3x3 size={17} className="text-dim" />
          Grid
          {gridVisible && <Check size={15} className="ml-auto text-accent" />}
        </button>
        <button
          type="button"
          aria-label="Preview artboard"
          onClick={() => {
            setMoreOpen(false);
            onPreview();
          }}
          className="flex h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-[12.5px] font-medium text-text hover:bg-ink-3"
        >
          <Eye size={17} className="text-dim" />
          Preview
        </button>
      </div>
    </header>
  );
};
