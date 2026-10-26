import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  X,
  Upload,
  Sparkles,
  Sliders,
  Check,
  Eye,
  RefreshCw,
  Image as ImageIcon,
  Flame,
  Crown,
  Zap,
} from 'lucide-react';
import { ReferenceImage, VectorPath } from '../types/vector';
import { traceImageToVectorPaths } from '../utils/contourTracer';

interface ImageTracerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTraceComplete: (paths: VectorPath[]) => void;
  onAddReferenceImage?: (image: ReferenceImage) => void;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
}

// Built-in silhouette sample presets (generated via SVG data URLs for instant offline demo)
const SAMPLE_SILHOUETTES: { name: string; icon: React.ReactNode; svg: string }[] = [
  {
    name: 'Lion Emblem',
    icon: <Crown size={15} />,
    svg: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <path d="M100 20 L130 50 L170 50 L160 90 L190 120 L150 140 L160 180 L120 170 L100 195 L80 170 L40 180 L50 140 L10 120 L40 90 L30 50 L70 50 Z" fill="#000000"/>
      <circle cx="75" cy="85" r="10" fill="#ffffff"/>
      <circle cx="125" cy="85" r="10" fill="#ffffff"/>
      <path d="M100 105 L85 130 L115 130 Z" fill="#ffffff"/>
      <path d="M85 145 Q100 165 115 145" stroke="#ffffff" stroke-width="6" fill="none"/>
    </svg>`,
  },
  {
    name: 'Lightning Bolt',
    icon: <Zap size={15} />,
    svg: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <polygon points="110,15 45,105 95,105 85,185 155,95 105,95" fill="#000000"/>
    </svg>`,
  },
  {
    name: 'Geometric Star',
    icon: <Flame size={15} />,
    svg: `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
      <polygon points="100,10 125,75 195,75 138,118 160,185 100,145 40,185 62,118 5,75 75,75" fill="#000000"/>
      <circle cx="100" cy="105" r="25" fill="#ffffff"/>
    </svg>`,
  },
];

