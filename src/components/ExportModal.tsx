import React, { useState } from 'react';
import { X, Copy, Download, Check, FileCode, Image as ImageIcon } from 'lucide-react';
import { Layer, PressureConfig } from '../types/vector';
import { generateSvgCode, downloadSvg, exportToPng } from '../utils/svgExport';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  layers: Layer[];
  canvasWidth: number;
  canvasHeight: number;
  pressureConfig: PressureConfig;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  layers,
  canvasWidth,
  canvasHeight,
  pressureConfig,
}) => {
  const [activeTab, setActiveTab] = useState<'svg' | 'png'>('svg');
  const [includeBackground, setIncludeBackground] = useState<boolean>(false);
  const [backgroundColor, setBackgroundColor] = useState<string>('#0d1322');
  const [pngScale, setPngScale] = useState<number>(2);
  const [copied, setCopied] = useState<boolean>(false);
  const [isExportingPng, setIsExportingPng] = useState<boolean>(false);

  if (!isOpen) return null;

  const svgCode = generateSvgCode(
    layers,
    {
      width: canvasWidth,
      height: canvasHeight,
      includeBackground,
      backgroundColor,
    },
    pressureConfig
  );

  const handleCopySvg = async () => {
    try {
      await navigator.clipboard.writeText(svgCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy SVG:', err);
    }
  };

  const handleDownloadSvg = () => {
    downloadSvg(svgCode, `pentix-logo-${Date.now()}.svg`);
  };

  const handleDownloadPng = async () => {
    setIsExportingPng(true);
    try {
      await exportToPng(
        svgCode,
        canvasWidth,
        canvasHeight,
        pngScale,
        `pentix-logo-${pngScale}x-${Date.now()}.png`
      );
    } catch (err) {
      console.error('PNG export failed:', err);
    } finally {
      setIsExportingPng(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md select-none animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl flex flex-col gap-4 text-slate-100 max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
              <Download size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight">Export Logo Studio</h2>
              <p className="text-[11px] text-slate-400">Desktop vector workflow & high-res PNG</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Format Selector Tabs */}
        <div className="flex items-center p-1 bg-slate-800/80 rounded-xl border border-slate-700/60">
          <button
            onClick={() => setActiveTab('svg')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'svg'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <FileCode size={15} />
            <span>Vector SVG (Illustrator / Figma)</span>
          </button>
          <button
            onClick={() => setActiveTab('png')}
            className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'png'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            <ImageIcon size={15} />
            <span>High-Res PNG</span>
          </button>
        </div>

        {/* Background Option */}
        <div className="flex items-center justify-between p-3 bg-slate-800/40 rounded-xl border border-slate-800 text-xs">
          <div>
            <span className="font-medium text-slate-200">Include Background Artboard</span>
            <p className="text-[10px] text-slate-400">
              {includeBackground ? 'Renders dark artboard background' : 'Export with 100% transparent background'}
            </p>
          </div>
          <button
            onClick={() => setIncludeBackground(!includeBackground)}
            className={`px-3 py-1 rounded-lg text-[11px] font-semibold transition-colors ${
              includeBackground
                ? 'bg-cyan-500 text-slate-950 font-bold'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {includeBackground ? 'Solid Background' : 'Transparent (Alpha)'}
          </button>
        </div>

        {/* Tab 1: SVG Code Preview */}
        {activeTab === 'svg' && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Clean SVG Vector Markup:</span>
              <span className="font-mono text-[10px] text-cyan-400">{canvasWidth}x{canvasHeight} ViewBox</span>
            </div>
            <div className="relative">
              <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-[10px] text-slate-300 overflow-x-auto max-h-48 leading-relaxed">
                {svgCode}
              </pre>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={handleCopySvg}
                className="py-2.5 px-3 rounded-xl border border-slate-700 hover:border-cyan-500/60 bg-slate-800 text-slate-100 hover:text-cyan-300 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors active:scale-98"
              >
                {copied ? <Check size={15} className="text-cyan-400" /> : <Copy size={15} />}
                <span>{copied ? 'Copied to Clipboard!' : 'Copy SVG Code'}</span>
              </button>

              <button
                onClick={handleDownloadSvg}
                className="py-2.5 px-3 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-cyan-400/20 transition-all active:scale-98"
              >
                <Download size={15} />
                <span>Download .SVG</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 2: High-Res PNG */}
        {activeTab === 'png' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-slate-400">Resolution Multiplier:</span>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { scale: 1, label: '1x Standard', desc: `${canvasWidth} x ${canvasHeight}` },
                  { scale: 2, label: '2x High-DPI', desc: `${canvasWidth * 2} x ${canvasHeight * 2}` },
                  { scale: 4, label: '4x Ultra-Retina', desc: `${canvasWidth * 4} x ${canvasHeight * 4}` },
                ].map((item) => (
                  <button
                    key={item.scale}
                    onClick={() => setPngScale(item.scale)}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      pngScale === item.scale
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 shadow-md shadow-cyan-500/10'
                        : 'bg-slate-800/60 border-slate-700 hover:border-slate-600 text-slate-300'
                    }`}
                  >
                    <div className="text-xs font-bold">{item.label}</div>
                    <div className="text-[10px] font-mono text-slate-400">{item.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={handleDownloadPng}
              disabled={isExportingPng}
              className="mt-2 py-3 px-4 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:bg-slate-700 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-400/20 transition-all active:scale-98"
            >
              <Download size={16} />
              <span>{isExportingPng ? 'Rendering PNG...' : `Download ${pngScale}x PNG`}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
