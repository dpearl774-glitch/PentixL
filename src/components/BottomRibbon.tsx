import React, { useState, useRef } from 'react';
import {
  FolderOpen,
  Type,
  Hexagon,
  Layers,
  Sparkles,
  Square,
  PenTool,
  Brush,
  Combine,
  Image as ImageIcon,
  Grid,
  Magnet,
  Lock,
  RotateCcw,
  Palette,
  Plus,
  Copy,
  Trash2,
  FlipHorizontal,
  FlipVertical,
  Scissors,
  Download,
  Upload,
  FolderInput,
} from 'lucide-react';
import { ToolType, ShapeKind, ReferenceImage } from '../types/vector';

const ShapeBuilderIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="9" cy="9" r="6" />
    <circle cx="15" cy="14" r="6" strokeDasharray="2.5 2" />
    <path d="M12 9v6" />
    <path d="M9 12h6" />
  </svg>
);

export type RibbonCategory = 'projects' | 'text' | 'shapes' | 'canvas' | 'layers';

interface BottomRibbonProps {
  currentTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  currentShapeKind: ShapeKind;
  onOpenShapePicker: () => void;
  onInsertShapeDirect: (kind: ShapeKind) => void;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  onOpenColorPicker: (mode: 'fill' | 'stroke') => void;
  onOpenProjects: () => void;
  onOpenTemplates: () => void;
  onOpenExport: () => void;
  onOpenTextInputModal?: () => void;
  onOpenCustomFontModal: () => void;
  onOpenImageTracer: () => void;
  onAddReferenceImage: (image: ReferenceImage) => void;
  gridVisible: boolean;
  onToggleGrid: () => void;
  gridSnapEnabled: boolean;
  onToggleGridSnap: () => void;
  isPanZoomLocked: boolean;
  onToggleLockPanZoom: () => void;
  onResetView: () => void;
  onOpenLayers: () => void;
  layersCount: number;
  hasSelection: boolean;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onFlipSelected: (dir: 'horizontal' | 'vertical') => void;
}