export const ImageTracerModal: React.FC<ImageTracerModalProps> = ({
  isOpen,
  onClose,
  onTraceComplete,
  onAddReferenceImage,
  fillColor,
  strokeColor,
  strokeWidth,
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [threshold, setThreshold] = useState<number>(128);
  const [simplification, setSimplification] = useState<number>(1.2);
  const [invert, setInvert] = useState<boolean>(false);
  const [detectedPaths, setDetectedPaths] = useState<VectorPath[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Load initial preset when opened
  useEffect(() => {
    if (isOpen && !imageSrc) {
      loadSvgPreset(SAMPLE_SILHOUETTES[0].svg);
    }
  }, [isOpen, imageSrc]);

  const loadSvgPreset = (svgString: string) => {
    const encoded = 'data:image/svg+xml;utf8,' + encodeURIComponent(svgString);
    setImageSrc(encoded);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setImageSrc(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Re-run tracing when parameters or image changes
  const runTracing = useCallback(() => {
    if (!imageSrc) return;
    setIsProcessing(true);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const maxDim = 400;
      let w = img.width;
      let h = img.height;
      if (w > maxDim || h > maxDim) {
        if (w > h) {
          h = Math.round((h * maxDim) / w);
          w = maxDim;
        } else {
          w = Math.round((w * maxDim) / h);
          h = maxDim;
        }
      }

      const canvas = previewCanvasRef.current;
      if (!canvas) {
        setIsProcessing(false);
        return;
      }

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setIsProcessing(false);
        return;
      }

      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      const imgData = ctx.getImageData(0, 0, w, h);

      // Perform tracing
      const paths = traceImageToVectorPaths(imgData, {
        threshold,
        invert,
        simplification,
        minArea: 12,
        fillColor,
        strokeColor,
        strokeWidth,
        namePrefix: 'Silhouette',
      });

      setDetectedPaths(paths);

      // Draw thresholded silhouette preview on the canvas
      const d = imgData.data;
      for (let i = 0; i < w * h; i++) {
        const lum = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2];
        const a = d[i * 4 + 3];
        let isFg = a > 50 && lum < threshold;
        if (invert) isFg = !isFg;

        if (isFg) {
          d[i * 4] = 0;
          d[i * 4 + 1] = 229;
          d[i * 4 + 2] = 255; // Cyan silhouette
          d[i * 4 + 3] = 255;
        } else {
          d[i * 4] = 15;
          d[i * 4 + 1] = 23;
          d[i * 4 + 2] = 42; // Dark slate background
          d[i * 4 + 3] = 255;
        }
      }
      ctx.putImageData(imgData, 0, 0);
      setIsProcessing(false);
    };
    img.src = imageSrc;
  }, [imageSrc, threshold, invert, simplification, fillColor, strokeColor, strokeWidth]);

  useEffect(() => {
    if (imageSrc) {
      runTracing();
    }
  }, [imageSrc, threshold, invert, simplification, runTracing]);

  if (!isOpen) return null;

  const handleApply = () => {
    if (detectedPaths.length === 0) return;
    onTraceComplete(detectedPaths);
    onClose();
  };

  const totalPoints = detectedPaths.reduce((acc, p) => acc + p.points.length, 0);

  const handlePlaceAsSketch = () => {
    if (!imageSrc || !onAddReferenceImage) return;
    const newRefImg: ReferenceImage = {
      id: 'ref-sketch-' + Date.now(),
      name: 'Reference Sketch',
      url: imageSrc,
      x: 100,
      y: 100,
      width: 600,
      height: 400,
      opacity: 0.5,
      locked: true,
      visible: true,
    };
    onAddReferenceImage(newRefImg);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#0B0F19] border border-slate-800 rounded-xl shadow-2xl w-full max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Sparkles size={16} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Image Trace & Reference Sketch</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Vectorize silhouettes or place images as reference layers to trace over with Pen
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">
          {/* Preset Buttons & Upload */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-400">Sample Silhouettes:</span>
              {SAMPLE_SILHOUETTES.map((s, idx) => (
                <button
                  key={idx}
                  onClick={() => loadSvgPreset(s.svg)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 border border-slate-700 hover:border-cyan-500/50 transition-colors"
                >
                  {s.icon}
                  <span>{s.name}</span>
                </button>
              ))}
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept="image/*"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1 bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 rounded-lg text-xs font-bold flex items-center gap-1.5 border border-cyan-500/40 transition-colors"
            >
              <Upload size={13} />
              <span>Upload Custom Image</span>
            </button>
          </div>

          {/* Interactive B&W Threshold Live Preview Canvas */}
          <div className="relative w-full h-56 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center overflow-hidden p-2">
            <canvas
              ref={previewCanvasRef}
              className="max-h-full max-w-full object-contain rounded-lg shadow-md"
            />
            {isProcessing && (
              <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center gap-2 text-cyan-300 text-xs font-bold">
                <RefreshCw size={14} className="animate-spin" />
                <span>Tracing contours...</span>
              </div>
            )}
          </div>

          {/* Controls Sliders */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-850/60 p-3 rounded-xl border border-slate-800">
            {/* Threshold Slider */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-300">Cutoff Threshold</span>
                <span className="font-mono text-cyan-400 font-bold">{threshold}</span>
              </div>
              <input
                type="range"
                min="10"
                max="245"
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500">
                Adjust sensitivity between dark foreground and light background
              </span>
            </div>

            {/* Simplification / Curve Smoothing Slider */}
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-300">Curve Smoothness</span>
                <span className="font-mono text-cyan-400 font-bold">{simplification.toFixed(1)}px</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="4.0"
                step="0.1"
                value={simplification}
                onChange={(e) => setSimplification(Number(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500">
                Lower = crisp pixel detail, Higher = ultra-smooth Bezier curves
              </span>
            </div>
          </div>

          {/* Invert Checkbox & Stats */}
          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-300 hover:text-white">
              <input
                type="checkbox"
                checked={invert}
                onChange={(e) => setInvert(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 accent-cyan-400 cursor-pointer"
              />
              <span>Invert Silhouette (Swap Black / White)</span>
            </label>

            <div className="text-right text-[11px] text-slate-400 font-mono">
              <span className="text-cyan-300 font-bold">{detectedPaths.length}</span> contours &bull;{' '}
              <span className="text-cyan-300 font-bold">{totalPoints}</span> Bezier nodes
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-slate-800 bg-[#0B0F19] flex items-center justify-between gap-2">
          {onAddReferenceImage && imageSrc ? (
            <button
              onClick={handlePlaceAsSketch}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold flex items-center gap-1.5 active:scale-95 transition-all"
              title="Place this image onto the canvas as a background reference layer so you can draw/trace over it with the Pen tool"
            >
              <ImageIcon size={14} className="text-cyan-400" />
              <span>Place as Reference Sketch</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApply}
              disabled={detectedPaths.length === 0}
              className={`px-4 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all active:scale-95 ${
                detectedPaths.length > 0
                  ? 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
              }`}
            >
              <Check size={14} className="font-extrabold" />
              <span>Auto-Vectorize ({detectedPaths.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
