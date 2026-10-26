import React, { useRef, useState } from 'react';
import { Trash2, Upload, Check } from 'lucide-react';
import { Button, IconButton, SectionLabel, Sheet } from './ui/primitives';

interface FontsSheetProps {
  open: boolean;
  onClose: () => void;
  customFonts: string[];
  onAddFont: (family: string, file: File) => Promise<void>;
  onRemoveFont: (family: string) => void;
}

export const FontsSheet: React.FC<FontsSheetProps> = ({
  open,
  onClose,
  customFonts,
  onAddFont,
  onRemoveFont,
}) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [added, setAdded] = useState<string | null>(null);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    setBusy(true);
    for (const file of Array.from(files)) {
      const family = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim();
      try {
        await onAddFont(family, file);
        setAdded(family);
        window.setTimeout(() => setAdded(null), 1600);
      } catch {
        setError(`Could not load ${file.name}. Use a TTF, OTF or WOFF file.`);
      }
    }
    setBusy(false);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Fonts"
      eyebrow="Typography"
      subtitle="Import a typeface and it becomes available in the text tool."
    >
      <div className="flex flex-col gap-5">
        <input
          ref={fileRef}
          type="file"
          accept=".ttf,.otf,.woff,.woff2,font/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void handleFiles(e.target.files);
            e.target.value = '';
          }}
        />

        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="press flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-line-strong px-4 py-6 text-center hover:border-accent/50"
        >
          <Upload size={18} className="text-accent" />
          <span className="text-[12.5px] font-semibold text-text">
            {busy ? 'Loading typeface…' : 'Import a font file'}
          </span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-mute">
            ttf · otf · woff · woff2
          </span>
        </button>

        {error && <p className="text-[11.5px] text-danger">{error}</p>}
        {added && (
          <p className="flex items-center gap-1.5 text-[11.5px] text-accent">
            <Check size={12} /> {added} is ready in the text tool
          </p>
        )}

        <section className="flex flex-col gap-1.5">
          <SectionLabel>Imported · {customFonts.length}</SectionLabel>
          {customFonts.length === 0 ? (
            <p className="text-[11.5px] leading-relaxed text-mute">
              The bundled system fonts are already available. Imported fonts stay loaded for this
              session.
            </p>
          ) : (
            customFonts.map((family) => (
              <div
                key={family}
                className="flex items-center gap-2 rounded-xl border border-line bg-ink-2 px-3 py-2"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] text-text" style={{ fontFamily: family }}>
                  {family}
                </span>
                <IconButton
                  label={`Remove ${family}`}
                  size="sm"
                  tone="danger"
                  onClick={() => onRemoveFont(family)}
                >
                  <Trash2 size={13} />
                </IconButton>
              </div>
            ))
          )}
        </section>

        <Button variant="primary" block onClick={onClose}>
          <Check size={14} /> Done
        </Button>
      </div>
    </Sheet>
  );
};
