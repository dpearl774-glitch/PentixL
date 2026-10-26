import React from 'react';
import { X, Sparkles, ArrowRight, LayoutTemplate } from 'lucide-react';
import { LOGO_TEMPLATES, LogoTemplate } from '../data/templates';
import { Layer } from '../types/vector';

interface TemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectTemplate: (layers: Layer[]) => void;
}

export const TemplatesModal: React.FC<TemplatesModalProps> = ({
  isOpen,
  onClose,
  onSelectTemplate,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md select-none animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-slate-100 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <LayoutTemplate size={18} className="text-cyan-400" />
            <div>
              <h2 className="text-sm font-bold tracking-tight">Logo Design Blueprints</h2>
              <p className="text-[11px] text-slate-400">Jumpstart your logo mark with curated geometric setups</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Templates Grid */}
        <div className="overflow-y-auto flex flex-col gap-3">
          {LOGO_TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              className="p-4 rounded-2xl border border-slate-700/80 bg-slate-800/40 hover:bg-slate-800/70 hover:border-cyan-500/50 transition-all flex items-center justify-between gap-4 group"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white group-hover:text-cyan-300">
                    {tmpl.name}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono px-2 py-0.5 rounded bg-slate-800 border border-slate-700">
                    {tmpl.category}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  {tmpl.description}
                </p>
              </div>

              <button
                onClick={() => {
                  onSelectTemplate(tmpl.layers);
                  onClose();
                }}
                className="px-4 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-400/10 active:scale-95 shrink-0"
              >
                <span>Load Blueprint</span>
                <ArrowRight size={13} />
              </button>
            </div>
          ))}

          {/* Blank Canvas Option */}
          <div className="p-4 rounded-2xl border border-dashed border-slate-700 bg-slate-900/40 hover:bg-slate-800/50 transition-all flex items-center justify-between gap-4">
            <div>
              <span className="text-xs font-bold text-slate-200">Blank Artboard</span>
              <p className="text-xs text-slate-400 mt-0.5">Start with a pristine empty vector canvas.</p>
            </div>
            <button
              onClick={() => {
                onSelectTemplate([
                  {
                    id: 'layer-1',
                    name: 'Layer 1',
                    visible: true,
                    locked: false,
                    opacity: 1,
                    paths: [],
                  },
                ]);
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs transition-colors shrink-0"
            >
              Start Blank
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
