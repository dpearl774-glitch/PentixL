import { RangeInput } from './ui/primitives';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Upload, Zap, Star, Crown, Check, ImagePlus } from 'lucide-react';
import { VectorPath } from '../types/vector';
import { traceImageToVectorPaths } from '../utils/contourTracer';
import { pathToSvgD } from '../utils/bezier';
import { Button, SectionLabel, Sheet } from './ui/primitives';

interface TraceSheetProps {
  open: boolean;
  onClose: () => void;
  onTrace: (paths: VectorPath[]) => void;
  onPlaceReference: (src: string) => void;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number;
  /** Image supplied from the reference list */
  initialSrc?: string | null;
}

const SAMPLES: { name: string; icon: React.ReactNode; svg: string }[] = [
  {
    name: 'Bolt',
    icon: <Zap size={13} />,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/><polygon points="112,14 44,106 96,106 86,186 158,92 106,92" fill="#000"/></svg>`,
  },
  {
    name: 'Star',
    icon: <Star size={13} />,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/><polygon points="100,12 124,74 192,76 138,118 158,184 100,146 42,184 62,118 8,76 76,74" fill="#000"/><circle cx="100" cy="106" r="22" fill="#fff"/></svg>`,
  },
  {
    name: 'Crest',
    icon: <Crown size={13} />,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#fff"/><path d="M100 18 L134 56 L176 50 L164 96 L192 128 L148 146 L154 190 L112 172 L100 196 L88 172 L46 190 L52 146 L8 128 L36 96 L24 50 L66 56 Z" fill="#000"/><circle cx="76" cy="88" r="10" fill="#fff"/><circle cx="124" cy="88" r="10" fill="#fff"/></svg>`,
  },
];

const MAX_SIDE = 320;

