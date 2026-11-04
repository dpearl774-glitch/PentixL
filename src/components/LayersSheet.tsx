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
} from 'lucide-react';
import { Layer } from '../types/vector';
import { IconButton, Panel, SectionLabel } from './ui/primitives';
import { haptic } from '../theme';

type MoveDirection = 'up' | 'down' | 'front' | 'back';

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
  /** One tap steps one place; holding jumps to the very front or back */
  onMovePath: (id: string, direction: MoveDirection) => void;
  onUpdateLayerOpacity: (id: string, opacity: number) => void;
  onSelectPath: (id: string) => void;
  onDeletePath: (id: string) => void;
  onTogglePathVisible: (id: string, visible: boolean) => void;
  onTogglePathLock: (id: string, locked: boolean) => void;
  onUpdatePathOpacity: (id: string, opacity: number) => void;
}

/**
 * Reorder control: a tap nudges one position, a hold sends the object all the
 * way to the front or back. Both live on the same button, so nothing extra
 * competes for room in the row.
 */
const ReorderButton: React.FC<{
  label: string;
  jumpLabel: string;
  onStep: () => void;
  onJump: () => void;
  children: React.ReactNode;
}> = ({ label, jumpLabel, onStep, onJump, children }) => {
  const timer = useRef<number | null>(null);
  const firedRef = useRef(false);

  const clear = () => {
    if (timer.current) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  return (
    <button
      type="button"
      aria-label={label}
      title={`${label} · hold to ${jumpLabel}`}
      onPointerDown={() => {
        firedRef.current = false;
        clear();
        timer.current = window.setTimeout(() => {
          firedRef.current = true;
          haptic(14);
          onJump();
        }, 450);
      }}
      onPointerUp={clear}
      onPointerLeave={clear}
      onPointerCancel={clear}
      onContextMenu={(e) => e.preventDefault()}
      onClick={() => {
        if (firedRef.current) {
          firedRef.current = false;
          return;
        }
        haptic(6);
        onStep();
      }}
      className="press grid h-7 w-7 shrink-0 place-items-center rounded-lg text-dim hover:bg-ink-3 hover:text-text"
    >
      {children}
    </button>
  );
};

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
  onMovePath,
  onUpdateLayerOpacity,
  onSelectPath,
  onDeletePath,
  onTogglePathVisible,
  onTogglePathLock,
  onUpdatePathOpacity,
}) => {
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const activeLayer = layers.find((l) => l.id === activeLayerId) ?? layers[0];
  // Front-to-back display: the last layer in the array paints on top.
  const ordered = [...layers].reverse();
  const selectedPath =
    activeLayer?.paths.find((p) => selectedPathIds.includes(p.id)) ?? null;

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
            <span className="shrink-0 text-[11px] font-semibold text-dim">Layer</span>
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
                    <IconButton label="Bring layer forward" size="sm" onClick={() => onMoveLayer(layer.id, 'up')}>
                      <ChevronUp size={13} />
                    </IconButton>
                    <IconButton label="Send layer backward" size="sm" onClick={() => onMoveLayer(layer.id, 'down')}>
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

        {/* Selected object opacity */}
        {selectedPath && (
          <div className="flex items-center gap-3 rounded-xl border border-line bg-ink-0 px-3 py-2.5">
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

        {/* Objects in the active layer */}
        {activeLayer && activeLayer.paths.length > 0 && (
          <section className="flex flex-col gap-1">
            <SectionLabel>Objects · {activeLayer.name}</SectionLabel>
            {[...activeLayer.paths].reverse().map((path) => {
              const selected = selectedPathIds.includes(path.id);
              const hidden = path.visible === false;
              const locked = path.locked === true;
              return (
                <div
                  key={path.id}
                  className={`flex items-center gap-0.5 rounded-lg pl-1.5 pr-0.5 py-1 ${
                    selected ? 'bg-accent/10' : ''
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectPath(path.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
                  >
                    <span
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border border-line-strong ${
                        hidden ? 'opacity-30' : ''
                      }`}
                      style={{
                        backgroundColor: path.fill !== 'none' ? path.fill : 'transparent',
                      }}
                    >
                      {path.text && <TypeIcon size={10} className="text-ink-0 mix-blend-difference" />}
                    </span>
                    <span
                      className={`truncate text-[12px] ${
                        selected ? 'text-accent' : hidden ? 'text-mute line-through' : 'text-dim'
                      }`}
                    >
                      {path.name}
                    </span>
                    {path.text && (
                      <span className="shrink-0 rounded bg-ink-3 px-1 py-0.5 font-mono text-[8px] uppercase text-mute">
                        text
                      </span>
                    )}
                    {path.isClippingMask && (
                      <span className="shrink-0 rounded bg-accent/15 px-1 py-0.5 font-mono text-[8px] uppercase text-accent">
                        mask
                      </span>
                    )}
                    {path.clipPathId && (
                      <span className="shrink-0 rounded bg-ink-3 px-1 py-0.5 font-mono text-[8px] uppercase text-mute">
                        clipped
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => onTogglePathVisible(path.id, hidden)}
                    aria-label={hidden ? 'Show object' : 'Hide object'}
                    className="press grid h-7 w-7 shrink-0 place-items-center rounded-lg text-dim hover:bg-ink-3"
                  >
                    {hidden ? <EyeOff size={13} className="text-mute" /> : <Eye size={13} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onTogglePathLock(path.id, !locked)}
                    aria-label={locked ? 'Unlock object' : 'Lock object'}
                    className="press grid h-7 w-7 shrink-0 place-items-center rounded-lg hover:bg-ink-3"
                  >
                    {locked ? <Lock size={12} className="text-warn" /> : <Unlock size={12} className="text-mute" />}
                  </button>

                  <ReorderButton
                    label="Bring object forward"
                    jumpLabel="bring to front"
                    onStep={() => onMovePath(path.id, 'up')}
                    onJump={() => onMovePath(path.id, 'front')}
                  >
                    <ChevronUp size={12} />
                  </ReorderButton>
                  <ReorderButton
                    label="Send object backward"
                    jumpLabel="send to back"
                    onStep={() => onMovePath(path.id, 'down')}
                    onJump={() => onMovePath(path.id, 'back')}
                  >
                    <ChevronDown size={12} />
                  </ReorderButton>
                  <IconButton label="Delete object" size="sm" tone="danger" onClick={() => onDeletePath(path.id)}>
                    <Trash2 size={12} />
                  </IconButton>
                </div>
              );
            })}
          </section>
        )}

        {/* Objects on the other layers stay reachable without switching the
            active layer first. The full management row remains on the active
            layer, where it is not buried. */}
        {ordered.some((layer) => layer.id !== activeLayer?.id && layer.paths.length > 0) && (
          <section className="flex flex-col gap-1">
            <SectionLabel>Other layers</SectionLabel>
            {ordered.map(
              (layer) =>
                layer.id !== activeLayer?.id &&
                layer.paths.length > 0 && (
                  <div key={layer.id} className="rounded-lg border border-line bg-ink-0 p-1">
                    <div className="px-1.5 py-1 font-mono text-[9px] uppercase tracking-wider text-mute">
                      {layer.name}
                    </div>
                    {[...layer.paths].reverse().map((path) => {
                      const hidden = path.visible === false;
                      const locked = path.locked === true;
                      const selected = selectedPathIds.includes(path.id);
                      return (
                        <div
                          key={path.id}
                          className={`flex items-center gap-0.5 rounded-md pr-0.5 ${
                            selected ? 'bg-accent/10' : ''
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => onSelectPath(path.id)}
                            className="flex min-w-0 flex-1 items-center gap-2 px-1.5 py-1.5 text-left"
                          >
                            <span
                              className={`grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border border-line-strong ${
                                hidden ? 'opacity-30' : ''
                              }`}
                              style={{
                                backgroundColor: path.fill !== 'none' ? path.fill : 'transparent',
                              }}
                            />
                            <span
                              className={`truncate text-[11.5px] ${
                                selected ? 'text-accent' : hidden ? 'text-mute line-through' : 'text-dim'
                              }`}
                            >
                              {path.name}
                            </span>
                            {path.isClippingMask && (
                              <span className="shrink-0 rounded bg-accent/15 px-1 py-0.5 font-mono text-[8px] uppercase text-accent">
                                mask
                              </span>
                            )}
                            {path.clipPathId && (
                              <span className="shrink-0 rounded bg-ink-3 px-1 py-0.5 font-mono text-[8px] uppercase text-mute">
                                clipped
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => onTogglePathVisible(path.id, hidden)}
                            aria-label={hidden ? 'Show object' : 'Hide object'}
                            className="press grid h-8 w-8 shrink-0 place-items-center text-dim"
                          >
                            {hidden ? <EyeOff size={12} /> : <Eye size={12} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => onTogglePathLock(path.id, !locked)}
                            aria-label={locked ? 'Unlock object' : 'Lock object'}
                            className="press grid h-8 w-8 shrink-0 place-items-center"
                          >
                            {locked ? (
                              <Lock size={11} className="text-warn" />
                            ) : (
                              <Unlock size={11} className="text-mute" />
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )
            )}
          </section>
        )}
      </div>
    </Panel>
  );
};
