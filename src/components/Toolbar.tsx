import React, { useState, useRef } from 'react';
import {
  MousePointer,
  Crosshair,
  PenTool,
  Sparkles,
  Combine,
  Square,
  Circle,
  Hexagon,
  Star,
  Minus,
  Brush,
  Layers,
  Palette,
  Type,
  Hand,
  Image as ImageIcon,
  Upload,
} from 'lucide-react';
import { ToolType, ShapeKind, ReferenceImage } from '../types/vector';

const ShapeBuilderIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
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

interface ToolbarProps {
  currentTool: ToolType;
  onSelectTool: (tool: ToolType) => void;
  currentShapeKind: ShapeKind;
  onSelectShapeKind: (kind: ShapeKind) => void;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  onOpenColorPicker: (mode: 'fill' | 'stroke') => void;
  onOpenPressureSettings: () => void;
  onOpenLayers: () => void;
  layersCount: number;
  onOpenImageTracer?: () => void;
  onAddReferenceImage?: (image: ReferenceImage) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  onSelectTool,
  currentShapeKind,
  onSelectShapeKind,
  fillColor,
  strokeColor,
  strokeWidth,
  onOpenColorPicker,
  onOpenPressureSettings,
  onOpenLayers,
  layersCount,
  onOpenImageTracer,
  onAddReferenceImage,
}) => {
  const [showShapeMenu, setShowShapeMenu] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tools: { id: ToolType; label: string; icon: React.ReactNode; group: 'edit' | 'draw' | 'geometry' }[] = [
    { id: 'select', label: 'Select', icon: <MousePointer size={18} />, group: 'edit' },
    { id: 'direct-select', label: 'Direct', icon: <Crosshair size={18} />, group: 'edit' },
    { id: 'pen', label: 'Pen', icon: <PenTool size={18} />, group: 'draw' },
    { id: 'pressure-brush', label: 'Brush', icon: <Brush size={18} />, group: 'draw' },
    { id: 'shape', label: 'Shapes', icon: <Square size={18} />, group: 'draw' },
    { id: 'text', label: 'Text', icon: <Type size={18} />, group: 'draw' },
    { id: 'shape-builder', label: 'Shape Builder', icon: <ShapeBuilderIcon size={18} />, group: 'geometry' },
    { id: 'pathfinder', label: 'Pathfinder', icon: <Combine size={18} />, group: 'geometry' },
    { id: 'hand', label: 'Pan', icon: <Hand size={18} />, group: 'edit' },
  ];

  const shapes: { id: ShapeKind; label: string; icon: React.ReactNode }[] = [
    { id: 'circle', label: 'Circle', icon: <Circle size={16} /> },
    { id: 'rectangle', label: 'Rectangle', icon: <Square size={16} /> },
    { id: 'polygon', label: 'Hexagon', icon: <Hexagon size={16} /> },
    { id: 'star', label: 'Star', icon: <Star size={16} /> },
    { id: 'line', label: 'Line', icon: <Minus size={16} /> },
  ];

  const handleDirectSketchUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onAddReferenceImage) return;

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
        // Switch to Pen tool so user can immediately trace over sketch
        onSelectTool('pen');
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <>
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleDirectSketchUpload}
        accept="image/*"
        className="hidden"
      />

      {/* Mobile Bottom Dock & Desktop Vertical Tool Palette */}
      <nav 
        aria-label="Vector Tools Dock"
        className="fixed bottom-0 left-0 right-0 md:bottom-auto md:left-3 md:top-20 md:right-auto z-40 bg-[#0D1322]/95 backdrop-blur-md border-t md:border border-slate-800 md:rounded-xl shadow-xl p-1 md:p-1.5 flex md:flex-col items-center justify-around md:justify-start gap-1 select-none overflow-x-auto no-scrollbar"
      >
        {/* Tool Buttons */}
        {tools.map((tool) => {
          const isActive = currentTool === tool.id;

          return (
            <div key={tool.id} className="relative shrink-0">
              <button
                type="button"
                onClick={() => {
                  onSelectTool(tool.id);
                  if (tool.id === 'shape') {
                    setShowShapeMenu(!showShapeMenu);
                  } else {
                    setShowShapeMenu(false);
                  }
                }}
                className={`min-h-[42px] min-w-[42px] px-2 py-1.5 rounded-lg flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 transition-all active:scale-95 ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-400 font-semibold border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 border border-transparent'
                }`}
                title={tool.label}
              >
                {tool.id === 'shape' ? (
                  currentShapeKind === 'circle' ? <Circle size={17} /> :
                  currentShapeKind === 'polygon' ? <Hexagon size={17} /> :
                  currentShapeKind === 'star' ? <Star size={17} /> :
                  currentShapeKind === 'line' ? <Minus size={17} /> :
                  <Square size={17} />
                ) : (
                  tool.icon
                )}
                <span className="text-[9px] md:hidden font-medium leading-none">
                  {tool.label}
                </span>
              </button>

              {/* Sub-menu for Shapes */}
              {showShapeMenu && tool.id === 'shape' && (
                <>
                  <div
                    className="fixed inset-0 z-40 bg-black/40 md:hidden"
                    onClick={() => setShowShapeMenu(false)}
                  />
                  <div className="fixed bottom-16 left-1/2 -translate-x-1/2 md:translate-x-0 md:absolute md:bottom-auto md:left-14 md:top-0 bg-[#0F172A] border border-slate-800 rounded-xl p-2 shadow-2xl flex flex-col gap-1 z-50 w-44 animate-in fade-in zoom-in-95 duration-100">
                    <span className="text-[10px] text-slate-400 font-semibold px-2 py-0.5 uppercase tracking-wider">
                      Vector Shape
                    </span>
                    {shapes.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => {
                          onSelectShapeKind(s.id);
                          setShowShapeMenu(false);
                        }}
                        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors text-left ${
                          currentShapeKind === s.id
                            ? 'bg-cyan-500/15 text-cyan-400 font-semibold border border-cyan-500/30'
                            : 'text-slate-300 hover:bg-slate-800 border border-transparent'
                        }`}
                      >
                        {s.icon}
                        <span>{s.label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}

        {/* Separator */}
        <div className="h-6 w-[1px] md:w-6 md:h-[1px] bg-slate-800 shrink-0" />

        {/* Direct Import Sketch Button */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="min-h-[42px] min-w-[42px] px-2 py-1.5 rounded-lg flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 text-cyan-400 hover:text-cyan-300 hover:bg-slate-800/60 transition-colors active:scale-95 shrink-0"
          title="Import Sketch or Picture to Draw Over"
        >
          <ImageIcon size={17} />
          <span className="text-[9px] md:hidden font-medium leading-none">Sketch</span>
        </button>

        {/* Fill & Stroke Quick Triggers */}
        <div className="flex md:flex-col items-center gap-1.5 shrink-0">
          {/* Fill Chip */}
          <button
            type="button"
            onClick={() => onOpenColorPicker('fill')}
            className="w-7 h-7 rounded-md border border-slate-700 shadow-inner flex items-center justify-center overflow-hidden active:scale-95"
            style={{
              backgroundColor: fillColor === 'none' ? 'transparent' : fillColor,
              backgroundImage:
                fillColor === 'none'
                  ? 'linear-gradient(45deg, #ef4444 2px, transparent 2px, transparent 50%, #ef4444 50%, #ef4444 52%, transparent 52%)'
                  : 'none',
            }}
            title="Fill Color"
          />

          {/* Stroke Chip */}
          <button
            type="button"
            onClick={() => onOpenColorPicker('stroke')}
            className="w-7 h-7 rounded-md border border-slate-700 flex items-center justify-center active:scale-95"
            title="Stroke Width & Color"
          >
            <div
              className="w-4 h-4 rounded-xs"
              style={{
                border: `${Math.min(3, Math.max(1.5, strokeWidth))}px solid ${
                  strokeColor === 'none' ? '#ef4444' : strokeColor
                }`,
              }}
            />
          </button>
        </div>

        {/* Layers Drawer Trigger */}
        <button
          type="button"
          onClick={onOpenLayers}
          className="min-h-[42px] min-w-[42px] px-2 py-1.5 rounded-lg flex flex-col md:flex-row items-center justify-center gap-0.5 md:gap-2 text-slate-300 hover:text-white hover:bg-slate-800 active:scale-95 relative shrink-0"
          title="Layer Management"
        >
          <Layers size={17} />
          <span className="text-[9px] md:hidden font-medium leading-none">Layers</span>
          <span className="hidden md:flex absolute -top-1 -right-1 w-4 h-4 bg-cyan-500 text-slate-950 rounded-full text-[9px] font-bold items-center justify-center">
            {layersCount}
          </span>
        </button>
      </nav>
    </>
  );
};
