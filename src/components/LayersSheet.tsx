import { RangeInput } from './ui/primitives';
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
  Pencil,
  Check,
  Type as TypeIcon,
  GripVertical,
  Layers as LayersIcon,
  Ungroup,
} from 'lucide-react';
import { Layer, VectorPath } from '../types/vector';
import { IconButton, Panel, SectionLabel } from './ui/primitives';
import { haptic } from '../theme';

interface LayersSheetProps {
  open: boolean;
  onClose: () => void;
  layers: Layer[];
  activeLayerId: string;
  selectedPathIds: string[];
  onSelectLayer: (id: string) => void;
  onRenameLayer: (id: string, name: string) => void;
  onToggleLayerVisible: (id: string) => void;
  onToggleLayerLock: (id: string) => void;
  onAddLayer: () => void;
  onDeleteLayer: (id: string) => void;
  onDuplicateLayer: (id: string) => void;
  onMoveLayer: (id: string, direction: 'up' | 'down') => void;
  /** Drag a layer header onto another to restack the document */
  onReorderLayer: (draggedId: string, targetId: string, place: 'above' | 'below') => void;
  onUpdateLayerOpacity: (id: string, opacity: number) => void;
  onSelectPath: (id: string) => void;
  onDeletePath: (id: string) => void;
  onTogglePathVisible: (id: string, visible: boolean) => void;
  onTogglePathLock: (id: string, locked: boolean) => void;
  onUpdatePathOpacity: (id: string, opacity: number) => void;
  /** Drops a dragged object above or below another object, in any layer */
  onReorderPath: (draggedId: string, targetId: string, place: 'above' | 'below') => void;
  /** Drops a dragged object onto another layer */
  onMovePathToLayer: (id: string, layerId: string) => void;
  onGroupSelected: () => void;
  /** Releases a group layer's objects into the layer beneath it */
  onUngroupLayer: (layerId: string) => void;
}

type Drop = { kind: 'path' | 'layer'; id: string; place: 'above' | 'below' };
type Drag = { kind: 'path' | 'layer'; id: string };

const easeLabel = (count: number) => `${count} object${count === 1 ? '' : 's'}`;

/** A thin line where the dragged row will land. */
const DropLine: React.FC<{ edge: 'above' | 'below' }> = ({ edge }) => (
  <span
    aria-hidden
    className={`pointer-events-none absolute inset-x-1 h-[2px] rounded-full bg-accent ${
      edge === 'above' ? '-top-[2px]' : '-bottom-[2px]'
    }`}
  />
);

const Chip: React.FC<{ path: VectorPath; small?: boolean }> = ({ path, small }) => (
  <span
    className={`grid shrink-0 place-items-center rounded-[5px] border border-line-strong ${
      small ? 'h-4 w-4' : 'h-5 w-5'
    } ${path.visible === false ? 'opacity-30' : ''}`}
    style={{
      backgroundColor: path.pattern
        ? path.pattern.paths[0]?.fill ?? path.fill
        : path.fill !== 'none'
          ? path.fill
          : 'transparent',
    }}
  >
    {path.text && <TypeIcon size={small ? 8 : 10} className="text-ink-0 mix-blend-difference" />}
    {path.pattern && !path.text && (
      <span className="h-1.5 w-1.5 rounded-[2px] bg-ink-0/80" />
    )}
  </span>
);

/**
 * Layers list. One top-to-bottom stack, front at the top: every layer shows its
 * own objects directly beneath it, so sorting is a single drag with a line
 * showing exactly where the row will land. Groups are layers flagged as such;
 * their members sit indented and can be released with Ungroup.
 */
