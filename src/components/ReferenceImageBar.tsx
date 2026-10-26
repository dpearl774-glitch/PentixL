import React, { useRef } from 'react';
import {
  ImageIcon,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Trash2,
  PenTool,
  Sparkles,
  Upload,
  Layers,
  Plus,
} from 'lucide-react';
import { ReferenceImage, ToolType } from '../types/vector';

interface ReferenceImageBarProps {
  referenceImages: ReferenceImage[];
  onUpdateReferenceImage: (image: ReferenceImage) => void;
  onDeleteReferenceImage: (id: string) => void;
  onAddReferenceImage: (image: ReferenceImage) => void;
  onSelectTool: (tool: ToolType) => void;
  onOpenImageTracerWithSrc?: (src: string) => void;
}

export const ReferenceImageBar: React.FC<ReferenceImageBarProps> = ({
  referenceImages,
  onUpdateReferenceImage,
  onDeleteReferenceImage,
  onAddReferenceImage,
  onSelectTool,
  onOpenImageTracerWithSrc,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (referenceImages.length === 0) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (typeof event.target?.result === 'string') {
          const newRef: ReferenceImage = {
            id: 'ref-sketch-' + Date.now() + '-' + i,
            name: file.name.replace(/\.[^/.]+$/, ''),
            url: event.target.result,
            x: 50,
            y: 50,
            width: 500,
            height: 500,
            opacity: 0.5,
            locked: true,
            visible: true,
          };
          onAddReferenceImage(newRef);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <aside aria-label="Reference Sketch Controls" className="fixed bottom-[98px] left-3 z-30 max-w-[92vw] sm:max-w-md bg-[#0D1322]/95 backdrop-blur-md border border-slate-800 rounded-xl p-2 sm:p-2.5 shadow-2xl flex flex-col gap-2 text-slate-100 select-none animate-in slide-in-from-bottom-2 duration-150">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept="image/*"
        multiple
        className="hidden"
      />

      <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 px-0.5">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="text-xs font-bold text-slate-200">Reference Sketches ({referenceImages.length})</span>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded text-[10px] font-semibold flex items-center gap-1 active:scale-95 transition-all"
          title="Upload Another Reference Sketch / Picture"
        >
          <Plus size={12} />
          <span>Add Sketch</span>
        </button>
      </div>

      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto no-scrollbar">
        {referenceImages.map((img) => (
          <div
            key={img.id}
            className="flex flex-col gap-1.5 p-2 bg-slate-900/80 border border-slate-800 rounded-lg text-xs"
          >
            {/* Top row: thumbnail, title, eye, lock, trash */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 truncate">
                <img
                  src={img.url}
                  alt={img.name}
                  className="w-8 h-8 rounded border border-slate-700 object-cover bg-slate-950 shrink-0"
                />
                <span className="font-medium text-slate-200 truncate max-w-[110px] sm:max-w-[140px]">
                  {img.name || 'Sketch Image'}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {/* Visibility */}
                <button
                  type="button"
                  onClick={() => onUpdateReferenceImage({ ...img, visible: !img.visible })}
                  className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  title={img.visible ? 'Hide Sketch' : 'Show Sketch'}
                >
                  {img.visible ? <Eye size={13} /> : <EyeOff size={13} className="text-slate-600" />}
                </button>

                {/* Lock */}
                <button
                  type="button"
                  onClick={() => onUpdateReferenceImage({ ...img, locked: !img.locked })}
                  className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                  title={img.locked ? 'Locked (Click to Unlock & Move)' : 'Unlocked (Click to Lock)'}
                >
                  {img.locked ? <Lock size={13} className="text-amber-400" /> : <Unlock size={13} />}
                </button>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => onDeleteReferenceImage(img.id)}
                  className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 transition-colors"
                  title="Remove Sketch Image"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>

            {/* Middle row: Opacity Slider */}
            <div className="flex items-center gap-2 pt-0.5">
              <span className="text-[10px] text-slate-400 font-medium">Opacity:</span>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                value={img.opacity}
                onChange={(e) =>
                  onUpdateReferenceImage({ ...img, opacity: parseFloat(e.target.value) })
                }
                className="w-full accent-cyan-400 cursor-pointer h-1.5"
              />
              <span className="text-[10px] font-mono text-cyan-400 font-bold w-7 text-right">
                {Math.round(img.opacity * 100)}%
              </span>
            </div>

            {/* Bottom row: Draw Over (Pen Tool) & Auto-Trace actions */}
            <div className="flex items-center gap-1.5 pt-1 border-t border-slate-800/60">
              <button
                type="button"
                onClick={() => {
                  onUpdateReferenceImage({ ...img, locked: true });
                  onSelectTool('pen');
                }}
                className="flex-1 py-1 px-2 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition-all active:scale-95"
                title="Lock sketch in place & switch to Pen Tool to trace manually"
              >
                <PenTool size={12} />
                <span>Draw Over (Pen)</span>
              </button>

              {onOpenImageTracerWithSrc && (
                <button
                  type="button"
                  onClick={() => onOpenImageTracerWithSrc(img.url)}
                  className="py-1 px-2 bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-200 rounded text-[11px] font-semibold flex items-center justify-center gap-1 transition-all active:scale-95"
                  title="Auto-vectorize silhouette into paths"
                >
                  <Sparkles size={12} className="text-amber-400" />
                  <span>Auto-Trace</span>
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
};
