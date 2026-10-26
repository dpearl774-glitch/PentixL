import React, { useState, useRef } from 'react';
import {
  Download,
  Layers,
  RotateCcw,
  Undo2,
  Redo2,
  LayoutTemplate,
  HelpCircle,
  FolderOpen,
  Save,
  Check,
  Edit3,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';
import { ReferenceImage } from '../types/vector';

interface TopBarProps {
  onOpenTemplates: () => void;
  onOpenShapeBuilder: () => void;
  onOpenLayers: () => void;
  isLayerPanelOpen: boolean;
  layersCount: number;
  isPanZoomLocked: boolean;
  onToggleLockPanZoom: () => void;
  smartGuidesEnabled?: boolean;
  onToggleSmartGuides?: () => void;
  onOpenGuide: () => void;
  onOpenExport: () => void;
  zoom: number;
  onZoomChange: (newZoom: number) => void;
  onResetView: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  projectName: string;
  onRenameProject: (name: string) => void;
  onSaveProject: () => void;
  isProjectSaved: boolean;
  onOpenProjects: () => void;
  projectsCount: number;
  onOpenImageTracer?: () => void;
  onOpenCustomFontModal?: () => void;
  customFontsCount?: number;
  onAddReferenceImage?: (image: ReferenceImage) => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onOpenTemplates,
  onOpenLayers,
  isLayerPanelOpen,
  layersCount,
  onOpenGuide,
  onOpenExport,
  zoom,
  onResetView,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  projectName,
  onRenameProject,
  onSaveProject,
  isProjectSaved,
  onOpenProjects,
  projectsCount,
}) => {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState(projectName);

  const handleTitleSubmit = () => {
    if (titleInput.trim() && titleInput !== projectName) {
      onRenameProject(titleInput.trim());
    }
    setIsEditingTitle(false);
  };

  return (
    <header className="bg-[#070B14] border-b border-slate-800 z-30 select-none h-11 sm:h-12 px-2 sm:px-4 flex items-center justify-between gap-2">
      {/* LEFT: Logo & Editable Title */}
      <div className="flex items-center gap-2 shrink-0">
        <a href="/" className="flex items-center gap-1.5 shrink-0">
          <div className="w-5 h-5 rounded bg-cyan-400 text-slate-950 font-black text-xs flex items-center justify-center font-mono">
            P
          </div>
          <span className="font-extrabold text-xs sm:text-sm text-white tracking-tight hidden xs:inline">
            Pentix
          </span>
        </a>

        {/* Project Title */}
        {isEditingTitle ? (
          <input
            type="text"
            value={titleInput}
            onChange={(e) => setTitleInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTitleSubmit();
              if (e.key === 'Escape') {
                setTitleInput(projectName);
                setIsEditingTitle(false);
              }
            }}
            onBlur={handleTitleSubmit}
            autoFocus
            className="bg-slate-900 border border-cyan-400 rounded px-2 py-0.5 text-xs font-bold text-white max-w-[110px] focus:outline-none"
          />
        ) : (
          <button
            onClick={() => {
              setTitleInput(projectName);
              setIsEditingTitle(true);
            }}
            className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-slate-800 text-xs font-bold text-slate-200 truncate max-w-[110px] sm:max-w-[160px] border border-transparent hover:border-slate-700"
            title="Click to rename"
          >
            <span className="truncate">{projectName}</span>
            <Edit3 size={10} className="text-slate-500 shrink-0" />
          </button>
        )}
      </div>

      {/* CENTER: Undo / Redo & Zoom % */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={onUndo}
          disabled={!canUndo}
          className={`p-1.5 rounded hover:bg-slate-800 transition-colors ${
            canUndo ? 'text-slate-200' : 'text-slate-600 cursor-not-allowed'
          }`}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 size={14} />
        </button>
        <button
          onClick={onRedo}
          disabled={!canRedo}
          className={`p-1.5 rounded hover:bg-slate-800 transition-colors ${
            canRedo ? 'text-slate-200' : 'text-slate-600 cursor-not-allowed'
          }`}
          title="Redo (Ctrl+Y)"
        >
          <Redo2 size={14} />
        </button>

        <button
          onClick={onResetView}
          className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[11px] font-medium flex items-center gap-1 ml-1"
          title="Reset Zoom"
        >
          <RotateCcw size={10} className="text-cyan-400" />
          <span>{Math.round(zoom * 100)}%</span>
        </button>
      </div>

      {/* RIGHT: Save & Export */}
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={onSaveProject}
          className={`px-2.5 py-1 text-xs font-bold rounded flex items-center gap-1 transition-all ${
            isProjectSaved
              ? 'bg-slate-800 text-emerald-400 border border-slate-700'
              : 'bg-slate-800 hover:bg-slate-700 text-white border border-slate-700'
          }`}
          title="Save Project"
        >
          {isProjectSaved ? <Check size={13} className="text-emerald-400" /> : <Save size={13} className="text-cyan-400" />}
          <span className="hidden xs:inline">{isProjectSaved ? 'Saved' : 'Save'}</span>
        </button>

        <button
          onClick={onOpenExport}
          className="px-2.5 py-1 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded flex items-center gap-1 transition-all"
          title="Export Artwork"
        >
          <Upload size={13} />
          <span>Export</span>
        </button>
      </div>
    </header>
  );
};