export const LayersSheet: React.FC<LayersSheetProps> = ({
  open,
  onClose,
  layers,
  activeLayerId,
  selectedPathIds,
  onSelectLayer,
  onRenameLayer,
  onToggleLayerVisible,
  onToggleLayerLock,
  onAddLayer,
  onDeleteLayer,
  onDuplicateLayer,
  onMoveLayer,
  onReorderLayer,
  onUpdateLayerOpacity,
  onSelectPath,
  onDeletePath,
  onTogglePathVisible,
  onTogglePathLock,
  onUpdatePathOpacity,
  onReorderPath,
  onMovePathToLayer,
  onGroupSelected,
  onUngroupLayer,
}) => {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [drag, setDrag] = useState<Drag | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const dropRef = useRef<Drop | null>(null);

  const hitTest = (x: number, y: number, dragged: Drag): Drop | null => {
    const element = document.elementFromPoint(x, y) as HTMLElement | null;
    const pathRow = element?.closest('[data-path-id]') as HTMLElement | null;
    if (pathRow) {
      const id = pathRow.dataset.pathId ?? '';
      if (id && id !== dragged.id) {
        const rect = pathRow.getBoundingClientRect();
        return { kind: 'path', id, place: y < rect.top + rect.height / 2 ? 'above' : 'below' };
      }
    }
    const layerRow = element?.closest('[data-layer-id]') as HTMLElement | null;
    if (layerRow) {
      const id = layerRow.dataset.layerId ?? '';
      if (id && !(dragged.kind === 'layer' && id === dragged.id)) {
        const rect = layerRow.getBoundingClientRect();
        return { kind: 'layer', id, place: y < rect.top + rect.height / 2 ? 'above' : 'below' };
      }
    }
    return null;
  };

  const beginDrag = (next: Drag) => (e: React.PointerEvent) => {
    e.stopPropagation();
    setDrag(next);
    setDrop(null);
    dropRef.current = null;
    haptic(8);
    try {
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    } catch {
      /* ignore */
    }
  };

  const trackDrag = (e: React.PointerEvent) => {
    if (!drag) return;
    const next = hitTest(e.clientX, e.clientY, drag);
    const prev = dropRef.current;
    if (
      next?.id !== prev?.id ||
      next?.kind !== prev?.kind ||
      next?.place !== prev?.place
    ) {
      dropRef.current = next;
      setDrop(next);
    }
  };

  const endDrag = () => {
    const target = dropRef.current;
    if (drag && target) {
      if (drag.kind === 'path' && target.kind === 'path') {
        onReorderPath(drag.id, target.id, target.place);
      } else if (drag.kind === 'path' && target.kind === 'layer') {
        onMovePathToLayer(drag.id, target.id);
      } else if (drag.kind === 'layer' && target.kind === 'layer') {
        onReorderLayer(drag.id, target.id, target.place);
      }
    }
    setDrag(null);
    setDrop(null);
    dropRef.current = null;
  };

  const grip = (next: Drag, label: string, compact = false) => (
    <button
      type="button"
      aria-label={`Drag ${label} to reorder`}
      onPointerDown={beginDrag(next)}
      onPointerMove={trackDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      style={{ touchAction: 'none' }}
      className={`press grid shrink-0 cursor-grab place-items-center text-mute hover:text-accent active:cursor-grabbing ${
        compact ? 'h-8 w-6' : 'h-9 w-6'
      }`}
    >
      <GripVertical size={compact ? 12 : 14} />
    </button>
  );

  const activeLayer = layers.find((l) => l.id === activeLayerId) ?? layers[0];
  const selectedPath = activeLayer?.paths.find((p) => selectedPathIds.includes(p.id)) ?? null;
  // Front-to-back display: the last layer in the array paints on top.
  const ordered = [...layers].reverse();

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
      <div
        className="flex flex-col gap-3 pb-1"
        onPointerMove={trackDrag}
        onPointerUp={endDrag}
      >
        {activeLayer && (
          <div className="flex items-center gap-3 rounded-lg border border-line bg-ink-0 px-3 py-2.5">
            <Droplet size={14} className="shrink-0 text-dim" />
            <span className="min-w-0 shrink truncate text-[11px] font-semibold text-dim">
              {activeLayer.name}
            </span>
            <RangeInput
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

        <section className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <SectionLabel>Front · Layers · Back</SectionLabel>
            <span className="font-sans text-[9px] text-mute">drag to restack</span>
          </div>

          {ordered.map((layer) => {
            const isActive = layer.id === activeLayerId;
            const isRenaming = renaming === layer.id;
            const isGroup = layer.isGroup === true;
            const layerDrop = drop?.kind === 'layer' && drop.id === layer.id;
            return (
              <div
                key={layer.id}
                className={`relative overflow-hidden rounded-lg border ${
                  isActive ? 'border-accent/50 bg-ink-3' : 'border-line bg-ink-2'
                } ${drag?.kind === 'layer' && drag.id === layer.id ? 'opacity-60' : ''}`}
              >
                {layerDrop && <DropLine edge={drop.place} />}
                <div
                  data-layer-id={layer.id}
                  className={`flex items-center gap-0.5 pr-1 ${
                    layerDrop && drag?.kind === 'path' ? 'bg-accent/10' : ''
                  }`}
                >
                  {grip({ kind: 'layer', id: layer.id }, `${layer.name} layer`)}
                  <button
                    type="button"
                    onClick={() => onToggleLayerVisible(layer.id)}
                    aria-label={layer.visible ? 'Hide layer' : 'Show layer'}
                    className="press grid h-9 w-8 shrink-0 place-items-center text-dim"
                  >
                    {layer.visible ? <Eye size={15} /> : <EyeOff size={15} className="text-mute" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onToggleLayerLock(layer.id)}
                    aria-label={layer.locked ? 'Unlock layer' : 'Lock layer'}
                    className="press grid h-9 w-7 shrink-0 place-items-center"
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
                      <IconButton
                        label="Save name"
                        size="sm"
                        onClick={() => {
                          const next = draft.trim();
                          if (next) onRenameLayer(layer.id, next);
                          setRenaming(null);
                        }}
                      >
                        <Check size={13} />
                      </IconButton>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onSelectLayer(layer.id)}
                      className="flex min-w-0 flex-1 items-center gap-1.5 py-2 text-left"
                    >
                      {isGroup && <LayersIcon size={12} className="shrink-0 text-accent" />}
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
                  <div className="flex items-center gap-0.5 border-t border-line/70 px-1.5 py-1">
                    <IconButton
                      label="Bring layer forward"
                      size="sm"
                      onClick={() => onMoveLayer(layer.id, 'up')}
                    >
                      <ChevronUp size={13} />
                    </IconButton>
                    <IconButton
                      label="Send layer backward"
                      size="sm"
                      onClick={() => onMoveLayer(layer.id, 'down')}
                    >
                      <ChevronDown size={13} />
                    </IconButton>
                    <IconButton
                      label="Duplicate layer"
                      size="sm"
                      onClick={() => onDuplicateLayer(layer.id)}
                    >
                      <Copy size={13} />
                    </IconButton>
                    {isGroup && (
                      <button
                        type="button"
                        onClick={() => onUngroupLayer(layer.id)}
                        className="press ml-0.5 flex h-7 items-center gap-1 rounded-md bg-ink-2 px-2 text-[10px] font-semibold text-dim hover:text-accent"
                      >
                        <Ungroup size={11} /> Ungroup
                      </button>
                    )}
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

                {/* Objects, front first, indented under their layer */}
                {layer.paths.length > 0 && (
                  <div className="flex flex-col gap-px border-t border-line/60 bg-ink-0/40 py-1 pl-2 pr-1">
                    {[...layer.paths].reverse().map((path) => {
                      const selected = selectedPathIds.includes(path.id);
                      const hidden = path.visible === false;
                      const locked = path.locked === true;
                      const rowDrop = drop?.kind === 'path' && drop.id === path.id;
                      const isDragged = drag?.kind === 'path' && drag.id === path.id;
                      return (
                        <div
                          key={path.id}
                          data-path-id={path.id}
                          className={`relative flex items-center gap-0.5 rounded-md ${
                            selected ? 'bg-accent/10' : ''
                          } ${rowDrop ? 'bg-accent/10' : ''} ${isDragged ? 'opacity-50' : ''}`}
                        >
                          {rowDrop && <DropLine edge={drop.place} />}
                          {grip({ kind: 'path', id: path.id }, path.name, true)}
                          <button
                            type="button"
                            onClick={() => onSelectPath(path.id)}
                            className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
                          >
                            <Chip path={path} small />
                            <span
                              className={`truncate text-[11.5px] ${
                                selected
                                  ? 'text-accent'
                                  : hidden
                                    ? 'text-mute line-through'
                                    : 'text-dim'
                              }`}
                            >
                              {path.name}
                            </span>
                            {path.text && (
                              <span className="shrink-0 rounded bg-ink-3 px-1 py-0.5 font-sans text-[8px] uppercase text-mute">
                                text
                              </span>
                            )}
                            {path.isClippingMask && (
                              <span className="shrink-0 rounded bg-line-strong px-1 py-0.5 font-sans text-[8px] uppercase text-dim">
                                mask
                              </span>
                            )}
                            {path.pattern && (
                              <span className="shrink-0 rounded bg-ink-3 px-1 py-0.5 font-sans text-[8px] uppercase text-mute">
                                pattern
                              </span>
                            )}
                            {path.clipPathId && (
                              <span className="shrink-0 rounded bg-ink-3 px-1 py-0.5 font-sans text-[8px] uppercase text-mute">
                                clipped
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => onTogglePathVisible(path.id, hidden)}
                            aria-label={hidden ? 'Show object' : 'Hide object'}
                            className="press grid h-7 w-7 shrink-0 place-items-center rounded-lg text-dim"
                          >
                            {hidden ? <EyeOff size={12} className="text-mute" /> : <Eye size={12} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => onTogglePathLock(path.id, !locked)}
                            aria-label={locked ? 'Unlock object' : 'Lock object'}
                            className="press grid h-7 w-7 shrink-0 place-items-center"
                          >
                            {locked ? (
                              <Lock size={11} className="text-warn" />
                            ) : (
                              <Unlock size={11} className="text-mute" />
                            )}
                          </button>
                          <IconButton
                            label="Delete object"
                            size="sm"
                            tone="danger"
                            onClick={() => onDeletePath(path.id)}
                          >
                            <Trash2 size={12} />
                          </IconButton>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {selectedPath && (
          <div className="flex items-center gap-3 rounded-lg border border-line bg-ink-0 px-3 py-2.5">
            <Droplet size={14} className="shrink-0 text-dim" />
            <span className="min-w-0 shrink truncate text-[11px] font-semibold text-dim">
              Object
            </span>
            <RangeInput
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={selectedPath.opacity ?? 1}
              onChange={(e) => onUpdatePathOpacity(selectedPath.id, parseFloat(e.target.value))}
              className="min-w-0 flex-1"
              aria-label="Object opacity"
            />
            <span className="w-9 shrink-0 text-right font-mono text-[11px] font-bold text-accent">
              {Math.round((selectedPath.opacity ?? 1) * 100)}%
            </span>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <SectionLabel>{easeLabel(activeLayer?.paths.length ?? 0)} · {activeLayer?.name ?? 'No layer'}</SectionLabel>
            {selectedPathIds.length >= 2 && (
              <button
                type="button"
                onClick={onGroupSelected}
                className="press flex h-7 shrink-0 items-center gap-1 rounded-lg border border-line bg-ink-2 px-2 text-[10px] font-semibold text-dim hover:text-accent"
              >
                <LayersIcon size={11} /> Group {selectedPathIds.length}
              </button>
            )}
          </div>
          <p className="px-1 text-[9.5px] leading-snug text-mute">
            Drag a handle to restack. Drop an object on a layer name to move it into that layer.
          </p>
        </div>
      </div>
    </Panel>
  );
};
