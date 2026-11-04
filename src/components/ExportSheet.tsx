import React, { useMemo, useState } from 'react';
import { Copy, Download, Check, FileCode2, Image as ImageIcon, Share2 } from 'lucide-react';
import { Layer, PressureConfig, VectorPath } from '../types/vector';
import { downloadSvg, exportToPng, generateSvgCode, renderPngBlob } from '../utils/svgExport';
import { computeVisiblePathsBoundingBox } from '../utils/shapeBuilder';
import { withClipSourcesForExport } from '../utils/clipping';
import { includeExtrusionInBounds } from '../utils/extrusion';
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
  /** Currently selected objects, offered as a crop-to-selection export */
  selectedPaths: VectorPath[];
}

type Scope = 'artboard' | 'selection';
type Mono = 'off' | 'black' | 'white';

const MONO_COLOR: Record<Mono, string | undefined> = {
  off: undefined,
  black: '#000000',
  white: '#FFFFFF',
};

export const ExportSheet: React.FC<ExportSheetProps> = ({
  open,
  onClose,
  layers,
  canvasWidth,
  canvasHeight,
  pressureConfig,
  projectName,
  backgroundColor,
  selectedPaths,
}) => {
  const [tab, setTab] = useState<'svg' | 'png'>('svg');
  const [transparent, setTransparent] = useState(true);
  const [scale, setScale] = useState(2);
  const [mono, setMono] = useState<Mono>('off');
  const [scope, setScope] = useState<Scope>('artboard');
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hidden layers and hidden objects do not export. Derive the selection from
  // what is actually visible, so a stale selection cannot crop the artwork to
  // an invisible object or leave an empty selection scope active.
  const exportableSelectedPaths = useMemo(() => {
    const visibleIds = new Set(
      layers
        .filter((layer) => layer.visible !== false)
        .flatMap((layer) =>
          layer.paths.filter((path) => path.visible !== false).map((path) => path.id)
        )
    );
    return selectedPaths.filter((path) => visibleIds.has(path.id));
  }, [layers, selectedPaths]);

  const hasSelection = exportableSelectedPaths.length > 0;
  const activeScope: Scope = hasSelection ? scope : 'artboard';

  // Selection export crops to the selected artwork plus a small breathing gap,
  // which is what a logo mark handed to someone else actually needs.
  const selectedIds = useMemo(
    () => new Set(exportableSelectedPaths.map((p) => p.id)),
    [exportableSelectedPaths]
  );

  const crop = useMemo(() => {
    if (activeScope !== 'selection' || !hasSelection) return null;
    const flatBox = computeVisiblePathsBoundingBox(
      exportableSelectedPaths,
      layers.flatMap((layer) => layer.paths)
    );
    if (!flatBox) return null;
    const box = includeExtrusionInBounds(exportableSelectedPaths, flatBox);
    const pad = Math.max(2, Math.round(Math.max(box.width, box.height) * 0.04));
    return {
      x: box.minX - pad,
      y: box.minY - pad,
      width: box.width + pad * 2,
      height: box.height + pad * 2,
    };
  }, [activeScope, hasSelection, exportableSelectedPaths, layers]);

  const exportLayers = useMemo(
    () =>
      activeScope === 'selection' && hasSelection
        ? withClipSourcesForExport(layers, selectedIds)
        : layers,
    [activeScope, hasSelection, layers, selectedIds]
  );

  const outWidth = crop ? Math.round(crop.width) : canvasWidth;
  const outHeight = crop ? Math.round(crop.height) : canvasHeight;
  const monoColor = MONO_COLOR[mono];

  const svg = useMemo(
    () =>
      generateSvgCode(
        exportLayers,
        {
          width: outWidth,
          height: outHeight,
          includeBackground: !transparent,
          backgroundColor,
          monoColor,
          crop: crop ?? undefined,
        },
        pressureConfig
      ),
    [
      exportLayers,
      outWidth,
      outHeight,
      transparent,
      backgroundColor,
      monoColor,
      crop,
      pressureConfig,
    ]
  );

  const previewSrc = useMemo(
    () => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,
    [svg]
  );

  /** Exports are self-contained: live text becomes outlines, not a font lookup. */
  const outputSvg = () =>
    generateSvgCode(
      exportLayers,
      {
        width: outWidth,
        height: outHeight,
        includeBackground: !transparent,
        backgroundColor,
        monoColor,
        crop: crop ?? undefined,
        outlineText: true,
      },
      pressureConfig
    );

  const slug =
    projectName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pentix';
  const suffix = `${activeScope === 'selection' ? '-mark' : ''}${mono !== 'off' ? '-mono' : ''}`;

  const copy = async () => {
    setError(null);
    const svgOutput = outputSvg();
    try {
      await navigator.clipboard.writeText(svgOutput);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Older iOS and non-secure local previews have no clipboard API. A
      // temporary textarea still gives them a way to copy the markup.
      const area = document.createElement('textarea');
      area.value = svgOutput;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      setCopied(ok);
      if (!ok) setError('Could not copy automatically. Select the markup above.');
    }
  };

  const savePng = async () => {
    setBusy(true);
    setError(null);
    try {
      await exportToPng(outputSvg(), outWidth, outHeight, scale, `${slug}${suffix}-${scale}x.png`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PNG export failed on this device.');
    } finally {
      setBusy(false);
    }
  };

  const share = async () => {
    setError(null);
    const svgOutput = outputSvg();
    let file: File;
    if (tab === 'png') {
      try {
        const blob = await renderPngBlob(svgOutput, outWidth, outHeight, scale);
        file = new File([blob], `${slug}${suffix}-${scale}x.png`, { type: 'image/png' });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'PNG sharing failed on this device.');
        return;
      }
    } else {
      file = new File([svgOutput], `${slug}${suffix}.svg`, { type: 'image/svg+xml' });
    }
    const nav = navigator as Navigator & {
      canShare?: (data: { files: File[] }) => boolean;
      share?: (data: { files: File[]; title: string }) => Promise<void>;
    };
    if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
      try {
        await nav.share({ files: [file], title: projectName });
        return;
      } catch (err) {
        if ((err as DOMException)?.name === 'AbortError') return;
      }
    }
    if (tab === 'png') {
      await exportToPng(svgOutput, outWidth, outHeight, scale, file.name);
    } else {
      downloadSvg(svgOutput, file.name);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Export"
      eyebrow="Output"
      subtitle={`${outWidth} × ${outHeight} px${crop ? ' · cropped to selection' : ' artboard'}`}
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

        {/* Scope — only offered when something is selected */}
        {hasSelection && (
          <div className="flex flex-col gap-1.5">
            <SectionLabel>Include</SectionLabel>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ['artboard', 'Whole artboard'],
                  ['selection', `Selection · ${exportableSelectedPaths.length}`],
                ] as [Scope, string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setScope(value)}
                  className={`press h-9 truncate rounded-xl border px-2 text-[12px] font-semibold ${
                    activeScope === value
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-line bg-ink-2 text-dim'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* One colour */}
        <div className="flex flex-col gap-1.5">
          <SectionLabel>Colour</SectionLabel>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                ['off', 'Full colour'],
                ['black', 'Black'],
                ['white', 'White'],
              ] as [Mono, string][]
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMono(value)}
                className={`press flex h-9 items-center justify-center gap-1.5 truncate rounded-xl border px-2 text-[12px] font-semibold ${
                  mono === value
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-line bg-ink-2 text-dim'
                }`}
              >
                {value !== 'off' && (
                  <span
                    className="h-3 w-3 shrink-0 rounded-full border border-line-strong"
                    style={{ backgroundColor: value === 'black' ? '#000' : '#fff' }}
                  />
                )}
                {label}
              </button>
            ))}
          </div>
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
                onClick={() => downloadSvg(outputSvg(), `${slug}${suffix}.svg`)}
              >
                <Download size={14} /> Download
              </Button>
            </div>
            <Button variant="secondary" block onClick={share}>
              <Share2 size={14} /> Share or save
            </Button>
            <p className="text-[10.5px] leading-snug text-mute">
              Text is converted to outlines on export, so it stays identical without the font.
            </p>
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
                    {outWidth * s} × {outHeight * s}
                  </div>
                </button>
              ))}
            </div>
            <Button variant="primary" block onClick={savePng} disabled={busy}>
              <Download size={15} /> {busy ? 'Rendering…' : `Download ${scale}× PNG`}
            </Button>
            {error && <p className="text-[11.5px] leading-snug text-danger">{error}</p>}
          </div>
        )}
      </div>
    </Sheet>
  );
};
