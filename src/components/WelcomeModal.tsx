import React, { useState } from 'react';
import {
  X,
  Sparkles,
  PenTool,
  Move,
  Layers,
  Brush,
  ArrowRight,
  Check,
  Zap,
  FolderOpen,
} from 'lucide-react';
import { LOGO_TEMPLATES } from '../data/templates';
import { Layer } from '../types/vector';

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadTemplate: (templateLayers: Layer[]) => void;
  onOpenProjects?: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onClose,
  onLoadTemplate,
  onOpenProjects,
}) => {
  const [activeStep, setActiveStep] = useState<number>(0);

  if (!isOpen) return null;

  const features = [
    {
      title: 'Ergonomic Mobile Thumb Zone',
      subtitle: 'Desktop modifier keys under your thumb',
      description:
        'Large tactile Shift and Ctrl modifier buttons let you snap angles to 45°, constrain 1:1 ratios, and switch to Direct Selection without breaking your flow. Use the micro-precision D-Pad to nudge anchor points by 0.5px so your fingers never obscure your vector nodes.',
      image: '/src/assets/images/pentix_thumb_ergonomics_1792793965215.jpg',
      badge: 'Game Changer',
    },
    {
      title: 'Full Bezier & Pen Tool Architecture',
      subtitle: 'Exact Illustrator curve math on a smartphone',
      description:
        'Place corner nodes or drag symmetric Bezier curve handles in real time. Break handles with the Alt modifier into sharp cusps, adjust tethers, and close paths seamlessly for production-ready logo marks.',
      image: '/src/assets/images/pentix_hero_workspace_1792793965830.jpg',
      badge: 'Vector Engine',
    },
    {
      title: 'Shape Builder & Boolean Geometry',
      subtitle: 'Craft iconic logos from overlapping shapes',
      description:
        'Select intersecting circles, polygons, or custom paths. Merge them into a single silhouette, minus front to carve negative space, or divide geometry into golden ratio jigsaw pieces with one touch.',
      image: '/src/assets/images/pentix_logo_gallery_1792793965899.jpg',
      badge: 'Brand Identity',
    },
    {
      title: 'Universal Pressure for Stylus & Touch',
      subtitle: 'Pro calligraphic strokes without an expensive tablet',
      description:
        'Pentix supports hardware stylus pressure AND an intelligent Touch-Velocity engine. Fast swiping creates elegant tapered ends while slower gestures create rich bold weights—giving every smartphone user professional vector line craft.',
      image: '/src/assets/images/pentix_thumb_ergonomics_1792793965215.jpg',
      badge: 'Inclusive Tech',
    },
    {
      title: 'Smart Guides & Magnetic Snapping',
      subtitle: 'Pro vector alignment lines like Illustrator & Figma',
      description:
        'When moving or resizing shapes, dynamic glowing cyan Smart Guides pop up instantly to align centers and edges against other elements and the canvas artboard. Fast, non-destructive, and magnetic.',
      image: '/src/assets/images/pentix_hero_workspace_1792793965830.jpg',
      badge: 'Precision',
    },
  ];

  const currentFeature = features[activeStep];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md select-none animate-in fade-in duration-150">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[95vh] text-slate-100">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center font-mono font-black text-slate-950 text-sm">
              P
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
                <span>Welcome to Pentix</span>
                <span className="text-[10px] bg-cyan-500/20 text-cyan-300 font-mono px-2 py-0.5 rounded-full border border-cyan-500/30">
                  Mobile Vector Studio
                </span>
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Feature Visual & Explanation */}
        <div className="p-6 overflow-y-auto flex flex-col gap-5">
          {/* Main Visual Image Banner */}
          <div className="relative rounded-2xl overflow-hidden border border-slate-700/80 aspect-[16/9] bg-slate-950 flex items-center justify-center">
            <img
              src={currentFeature.image}
              alt={currentFeature.title}
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
              onError={(e) => {
                // Fallback container if image fails
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            {/* Scrim Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent flex flex-col justify-end p-4 sm:p-6">
              <span className="text-[11px] font-mono text-cyan-400 font-semibold tracking-wider uppercase mb-1">
                {currentFeature.badge}
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                {currentFeature.title}
              </h3>
              <p className="text-xs text-slate-300 mt-1 max-w-lg">
                {currentFeature.subtitle}
              </p>
            </div>
          </div>

          {/* Description text */}
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            {currentFeature.description}
          </p>

          {/* Step Indicators */}
          <div className="flex items-center justify-center gap-2 pt-1">
            {features.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setActiveStep(idx)}
                className={`h-2 rounded-full transition-all ${
                  activeStep === idx
                    ? 'w-8 bg-cyan-400'
                    : 'w-2 bg-slate-700 hover:bg-slate-500'
                }`}
                title={`Feature ${idx + 1}`}
              />
            ))}
          </div>

          {/* Quick Start Templates */}
          <div className="pt-2 border-t border-slate-800 flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-400">
              Or Jump In With A Logo Blueprint:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {LOGO_TEMPLATES.map((tmpl) => (
                <button
                  key={tmpl.id}
                  onClick={() => {
                    onLoadTemplate(tmpl.layers);
                    onClose();
                  }}
                  className="p-3 rounded-xl border border-slate-700/80 bg-slate-800/60 hover:bg-slate-800 hover:border-cyan-500/50 text-left transition-all group"
                >
                  <div className="text-xs font-bold text-white group-hover:text-cyan-300 flex items-center justify-between">
                    <span>{tmpl.name}</span>
                    <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 transition-opacity text-cyan-400" />
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">
                    {tmpl.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-6 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (activeStep > 0) {
                  setActiveStep(activeStep - 1);
                } else {
                  onClose();
                }
              }}
              className="px-3 sm:px-4 py-2 text-xs font-medium text-slate-300 hover:text-white rounded-xl transition-colors"
            >
              {activeStep > 0 ? 'Previous' : 'Skip Intro'}
            </button>

            {onOpenProjects && (
              <button
                onClick={() => {
                  onClose();
                  onOpenProjects();
                }}
                className="px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-800 hover:border-cyan-500/50 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors hidden sm:flex"
              >
                <FolderOpen size={13} className="text-cyan-400" />
                <span>Projects</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {activeStep < features.length - 1 ? (
              <button
                onClick={() => setActiveStep(activeStep + 1)}
                className="px-5 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-400/20 transition-all active:scale-98"
              >
                <span>Next Feature</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-cyan-400/20 transition-all active:scale-98"
              >
                <Zap size={14} />
                <span>Start Designing Now</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
