import React, { useState, useRef } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Copy,
  Plus,
  X,
  Layers as LayersIcon,
  Droplet,
  Edit3,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { Layer } from '../types/vector';

interface LayerPanelProps {
  isOpen: boolean;
  onClose: () => void;
  layers: Layer[];
  activeLayerId: string;
  onSelectLayer: (layerId: string) => void;
  onRenameLayer: (layerId: string, newName: string) => void;
  onToggleLayerVisible: (layerId: string) => void;
  onToggleLayerLock: (layerId: string) => void;
  onAddLayer: () => void;
  onDeleteLayer: (layerId: string) => void;
  onDuplicateLayer: (layerId: string) => void;
  onMoveLayer: (layerId: string, direction: 'up' | 'down') => void;
  onUpdateLayerOpacity: (layerId: string, opacity: number) => void;
  selectedPathIds: string[];
  onSelectPath: (pathId: string) => void;
  onDeletePath: (pathId: string) => void;
}

export const LayerPanel: React.FC<LayerPanelProps> = ({
  isOpen,
  onClose,
  layers,
  activeLayerId,
  onSelectLayer,
  onRenameLayer,
  onToggleLayerVisible,
  onToggleLayerLock,
  onAddLayer,
  onDeleteLayer,
  onDuplicateLayer,
  onMoveLayer,
  onUpdateLayerOpacity,
  selectedPathIds,
  onSelectPath,
  onDeletePath,
}) => {
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>('');
  const lastTapRef = useRef<{ [layerId: string]: number }>({});

  if (!isOpen) return null;

  const activeLayer = layers.find((l) => l.id === activeLayerId) || layers[0];

  const handleStartRename = (layerId: string, currentName: string) => {
    setEditingLayerId(layerId);
    setEditingName(currentName);
  };

  const handleFinishRename = (layerId: string) => {
    const trimmed = editingName.trim();
    if (trimmed) {
      onRenameLayer(layerId, trimmed);
    }
    setEditingLayerId(null);
  };

  const handleLayerNameTap = (layerId: string, currentName: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    const now = Date.now();
    const lastTap = lastTapRef.current[layerId] || 0;
    if (now - lastTap < 350) {
      // Double tap triggered!
      handleStartRename(layerId, currentName);
      lastTapRef.current[layerId] = 0;
    } else {
      lastTapRef.current[layerId] = now;
    }
  };

  return (
    <aside
      aria-label="Layer Management Panel"
      className="fixed top-14 right-2 sm:right-4 z-45 w-[280px] sm:w-[320px] max-h-[65vh] bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col text-slate-100 select-none animate-in fade-in duration-150"
    >
      {/* Panel Header */}
      <div className="p-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayersIcon size={16} className="text-cyan-400" />
          <h2 className="text-xs font-bold tracking-tight">Layers ({layers.length})</h2>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onAddLayer}
            className="p-1 rounded-md bg-cyan-500/20 text-cyan-300 hover:bg-cyan-500/30 transition-colors"
            title="Add New Layer"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close Panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Active Layer Opacity & Transparency Toggle */}
      {activeLayer && (
        <div className="px-3 py-2 bg-slate-800/40 border-b border-slate-800 flex items-center justify-between gap-2 text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <Droplet size={13} className={activeLayer.opacity < 1 ? 'text-cyan-400' : 'text-slate-400'} />
            <button
              type="button"
              onClick={() => {
                const newOpacity = activeLayer.opacity < 1 ? 1 : 0.5;
                onUpdateLayerOpacity(activeLayer.id, newOpacity);
              }}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all active:scale-95 ${
                activeLayer.opacity < 1
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-sm'
                  : 'bg-slate-800 border-slate-700 text-slate-200 hover:border-slate-600'
              }`}
              title={
                activeLayer.opacity < 1
                  ? 'Layer is Transparent (Click to make 100% Opaque)'
                  : 'Layer is Opaque (Click to toggle Transparency)'
              }
            >
              {activeLayer.opacity < 1 ? 'Transparent' : 'Opaque'}
            </button>
          </div>
          <div className="flex items-center gap-1.5">
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={activeLayer.opacity}
              onChange={(e) => onUpdateLayerOpacity(activeLayer.id, parseFloat(e.target.value))}
              className="w-22 sm:w-26 accent-cyan-400 cursor-pointer"
            />
            <span className="font-mono text-cyan-400 text-[10px] w-9 text-right font-bold">
              {Math.round(activeLayer.opacity * 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Layers List */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
        {layers.map((layer, layerIndex) => {
          const isActive = layer.id === activeLayerId;
          const isEditing = editingLayerId === layer.id;

          return (
            <div
              key={layer.id}
              onClick={() => onSelectLayer(layer.id)}
              className={`rounded-xl border p-2 transition-all cursor-pointer ${
                isActive
                  ? 'bg-slate-800/95 border-cyan-500/60 shadow-md'
                  : 'bg-slate-850/40 border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-1.5">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />

                  {/* Inline Renaming or Layer Name Display */}
                  {isEditing ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleFinishRename(layer.id);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="flex-1 min-w-0 mr-1"
                    >
                      <input
                        type="text"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingLayerId(null);
                        }}
                        onBlur={() => handleFinishRename(layer.id)}
                        autoFocus
                        className="bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-[11px] font-semibold text-white w-full focus:outline-none"
                      />
                    </form>
                  ) : (
                    <div
                      className="flex items-center gap-1 min-w-0 group/name cursor-text"
                      onClick={(e) => handleLayerNameTap(layer.id, layer.name, e)}
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        handleStartRename(layer.id, layer.name);
                      }}
                      title="Double tap or click to rename layer"
                    >
                      <span className="text-[11px] font-semibold truncate hover:text-cyan-300 transition-colors">
                        {layer.name}
                      </span>
                      <button
                        type="button"
                        className="text-slate-500 opacity-0 group-hover/name:opacity-100 hover:text-cyan-400 cursor-pointer shrink-0 transition-opacity p-0.5"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartRename(layer.id, layer.name);
                        }}
                        title="Rename Layer"
                      >
                        <Edit3 size={10} />
                      </button>
                      <span className="text-[9px] text-slate-500 font-mono">
                        ({layer.paths.length})
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-0.5 shrink-0">
                  {/* Layer Transparency Quick Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const newOpacity = layer.opacity < 1 ? 1 : 0.5;
                      onUpdateLayerOpacity(layer.id, newOpacity);
                    }}
                    className={`p-1 rounded transition-colors ${
                      layer.opacity < 1
                        ? 'text-cyan-300 bg-cyan-500/20 hover:bg-cyan-500/30'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}
                    title={
                      layer.opacity < 1
                        ? `Transparent (${Math.round(layer.opacity * 100)}%) - Tap for 100% Opaque`
                        : 'Opaque (100%) - Tap to toggle transparency (50%)'
                    }
                  >
                    <Droplet size={12} className={layer.opacity < 1 ? 'fill-cyan-400/40 text-cyan-400' : ''} />
                  </button>

                  {/* Visibility Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLayerVisible(layer.id);
                    }}
                    className="p-1 text-slate-400 hover:text-white"
                    title={layer.visible ? 'Hide' : 'Show'}
                  >
                    {layer.visible ? <Eye size={12} /> : <EyeOff size={12} className="text-rose-400" />}
                  </button>

                  {/* Move Layer Up */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveLayer(layer.id, 'up');
                    }}
                    disabled={layerIndex === 0}
                    className="p-1 text-slate-400 hover:text-cyan-300 disabled:opacity-30 disabled:hover:text-slate-400"
                    title="Move Layer Up"
                  >
                    <ChevronUp size={12} />
                  </button>

                  {/* Move Layer Down */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onMoveLayer(layer.id, 'down');
                    }}
                    disabled={layerIndex === layers.length - 1}
                    className="p-1 text-slate-400 hover:text-cyan-300 disabled:opacity-30 disabled:hover:text-slate-400"
                    title="Move Layer Down"
                  >
                    <ChevronDown size={12} />
                  </button>

                  {/* Lock Toggle */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleLayerLock(layer.id);
                    }}
                    className="p-1 text-slate-400 hover:text-white"
                    title={layer.locked ? 'Unlock' : 'Lock'}
                  >
                    {layer.locked ? <Lock size={12} className="text-amber-400" /> : <Unlock size={12} />}
                  </button>

                  {/* Duplicate Layer */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDuplicateLayer(layer.id);
                    }}
                    className="p-1 text-slate-400 hover:text-cyan-300"
                    title="Duplicate"
                  >
                    <Copy size={11} />
                  </button>

                  {/* Delete Layer */}
                  {layers.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteLayer(layer.id);
                      }}
                      className="p-1 text-slate-400 hover:text-rose-400"
                      title="Delete"
                    >
                      <Trash2 size={11} />
                    </button>
                  )}
                </div>
              </div>

              {/* Sub-paths belonging to this layer */}
              {isActive && layer.paths.length > 0 && (
                <div className="mt-1.5 pt-1.5 border-t border-slate-750 flex flex-col gap-1 pl-2 max-h-32 overflow-y-auto">
                  {layer.paths.map((p) => {
                    const isPathSelected = selectedPathIds.includes(p.id);

                    return (
                      <div
                        key={p.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectPath(p.id);
                        }}
                        className={`flex items-center justify-between p-1 rounded-lg text-[10px] transition-colors ${
                          isPathSelected
                            ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-500/40 font-medium'
                            : 'hover:bg-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <div
                            className="w-2.5 h-2.5 rounded-xs border border-slate-600 shrink-0"
                            style={{
                              backgroundColor: p.fill !== 'none' ? p.fill : 'transparent',
                              borderColor: p.stroke !== 'none' ? p.stroke : '#475569',
                            }}
                          />
                          <span className="truncate">{p.name}</span>
                        </div>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeletePath(p.id);
                          }}
                          className="p-0.5 text-slate-500 hover:text-rose-400"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
};