export const BottomRibbon: React.FC<BottomRibbonProps> = ({
  currentTool,
  onSelectTool,
  currentShapeKind,
  onOpenShapePicker,
  onInsertShapeDirect,
  fillColor,
  strokeColor,
  strokeWidth,
  onOpenColorPicker,
  onOpenProjects,
  onOpenTemplates,
  onOpenExport,
  onOpenTextInputModal,
  onOpenCustomFontModal,
  onOpenImageTracer,
  onAddReferenceImage,
  gridVisible,
  onToggleGrid,
  gridSnapEnabled,
  onToggleGridSnap,
  isPanZoomLocked,
  onToggleLockPanZoom,
  onResetView,
  onOpenLayers,
  layersCount,
  hasSelection,
  onDuplicateSelected,
  onDeleteSelected,
  onFlipSelected,
}) => {
  const [activeCategory, setActiveCategory] = useState<RibbonCategory>('shapes');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      if (typeof evt.target?.result === 'string') {
        const newRef: ReferenceImage = {
          id: 'ref-sketch-' + Date.now(),
          name: file.name.replace(/\.[^/.]+$/, ''),
          url: evt.target.result,
          x: 50,
          y: 50,
          width: 500,
          height: 500,
          opacity: 0.5,
          locked: true,
          visible: true,
        };
        onAddReferenceImage(newRef);
        onSelectTool('pen');
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <aside aria-label="PixelLab Style Tool Dock" className="fixed bottom-0 left-0 right-0 z-40 bg-[#070B14] border-t border-slate-800 text-slate-100 select-none flex flex-col">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        className="hidden"
      />

      {/* TOP CATEGORY RELEVANT RIBBON (Horizontal Scroll Bar directly above tabs) */}
      <div className="px-2 py-1.5 bg-[#0D1322] border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar min-h-[46px]">
        {/* CATEGORY: PROJECTS */}
        {activeCategory === 'projects' && (
          <>
            <button
              onClick={onOpenProjects}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0"
            >
              <FolderOpen size={14} />
              <span>My Projects</span>
            </button>

            <button
              onClick={onOpenTemplates}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0"
            >
              <Sparkles size={14} className="text-amber-400" />
              <span>Logo Blueprints</span>
            </button>

            <button
              onClick={onOpenExport}
              className="px-3 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0"
            >
              <Upload size={14} />
              <span>Export SVG / PNG</span>
            </button>
          </>
        )}

        {/* CATEGORY: TEXT */}
        {activeCategory === 'text' && (
          <>
            <button
              onClick={() => {
                onSelectTool('text');
                if (onOpenTextInputModal) onOpenTextInputModal();
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 border ${
                currentTool === 'text'
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              <Plus size={14} />
              <span>Add Text</span>
            </button>

            <button
              onClick={onOpenCustomFontModal}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0"
            >
              <Type size={14} className="text-cyan-400" />
              <span>Custom Fonts</span>
            </button>
          </>
        )}

        {/* CATEGORY: SHAPES & OBJECTS */}
        {activeCategory === 'shapes' && (
          <>
            {/* Visual Shapes Grid Picker Button */}
            <button
              onClick={onOpenShapePicker}
              className="px-3 py-1 bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/25 rounded-lg text-xs font-bold flex items-center gap-1.5 shrink-0"
            >
              <Square size={14} />
              <span>Shapes Grid (17)</span>
            </button>

            {/* Quick Shape Presets */}
            {[
              { kind: 'rectangle' as ShapeKind, label: 'Square' },
              { kind: 'circle' as ShapeKind, label: 'Circle' },
              { kind: 'triangle' as ShapeKind, label: 'Triangle' },
              { kind: 'star' as ShapeKind, label: 'Star' },
            ].map((s) => (
              <button
                key={s.kind}
                onClick={() => onInsertShapeDirect(s.kind)}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium shrink-0"
              >
                + {s.label}
              </button>
            ))}

            <div className="h-4 w-[1px] bg-slate-800 shrink-0" />

            {/* Pen Tool */}
            <button
              onClick={() => onSelectTool('pen')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 border ${
                currentTool === 'pen'
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              <PenTool size={14} />
              <span>Pen</span>
            </button>

            {/* Brush Tool */}
            <button
              onClick={() => onSelectTool('pressure-brush')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 border ${
                currentTool === 'pressure-brush'
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              <Brush size={14} />
              <span>Brush</span>
            </button>

            {/* Shape Builder */}
            <button
              onClick={() => onSelectTool('shape-builder')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 border ${
                currentTool === 'shape-builder'
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              <ShapeBuilderIcon size={14} />
              <span>Shape Builder</span>
            </button>

            {/* Pathfinder */}
            <button
              onClick={() => onSelectTool('pathfinder')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 border ${
                currentTool === 'pathfinder'
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-200'
              }`}
            >
              <Combine size={14} />
              <span>Pathfinder</span>
            </button>

            {/* Import Sketch */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0"
            >
              <ImageIcon size={14} className="text-cyan-400" />
              <span>Import Sketch</span>
            </button>

            {/* Image Tracer */}
            <button
              onClick={onOpenImageTracer}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0"
            >
              <Sparkles size={14} />
              <span>Auto-Trace</span>
            </button>
          </>
        )}

        {/* CATEGORY: CANVAS */}
        {activeCategory === 'canvas' && (
          <>
            <button
              onClick={onToggleGrid}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 border ${
                gridVisible
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <Grid size={14} />
              <span>Grid {gridVisible ? 'On' : 'Off'}</span>
            </button>

            <button
              onClick={onToggleGridSnap}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 border ${
                gridSnapEnabled
                  ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <Magnet size={14} />
              <span>Snap {gridSnapEnabled ? 'On' : 'Off'}</span>
            </button>

            <button
              onClick={onToggleLockPanZoom}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0 border ${
                isPanZoomLocked
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <Lock size={14} />
              <span>Pan/Zoom {isPanZoomLocked ? 'Locked' : 'Unlocked'}</span>
            </button>

            <button
              onClick={onResetView}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0"
            >
              <RotateCcw size={14} />
              <span>Reset View</span>
            </button>
          </>
        )}

        {/* CATEGORY: LAYERS */}
        {activeCategory === 'layers' && (
          <>
            <button
              onClick={onOpenLayers}
              className="px-3 py-1 bg-cyan-500/15 border border-cyan-500/40 text-cyan-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 shrink-0"
            >
              <Layers size={14} />
              <span>Open Layer Panel ({layersCount})</span>
            </button>
          </>
        )}

        {/* Selection quick actions */}
        {hasSelection && (
          <div className="flex items-center gap-1 shrink-0 ml-auto pl-2 border-l border-slate-800">
            <button
              onClick={onDuplicateSelected}
              className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded"
              title="Duplicate"
            >
              <Copy size={13} />
            </button>
            <button
              onClick={() => onFlipSelected('horizontal')}
              className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded"
              title="Flip Horizontal"
            >
              <FlipHorizontal size={13} />
            </button>
            <button
              onClick={onDeleteSelected}
              className="p-1 bg-rose-950/60 hover:bg-rose-900 text-rose-300 rounded"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* BOTTOM PIXELLAB 5-TAB NAVIGATION BAR */}
      <div className="grid grid-cols-5 bg-[#070B14] py-1 border-t border-slate-800">
        <button
          type="button"
          onClick={() => setActiveCategory('projects')}
          className={`flex flex-col items-center justify-center py-1 gap-0.5 text-[10px] font-medium transition-colors ${
            activeCategory === 'projects' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <FolderOpen size={18} />
          <span>Projects</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveCategory('text');
            onSelectTool('text');
          }}
          className={`flex flex-col items-center justify-center py-1 gap-0.5 text-[10px] font-medium transition-colors ${
            activeCategory === 'text' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <span className="font-serif font-black text-sm leading-none">A</span>
          <span>Text</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveCategory('shapes');
            onSelectTool('select');
          }}
          className={`flex flex-col items-center justify-center py-1 gap-0.5 text-[10px] font-medium transition-colors ${
            activeCategory === 'shapes' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Hexagon size={18} />
          <span>Shapes</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory('canvas')}
          className={`flex flex-col items-center justify-center py-1 gap-0.5 text-[10px] font-medium transition-colors ${
            activeCategory === 'canvas' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Grid size={18} />
          <span>Canvas</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveCategory('layers');
            onOpenLayers();
          }}
          className={`flex flex-col items-center justify-center py-1 gap-0.5 text-[10px] font-medium transition-colors ${
            activeCategory === 'layers' ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Layers size={18} />
          <span>Layers ({layersCount})</span>
        </button>
      </div>
    </aside>
  );
};
