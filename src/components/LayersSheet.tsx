import React, { useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Plus,
  ChevronUp,
  ChevronDown,
  Droplet,
  Image as ImageIcon,
  Sparkles,
  Pencil,
  Check,
  Type as TypeIcon,
} from 'lucide-react';
import { Layer, ReferenceImage, ToolType } from '../types/vector';
import { Button, IconButton, Panel, SectionLabel } from './ui/primitives';
import { referenceImageFromFile } from '../utils/referenceImages';

interface LayersSheetProps {
  open: boolean;
  onClose: () => void;
  layers: Layer[];
  activeLayerId: string;
  selectedPathIds: string[];
  referenceImages: ReferenceImage[];
  onSelectLayer: (id: string) => void;
  onRenameLayer: (id: string, name: string) => void;
  onToggleLayerVisible: (id: string) => void;
  onToggleLayerLock: (id: string) => void;
  onAddLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onDuplicateLayer: (id: string) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down') => void;
  onUpdateLayerOpacity: (id: string, opacity: number) => void;
  onSelectPath: (id: string) => void;
  onDeletePath: (id: string) => void;
  onUpdateReference: (image: ReferenceImage) => void;
  onDeleteReference: (id: string) => void;
  onAddReference: (image: ReferenceImage) => void;
  onTraceReference: (src: string) => void;
  onSelectTool: (tool: ToolType) => void;
}