export const TraceSheet: React.FC<TraceSheetProps> = ({
  open,
  onClose,
  onTrace,
  onPlaceReference,
  fillColor,
  strokeColor,
  strokeWidth,
  initialSrc,
}) => {
  const [src, setSrc] = useState<string | null>(null);
  const [threshold, setThreshold] = useState(128);
  const [simplify, setSimplify] = useState(1.4);
  const [invert, setInvert] = useState(false);
  const [paths, setPaths] = useState<VectorPath[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const loadTokenRef = useRef(0);
  const [ready, setReady] = useState(false);

  /**
   * Replaces the image and clears the previous result atomically. Otherwise an
   * old trace stayed placeable after switching to a new image or reopening the
   * sheet, and a slow image load could publish results from the previous one.
   */
  const loadImage = useCallback((url: string | null) => {
    const token = ++loadTokenRef.current;
    setSrc(url);
    setReady(false);
    setPaths([]);
    setError(null);
    imageRef.current = null;
    const preview = previewRef.current;
    if (preview) {
      preview.width = 1;
      preview.height = 1;
    }
    if (!url) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (token !== loadTokenRef.current) return;
      imageRef.current = img;
      setReady(true);
    };
    img.onerror = () => {
      if (token !== loadTokenRef.current) return;
      setReady(false);
      setPaths([]);
      setError('That image could not be loaded.');
    };
    img.src = url;
  }, []);

  useEffect(() => {
    if (!open) return;
    loadImage(initialSrc ?? null);
  }, [open, initialSrc, loadImage]);

  const process = useCallback(() => {
    const img = imageRef.current;
    const preview = previewRef.current;
    if (!img || !preview) return;
    setBusy(true);
    setError(null);
    try {
      const ratio = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * ratio));
      const h = Math.max(1, Math.round(img.height * ratio));

      const work = document.createElement('canvas');
      work.width = w;
      work.height = h;
      const wctx = work.getContext('2d');
      if (!wctx) throw new Error('Canvas unavailable');

      // Flatten transparency onto white so the silhouette reads correctly
      wctx.fillStyle = '#FFFFFF';
      wctx.fillRect(0, 0, w, h);
      wctx.drawImage(img, 0, 0, w, h);

      const data = wctx.getImageData(0, 0, w, h);

      // Binarised preview
      preview.width = w;
      preview.height = h;
      const pctx = preview.getContext('2d');
      if (pctx) {
        const out = pctx.createImageData(w, h);
        for (let i = 0; i < data.data.length; i += 4) {
          const lum = 0.299 * data.data[i] + 0.587 * data.data[i + 1] + 0.114 * data.data[i + 2];
          const fg = invert ? lum >= threshold : lum < threshold;
          const v = fg ? 0 : 255;
          out.data[i] = v;
          out.data[i + 1] = v;
          out.data[i + 2] = v;
          out.data[i + 3] = 255;
        }
        pctx.putImageData(out, 0, 0);
      }

      const traced = traceImageToVectorPaths(data, {
        threshold,
        invert,
        simplification: simplify,
        minArea: 12,
        fillColor: fillColor === 'none' ? '#4c8dff' : fillColor,
        strokeColor,
        strokeWidth,
      });

      // Draw the fitted curves over the threshold mask. The old preview only
      // showed the bitmap, so moving Smoothing changed the node count while the
      // preview looked identical. This is the vector result the Place button
      // will actually add.
      if (pctx && traced.length > 0 && typeof Path2D !== 'undefined') {
        try {
          const overlay = new Path2D();
          for (const path of traced) {
            const d = pathToSvgD(path);
            if (d) overlay.addPath(new Path2D(d));
          }
          pctx.save();
          pctx.fillStyle = 'rgba(76, 141, 255, 0.2)';
          pctx.fill(overlay, 'evenodd');
          pctx.strokeStyle = '#4c8dff';
          pctx.lineWidth = Math.max(0.75, 1.25 / Math.max(1, Math.min(w, h) / 160));
          pctx.stroke(overlay);
          pctx.restore();
        } catch {
          // Keep the threshold preview if the browser rejects a path string.
        }
      }

      setPaths(traced);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trace failed');
      setPaths([]);
    } finally {
      setBusy(false);
    }
  }, [threshold, simplify, invert, fillColor, strokeColor, strokeWidth]);

  useEffect(() => {
    if (!open || !ready) return;
    // Coalesce slider movement into one trace after the thumb settles.
    setBusy(true);
    const id = window.setTimeout(() => process(), 90);
    return () => {
      window.clearTimeout(id);
      setBusy(false);
    };
  }, [open, ready, process]);

  const useSample = (svg: string) => {
    loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') loadImage(reader.result);
    };
    reader.onerror = () => setError('That image could not be read.');
    reader.readAsDataURL(file);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Trace an image"
      eyebrow="Convert"
      subtitle="Silhouette to editable paths."
    >
      <div className="flex flex-col gap-4">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            handleFile(e.target.files?.[0]);
            e.target.value = '';
          }}
        />

        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
            <Upload size={13} /> Upload
          </Button>
          <span className="mx-1 h-5 w-px bg-line" />
          {SAMPLES.map((s) => (
            <Button key={s.name} size="sm" variant="quiet" onClick={() => useSample(s.svg)}>
              {s.icon} {s.name}
            </Button>
          ))}
        </div>

        <div className="grid h-52 place-items-center overflow-hidden rounded-xl border border-line bg-ink-0 p-2">
          {src ? (
            <canvas ref={previewRef} className="max-h-full max-w-full rounded object-contain" />
          ) : (
            <div className="flex flex-col items-center gap-1.5 px-6 text-center">
              <ImagePlus size={20} className="text-mute" />
              <p className="text-[12px] text-mute">
                Choose an image to trace.
              </p>
            </div>
          )}
        </div>

        {src && (
          <div className="grid grid-cols-2 gap-3 rounded-xl border border-line bg-ink-0 p-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <SectionLabel>Threshold</SectionLabel>
                <span className="font-mono text-[10px] text-accent">{threshold}</span>
              </div>
              <RangeInput
                type="range"
                min={10}
                max={245}
                value={threshold}
                onChange={(e) => setThreshold(Number(e.target.value))}
                aria-label="Threshold"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <SectionLabel>Smoothing</SectionLabel>
                <span className="font-mono text-[10px] text-accent">{simplify.toFixed(1)}</span>
              </div>
              <RangeInput
                type="range"
                min={0.4}
                max={4}
                step={0.1}
                value={simplify}
                onChange={(e) => setSimplify(Number(e.target.value))}
                aria-label="Curve smoothing"
              />
            </div>
            <label className="col-span-2 flex items-center gap-2 text-[11.5px] text-dim">
              <input
                type="checkbox"
                checked={invert}
                onChange={(e) => setInvert(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#4c8dff]"
              />
              Invert silhouette
            </label>
          </div>
        )}

        {error && <p className="text-[11.5px] text-danger">{error}</p>}

        {src && (
          <div className="flex items-center justify-between">
            <span className="font-mono text-[11px] text-mute">
              {busy ? 'tracing…' : `${paths.length} contours · ${paths.reduce((n, p) => n + p.points.length, 0)} nodes`}
            </span>
            <Button
              size="sm"
              variant="quiet"
              onClick={() => {
                onPlaceReference(src);
                onClose();
              }}
            >
              <ImagePlus size={13} /> Use as reference
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            className="flex-1"
            disabled={busy || paths.length === 0}
            onClick={() => {
              onTrace(paths);
              onClose();
            }}
          >
            <Check size={14} /> Place {paths.length || ''} paths
          </Button>
        </div>
      </div>
    </Sheet>
  );
};
