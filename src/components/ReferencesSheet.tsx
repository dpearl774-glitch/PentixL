import { RangeInput } from './ui/primitives';
import React, { useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  Plus,
  Pencil,
  Sparkles,
  Image as ImageIcon,
} from 'lucide-react';
import { ReferenceImage } from '../types/vector';
import { Button, IconButton, SectionLabel, Sheet } from './ui/primitives';
import { referenceImageFromFile } from '../utils/referenceImages';

interface ReferencesSheetProps {
  open: boolean;
  onClose: () => void;
  references: ReferenceImage[];
  onUpdate: (image: ReferenceImage) => void;
  onDelete: (id: string) => void;
  onAdd: (image: ReferenceImage) => void;
  onTrace: (src: string) => void;
  onTraceWithPen: () => void;
}

/**
 * Tracing aids live here, not in the layer tree: the layer panel stays a
 * description of the artwork instead of a mixed bag of document and drawings.
 */
export const ReferencesSheet: React.FC<ReferencesSheetProps> = ({
  open,
  onClose,
  references,
  onUpdate,
  onDelete,
  onAdd,
  onTrace,
  onTraceWithPen,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploadError(null);
    for (const file of Array.from(files)) {
      try {
        onAdd(await referenceImageFromFile(file));
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : 'Could not add that image.');
      }
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="References"
      eyebrow="Studio"
      subtitle="Sketches and photos you trace over. Saved with the document."
      size="md"
    >
      <div className="flex flex-col gap-2.5 pb-1">
        <div className="flex items-center justify-between">
          <SectionLabel>Images · {references.length}</SectionLabel>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="press flex h-8 items-center gap-1 rounded-lg border border-line bg-ink-2 px-2.5 text-[11px] font-semibold text-dim"
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

        {references.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-3 py-8 text-center">
            <ImageIcon size={18} className="text-mute" />
            <p className="text-[12px] text-mute">Drop a sketch or photo to trace over.</p>
          </div>
        ) : (
          references.map((img) => (
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
                  onClick={() => onUpdate({ ...img, visible: !img.visible })}
                >
                  {img.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                </IconButton>
                <IconButton
                  label={img.locked ? 'Unlock reference' : 'Lock reference'}
                  size="sm"
                  onClick={() => onUpdate({ ...img, locked: !img.locked })}
                >
                  {img.locked ? <Lock size={13} className="text-warn" /> : <Unlock size={13} />}
                </IconButton>
                <IconButton
                  label="Remove reference"
                  size="sm"
                  tone="danger"
                  onClick={() => onDelete(img.id)}
                >
                  <Trash2 size={13} />
                </IconButton>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <RangeInput
                  type="range"
                  min={0.05}
                  max={1}
                  step={0.05}
                  value={img.opacity}
                  onChange={(e) => onUpdate({ ...img, opacity: parseFloat(e.target.value) })}
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
                    onUpdate({ ...img, locked: true });
                    onTraceWithPen();
                    onClose();
                  }}
                >
                  <Pencil size={12} /> Trace with pen
                </Button>
                <Button size="sm" variant="quiet" onClick={() => onTrace(img.url)}>
                  <Sparkles size={12} /> Auto-vectorise
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </Sheet>
  );
};
