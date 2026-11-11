import { RangeInput } from './ui/primitives';
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
  initialLetterSpacing: number;
  initialFillColor: string;
  customFonts: string[];
  /** Most recently used first, so a big library stays out of the way */
  recentFonts: string[];
  editingPathId: string | null;
  onSave: (data: {
    text: string;
    fontFamily: string;
    fontSize: number;
    letterSpacing: number;
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
  initialLetterSpacing,
  initialFillColor,
  customFonts,
  recentFonts,
  editingPathId,
  onSave,
}) => {
  const [text, setText] = useState(initialText);
  const [fontFamily, setFontFamily] = useState(initialFontFamily);
  const [fontSize, setFontSize] = useState(initialFontSize);
  const [letterSpacing, setLetterSpacing] = useState(initialLetterSpacing);
  const [fillColor, setFillColor] = useState(initialFillColor);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setText(initialText);
    setFontFamily(initialFontFamily);
    setFontSize(initialFontSize);
    setLetterSpacing(initialLetterSpacing);
    setFillColor(initialFillColor);
    setQuery('');
  }, [open, initialText, initialFontFamily, initialFontSize, initialLetterSpacing, initialFillColor]);

  const allFonts = React.useMemo(() => {
    const system = SYSTEM_FONTS.map((f) => ({ value: f.value, label: f.label }));
    const custom = customFonts
      .filter((f) => !SYSTEM_FONTS.some((s) => s.value === f))
      .map((f) => ({ value: f, label: f }));
    return [...system, ...custom];
  }, [customFonts]);

  const recentOptions = React.useMemo(
    () =>
      recentFonts
        .map((family) => allFonts.find((f) => f.value === family))
        .filter((f): f is { value: string; label: string } => !!f)
        .slice(0, 4),
    [recentFonts, allFonts]
  );

  const q = query.trim().toLowerCase();
  const filteredFonts = q
    ? allFonts.filter(
        (f) => f.label.toLowerCase().includes(q) || f.value.toLowerCase().includes(q)
      )
    : allFonts;

  const fontRow = (f: { value: string; label: string }) => {
    const active = fontFamily === f.value;
    return (
      <button
        key={f.value}
        type="button"
        onClick={() => setFontFamily(f.value)}
        aria-pressed={active}
        className={`press flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left ${
          active ? 'bg-line-strong text-text' : 'text-dim hover:bg-ink-2 hover:text-text'
        }`}
      >
        <span className="w-5 shrink-0 text-center font-sans text-[9px] uppercase opacity-60">
          Aa
        </span>
        <span className="min-w-0 flex-1 truncate text-[14px]" style={{ fontFamily: f.value }}>
          {f.label}
        </span>
        {active && <Check size={13} className="shrink-0" />}
      </button>
    );
  };

  const submit = () => {
    if (!text.trim()) return;
    onSave({ text: text.trim(), fontFamily, fontSize, letterSpacing, fillColor, editingPathId });
    onClose();
  };

  const done = () => {
    if (!text.trim()) {
      onClose();
      return;
    }
    const changed =
      text.trim() !== initialText.trim() ||
      fontFamily !== initialFontFamily ||
      fontSize !== initialFontSize ||
      letterSpacing !== initialLetterSpacing ||
      fillColor !== initialFillColor;
    if (changed) submit();
    else onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={done}
      onDone={done}
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
          className="w-full resize-none rounded-lg border border-line bg-ink-0 px-3 py-2.5 text-[15px] font-semibold leading-snug text-text outline-none placeholder:text-mute focus:border-accent/60"
        />

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <SectionLabel>Typeface</SectionLabel>
            <span className="font-mono text-[10px] text-mute">{allFonts.length}</span>
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search fonts"
            aria-label="Search fonts"
            className="h-9 w-full rounded-lg border border-line bg-ink-0 px-3 text-[12.5px] text-text outline-none placeholder:text-mute focus:border-accent/60"
          />

          <div className="max-h-56 overflow-y-auto rounded-lg border border-line bg-ink-0/50 p-1">
            {!q && recentOptions.length > 0 && (
              <div className="mb-1">
                <div className="label-mono px-2 py-1">Recent</div>
                {recentOptions.map(fontRow)}
              </div>
            )}
            {!q && <div className="label-mono px-2 py-1">All fonts</div>}
            {filteredFonts.length === 0 ? (
              <p className="px-2 py-3 text-[11.5px] text-mute">No font matches “{query}”.</p>
            ) : (
              filteredFonts.map(fontRow)
            )}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <SectionLabel>Size</SectionLabel>
            <span className="font-mono text-[11px] font-bold text-accent">{fontSize} px</span>
          </div>
          <RangeInput
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

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <SectionLabel>Letter spacing</SectionLabel>
            <span className="font-mono text-[11px] font-bold text-accent">
              {letterSpacing > 0 ? '+' : ''}
              {letterSpacing} px
            </span>
          </div>
          <RangeInput
            type="range"
            min={-6}
            max={48}
            step={1}
            value={letterSpacing}
            onChange={(e) => setLetterSpacing(parseInt(e.target.value, 10))}
            aria-label="Letter spacing"
          />
          <div className="flex items-center gap-1.5">
            {[-2, 0, 2, 6, 12, 24].map((v) => (
              <Chip key={v} active={letterSpacing === v} onClick={() => setLetterSpacing(v)}>
                <span className="font-mono text-[11px]">{v > 0 ? `+${v}` : v}</span>
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
        <div className="grid min-h-[86px] place-items-center overflow-hidden rounded-lg border border-line bg-ink-0 px-3 py-4">
          <p
            className="max-w-full break-words text-center font-bold leading-tight"
            style={{
              fontFamily,
              color: fillColor,
              fontSize: Math.min(fontSize, 44),
              letterSpacing: letterSpacing * (Math.min(fontSize, 44) / fontSize),
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