export const LayersSheet: React.FC<LayersSheetProps> = ({
  open,
  onClose,
  layers,
  activeLayerId,
  selectedPathIds,
  referenceImages,
  onSelectLayer,
  onRenameLayer,
  onToggleLayerVisible,
  onToggleLayerLock,
  onAddLayer,
  onDeleteLayer,
  onDuplicateLayer,
  onMoveLayer,
  onUpdateLayerOpacity,
  onSelectPath,
  onDeletePath,
  onUpdateReference,
  onDeleteReference,
  onAddReference,
  onTraceReference,
  onSelectTool,
}) => {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const activeLayer = layers.find((l) => l.id === activeLayerId) ?? layers[0];
  // Front-to-back display: the last layer in the array paints on top.
  const ordered = [...layers].reverse();

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadError(null);
    for (const file of Array.from(files)) {
      try {
        onAddReference(await referenceImageFromFile(file));
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Could not add that image.');
      }
    }
  };

  return (
    <Panel
      open={open}
      onClose={onClose}
      interactive
      title="Layers & objects"
      eyebrow="Document"
      action={
        <IconButton label="Add layer" size="sm" onClick={onAddLayer}>
          <Plus size={15} />
        </IconButton>
      }
    >
      <div className="flex flex-col gap-4 pb-1">
        {/* Active layer opacity */}
        {activeLayer && (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-ink-0 px-3 py-2.5">
            <Droplet size={14} className="shrink-0 text-dim" />
            <span className="shrink-0 text-[11px] font-semibold text-dim">Opacity</span>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={activeLayer.opacity}
              onChange={(e) => onUpdateLayerOpacity(activeLayer.id, parseFloat(e.target.value))}
              className="min-w-0 flex-1"
              aria-label="Active layer opacity"
            />
            <span className="w-9 shrink-0 text-right font-mono text-[11px] font-bold text-accent">
              {Math.round(activeLayer.opacity * 100)}%
            </span>
          </div>
        )}

        {/* Layers */}
        <section className="flex flex-col gap-1.5">
          <SectionLabel>Layers · {layers.length}</SectionLabel>
          {ordered.map((layer) => {
            const isActive = layer.id === activeLayerId;
            const isRenaming = renaming === layer.id;
            return (
              <div
                key={layer.id}
                className={`overflow-hidden rounded-xl border ${
                  isActive ? 'border-accent/50 bg-ink-3' : 'border-line bg-ink-2'
                }`}
              >
                <div className="flex items-center gap-1 pr-1">
                  <button
                    type="button"
                    onClick={() => onToggleLayerVisible(layer.id)}
                    aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
                    className="press grid h-10 w-9 shrink-0 place-items-center text-dim"
                  >
                    {layer.visible ? <Eye size={15} /> : <EyeOff size={15} className="text-mute" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleLayerLock(layer.id)}
                    aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
                    className="press grid h-10 w-8 shrink-0 place-items-center"
                  >
                    {layer.locked ? (
                      <Lock size={13} className="text-warn" />
                    ) : (
                      <Unlock size={13} className="text-mute" />
                    )}
                  </button>

                  {isRenaming ? (
                    <form
                      className="flex min-w-0 flex-1 items-center gap-1"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const next = draft.trim();
                        if (next) onRenameLayer(layer.id, next);
                        setRenaming(null);
                      }}
                    >
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => setRenaming(null)}
                        className="h-8 min-w-0 flex-1 rounded-lg border border-accent/60 bg-ink-0 px-2 text-[12px] font-semibold text-text outline-none"
                      />
                      <IconButton label="Save name" size="sm" onClick={() => {
                        const next = draft.trim();
                        if (next) onRenameLayer(layer.id, next);
                        setRenaming(null);
                      }}>
                        <Check size={13} />
                      </IconButton>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectLayer(layer.id)}
                      className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left"
                    >
                      <span className="truncate text-[13px] font-semibold text-text">
                        {layer.name}
                      </span>
                      <span className="shrink-0 font-mono text-[10px] text-mute">
                        {layer.paths.length}
                      </span>
                    </button>
                  )}

                  {!isRenaming && (
                    <IconButton
                      label="Rename layer"
                      size="sm"
                      onClick={() => {
                        setDraft(layer.name);
                        setRenaming(layer.id);
                      }}
                    >
                      <Pencil size={12} />
                    </IconButton>
                  )}
                </div>

                {isActive && (
                  <div className="flex items-center gap-1 border-t border-line/70 px-1.5 py-1">
                    <IconButton label="Bring forward" size="sm" onClick={() => onMoveLayer(layer.id, 'up')}>
                      <ChevronUp size={13} />
                    </IconButton>
                    <IconButton label="Send backward" size="sm" onClick={() => onMoveLayer(layer.id, 'down')}>
                      <ChevronDown size={13} />
                    </IconButton>
                    <IconButton label="Duplicate layer" size="sm" onClick={() => onDuplicateLayer(layer.id)}>
                      <Copy size={13} />
                    </IconButton>
                    <span className="flex-1" />
                    {layers.length > 1 && (
                      <IconButton
                        label="Delete layer"
                        size="sm"
                        tone="danger"
                        onClick={() => onDeleteLayer(layer.id)}
                      >
                        <Trash2 size={13} />
                      </IconButton>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* Objects in the active layer */}
        {activeLayer && activeLayer.paths.length > 0 && (
          <section className="flex flex-col gap-1">
            <SectionLabel>Objects · {activeLayer.name}</SectionLabel>
            {activeLayer.paths.map((path) => {
              const selected = selectedPathIds.includes(path.id);
              return (
                <div
                  key={path.id}
                  className={`flex items-center gap-2 rounded-lg px-1.5 py-1 ${
                    selected ? 'bg-accent/10' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectPath(path.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
                  >
                    <span
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border border-line-strong"
                      style={{
                        backgroundColor: path.fill !== 'none' ? path.fill : 'transparent',
                      }}
                    >
                      {path.text && <TypeIcon size={10} className="text-ink-0 mix-blend-difference" />}
                    </span>
                    <span
                      className={`truncate text-[12px] ${selected ? 'text-accent' : 'text-dim'}`}
                    >
                      {path.name}
                    </span>
                    {path.text && (
                      <span className="shrink-0 rounded bg-ink-3 px-1 py-0.5 font-mono text-[8px] uppercase text-mute">
                        text
                      </span>
                    )}
                  </button>
                  <IconButton label="Delete object" size="sm" tone="danger" onClick={() => onDeletePath(path.id)}>
                    <Trash2 size={12} />
                  </IconButton>
                </div>
              );
            })}
          </section>
        )}

        {/* Reference images */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <SectionLabel>References · {referenceImages.length}</SectionLabel>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="press flex h-7 items-center gap-1 rounded-lg border border-line bg-ink-2 px-2 text-[11px] font-semibold text-dim"
            >
              <Plus size={12} /> Add image
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              void handleFiles(e.target.files);
              e.target.value = '';
            }}
          />
          {uploadError && <p className="text-[11px] text-danger">{uploadError}</p>}

          {referenceImages.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line px-3 py-4 text-[11.5px] leading-relaxed text-mute">
              Drop in a sketch or photo to trace over. It stays locked behind your artwork until you
              unlock it.
            </div>
          ) : (
            referenceImages.map((img) => (
              <div key={img.id} className="rounded-xl border border-line bg-ink-2/80 p-2">
                <div className="flex items-center gap-2">
                  <img
                    src={img.url}
                    alt={img.name}
                    className="h-9 w-9 shrink-0 rounded-md border border-line object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-text">
                    {img.name}
                  </span>
                  <IconButton
                    label={img.visible ? 'Hide reference' : 'Show reference'}
                    size="sm"
                    onClick={() => onUpdateReference({ ...img, visible: !img.visible })}
                  >
                    {img.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                  </IconButton>
                  <IconButton
                    label={img.locked ? 'Unlock reference' : 'Lock reference'}
                    size="sm"
                    onClick={() => onUpdateReference({ ...img, locked: !img.locked })}
                  >
                    {img.locked ? <Lock size={13} className="text-warn" /> : <Unlock size={13} />}
                  </IconButton>
                  <IconButton
                    label="Remove reference"
                    size="sm"
                    tone="danger"
                    onClick={() => onDeleteReference(img.id)}
                  >
                    <Trash2 size={13} />
                  </IconButton>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="range"
                    min={0.05}
                    max={1}
                    step={0.05}
                    value={img.opacity}
                    onChange={(e) => onUpdateReference({ ...img, opacity: parseFloat(e.target.value) })}
                    className="min-w-0 flex-1"
                    aria-label="Reference opacity"
                  />
                  <span className="w-8 shrink-0 text-right font-mono text-[10px] text-dim">
                    {Math.round(img.opacity * 100)}%
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      onUpdateReference({ ...img, locked: true });
                      onSelectTool('pen');
                      onClose();
                    }}
                  >
                    <Pencil size={12} /> Trace with pen
                  </Button>
                  <Button size="sm" variant="quiet" onClick={() => onTraceReference(img.url)}>
                    <Sparkles size={12} /> Auto-vectorise
                  </Button>
                </div>
              </div>
            ))
          )}
        </section>

        <p className="flex items-center gap-1.5 px-1 text-[10.5px] text-mute">
          <ImageIcon size={11} /> References are saved with the document.
        </p>
      </div>
    </Panel>
  );
};
