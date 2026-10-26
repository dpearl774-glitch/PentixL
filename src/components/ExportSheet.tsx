import React, { useMemo, useState } from 'react';
import { Copy, Download, Check, FileCode2, Image as ImageIcon } from 'lucide-react';
import { Layer, PressureConfig } from '../types/vector';
import { downloadSvg, exportToPng, generateSvgCode } from '../utils/svgExport';
import { Button, SectionLabel, Sheet } from './ui/primitives';

interface ExportSheetProps {
  open: boolean;
  onClose: () => void;
  layers: Layer[];
  canvasWidth: number;
  canvasHeight: number;
  pressureConfig: PressureConfig;
  projectName: string;
  /** Artboard colour used when the export keeps its background */
  backgroundColor: string;
}

export const ExportSheet: React.FC<ExportSheetProps> = ({
  open,
  onClose,
  layers,
  canvasWidth,
  canvasHeight,
  pressureConfig,
  projectName,
  backgroundColor,
}) => {
  const [tab, setTab] = useState<'svg' | 'png'>('svg');
  const [transparent, setTransparent] = useState(true);
  const [scale, setScale] = useState(2);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const svg = useMemo(
    () =>
      generateSvgCode(
        layers,
        {
          width: canvasWidth,
          height: canvasHeight,
          includeBackground: !transparent,
          backgroundColor,
        },
        pressureConfig
      ),
    [layers, canvasWidth, canvasHeight, transparent, pressureConfig, backgroundColor]
  );

  const previewSrc = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    [svg]
  );

  const slug =
    projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pentix';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(svg);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const savePng = async () => {
    setBusy(true);
    try {
      await exportToPng(svg, canvasWidth, canvasHeight, scale, `${slug}-${scale}x.png`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Export"
      eyebrow="Output"
      subtitle={`${canvasWidth} × ${canvasHeight} px artboard`}
      size="md"
    >
      <div className="flex flex-col gap-4">
        {/* Preview */}
        <div
          className="grid h-40 place-items-center overflow-hidden rounded-xl border border-line"
          style={{
            backgroundImage:
              'linear-gradient(45deg,#191d23 25%,transparent 25%,transparent 75%,#191d23 75%),linear-gradient(45deg,#191d23 25%,transparent 25%,transparent 75%,#191d23 75%)',
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0, 8px 8px',
            backgroundColor: '#0c0e11',
          }}
        >
          <img src={previewSrc} alt="Artwork preview" className="max-h-32 max-w-[80%] object-contain" />
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setTab('svg')}
            className={`press flex h-10 items-center justify-center gap-2 rounded-xl border text-[12.5px] font-semibold ${
              tab === 'svg' ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-ink-2 text-dim'
            }`}
          >
            <FileCode2 size={15} /> SVG
          </button>
          <button
            type="button"
            onClick={() => setTab('png')}
            className={`press flex h-10 items-center justify-center gap-2 rounded-xl border text-[12.5px] font-semibold ${
              tab === 'png' ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-ink-2 text-dim'
            }`}
          >
            <ImageIcon size={15} /> PNG
          </button>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-line bg-ink-0 px-3 py-2.5">
          <div className="min-w-0 pr-3">
            <div className="text-[12.5px] font-semibold text-text">Transparent background</div>
            <div className="text-[11px] text-mute">
              {transparent ? 'Alpha channel kept' : `Filled with ${backgroundColor.toUpperCase()}`}
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={transparent}
            onClick={() => setTransparent((v) => !v)}
            className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors ${
              transparent ? 'border-accent bg-accent/25' : 'border-line-strong bg-ink-2'
            }`}
          >
            <span
              className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full transition-all ${
                transparent ? 'left-[22px] bg-accent' : 'left-[3px] bg-line-strong'
              }`}
            />
          </button>
        </div>

        {tab === 'svg' ? (
          <div className="flex flex-col gap-2">
            <SectionLabel>Markup</SectionLabel>
            <pre className="no-scrollbar max-h-24 overflow-auto rounded-xl border border-line bg-ink-0 p-2.5 font-mono text-[10px] leading-relaxed text-mute">
              {svg.slice(0, 700)}
              {svg.length > 700 ? '\n…' : ''}
            </pre>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={copy}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy code'}
              </Button>
              <Button
                variant="primary"
                onClick={() => downloadSvg(svg, `${slug}.svg`)}
              >
                <Download size={14} /> Download
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <SectionLabel>Resolution</SectionLabel>
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 4].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScale(s)}
                  className={`press rounded-xl border px-2 py-2.5 text-left ${
                    scale === s ? 'border-accent bg-accent/10' : 'border-line bg-ink-2'
                  }`}
                >
                  <div className={`text-[12.5px] font-bold ${scale === s ? 'text-accent' : 'text-text'}`}>
                    {s}×
                  </div>
                  <div className="font-mono text-[10px] text-mute">
                    {canvasWidth * s} × {canvasHeight * s}
                  </div>
                </button>
              ))}
            </div>
            <Button variant="primary" block onClick={savePng} disabled={busy}>
              <Download size={15} /> {busy ? 'Rendering…' : `Download ${scale}× PNG`}
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  );
};
