import React, { useEffect, useState } from 'react';
import { Check, Type as TypeIcon } from 'lucide-react';
import { Button, Chip, SectionLabel, Sheet } from './ui/primitives';

export const SYSTEM_FONTS = [
  { value: 'Plus Jakarta Sans, sans-serif', label: 'Jakarta' },
  { value: 'Impact, sans-serif', label: 'Impact' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: "'Times New Roman', serif", label: 'Times' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: "'Courier New', monospace", label: 'Courier' },
];

interface TextSheetProps {
  open: boolean;
  onClose: () => void;
  initialText: string;
  initialFontFamily: string;
  initialFontSize: number;
  initialFillColor: string;
  customFonts: string[];
  editingPathId: string | null;
  onSave: (data: {
    text: string;
    fontFamily: string;
    fontSize: number;
    fillColor: string;
    editingPathId: string | null;
  }) => void;
}

const SIZES = [24, 36, 48, 64, 84, 110];

export const TextSheet: React.FC<TextSheetProps> = ({
  open,
  onClose,
  initialText,
  initialFontFamily,
  initialFontSize,
  initialFillColor,
  customFonts,
  editingPathId,
  onSave,
}) => {
  const [text, setText] = useState(initialText);
  const [fontFamily, setFontFamily] = useState(initialFontFamily);
  const [fontSize, setFontSize] = useState(initialFontSize);
  const [fillColor, setFillColor] = useState(initialFillColor);

  useEffect(() => {
    if (!open) return;
    setText(initialText);
    setFontFamily(initialFontFamily);
    setFontSize(initialFontSize);
    setFillColor(initialFillColor);
  }, [open, initialText, initialFontFamily, initialFontSize, initialFillColor]);

  const submit = () => {
    if (!text.trim()) return;
    onSave({ text: text.trim(), fontFamily, fontSize, fillColor, editingPathId });
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={editingPathId ? 'Edit text' : 'Add text'}
      eyebrow="Typography"
      subtitle="Live text — convert to curves when final."
    >
      <div className="flex flex-col gap-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          placeholder="Brand name"
          autoFocus
          className="w-full resize-none rounded-xl border border-line bg-ink-0 px-3 py-2.5 text-[15px] font-semibold leading-snug text-text outline-none placeholder:text-mute focus:border-accent/60"
        />

        <section className="flex flex-col gap-2">
          <SectionLabel>Typeface</SectionLabel>
          <div className="scroll-x -mx-1 flex gap-1.5 px-1 pb-0.5">
            {SYSTEM_FONTS.map((f) => (
              <Chip
                key={f.value}
                active={fontFamily === f.value}
                onClick={() => setFontFamily(f.value)}
              >
                <span style={{ fontFamily: f.value }} className="text-[13px]">
                  {f.label}
                </span>
              </Chip>
            ))}
            {customFonts.map((f) => (
              <Chip key={f} active={fontFamily === f} onClick={() => setFontFamily(f)}>
                <span style={{ fontFamily: f }} className="text-[13px]">
                  {f}
                </span>
              </Chip>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <SectionLabel>Size</SectionLabel>
            <span className="font-mono text-[11px] font-bold text-accent">{fontSize} px</span>
          </div>
          <input
            type="range"
            min={16}
            max={180}
            step={2}
            value={fontSize}
            onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
            aria-label="Font size"
          />
          <div className="flex items-center gap-1.5">
            {SIZES.map((s) => (
              <Chip key={s} active={fontSize === s} onClick={() => setFontSize(s)}>
                <span className="font-mono text-[11px]">{s}</span>
              </Chip>
            ))}
          </div>
        </section>

        <section className="flex items-center gap-3">
          <SectionLabel>Colour</SectionLabel>
          <label className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-line-strong">
            <span className="absolute inset-0" style={{ backgroundColor: fillColor }} />
            <input
              type="color"
              value={fillColor}
              onChange={(e) => setFillColor(e.target.value.toUpperCase())}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              aria-label="Text colour"
            />
          </label>
          <span className="font-mono text-[11px] text-dim">{fillColor.toUpperCase()}</span>
          <span className="flex-1" />
          <TypeIcon size={14} className="text-mute" />
        </section>

        {/* Preview */}
        <div className="grid min-h-[86px] place-items-center overflow-hidden rounded-xl border border-line bg-ink-0 px-3 py-4">
          <p
            className="max-w-full break-words text-center font-bold leading-tight"
            style={{
              fontFamily,
              color: fillColor,
              fontSize: Math.min(fontSize, 44),
            }}
          >
            {text.trim() || 'Brand name'}
          </p>
        </div>

        <Button variant="primary" block onClick={submit} disabled={!text.trim()}>
          <Check size={15} /> {editingPathId ? 'Save changes' : 'Place text'}
        </Button>
      </div>
    </Sheet>
  );
};
