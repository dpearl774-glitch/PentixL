import { RangeInput } from './ui/primitives';
import React, { useEffect, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Check, Plus, Type as TypeIcon, X } from 'lucide-react';
import type { GradientDef, SavedTextStyle, TextRange } from '../types/vector';
import { normalizeTextRanges } from '../utils/textRanges';
import { Button, Chip, NumberField, SectionLabel, Sheet } from './ui/primitives';

export const SYSTEM_FONTS = [
  { value: 'Plus Jakarta Sans, sans-serif', label: 'Jakarta' },
  { value: 'Impact, sans-serif', label: 'Impact' },
  { value: 'Arial, sans-serif', label: 'Arial' },
  { value: "'Times New Roman', serif", label: 'Times' },
  { value: 'Georgia, serif', label: 'Georgia' },
  { value: "'Courier New', monospace", label: 'Courier' },
];

export type TextAlign = 'left' | 'center' | 'right';

export interface TextSheetData {
  text: string;
  fontFamily: string;
  fontSize: number;
  letterSpacing: number;
  lineHeight: number;
  textAlign: TextAlign;
  fillColor: string;
  /** A gradient paint rides along with a style, so a new label gets it too */
  fillGradient?: GradientDef;
  /** Characters that paint differently from the rest of the label */
  textRanges?: TextRange[];
  editingPathId: string | null;
}

interface TextSheetProps {
  open: boolean;
  onClose: () => void;
  initialText: string;
  initialFontFamily: string;
  initialFontSize: number;
  initialLetterSpacing: number;
  initialLineHeight: number;
  initialTextAlign: TextAlign;
  initialFillColor: string;
  initialFillGradient?: GradientDef;
  initialTextRanges?: TextRange[];
  customFonts: string[];
  /** Most recently used first, so a big library stays out of the way */
  recentFonts: string[];
  editingPathId: string | null;
  onSave: (data: TextSheetData) => void;
  /** Keep what is in the panel, then hand the label to the paint sheet */
  onOpenFill?: (data: TextSheetData) => void;
  /** Type and paint saved from earlier labels, newest first */
  savedStyles?: SavedTextStyle[];
  onSaveStyle?: (data: TextSheetData, name: string) => void;
  /** Applied live, so the artboard changes as the chip is pressed */
  onApplyStyle?: (style: SavedTextStyle) => void;
  onDeleteStyle?: (id: string) => void;
}

const SIZES = [24, 36, 48, 64, 84, 110];
const LEADING = [1, 1.2, 1.4, 1.6, 1.8];

export const TextSheet: React.FC<TextSheetProps> = ({
  open,
  onClose,
  initialText,
  initialFontFamily,
  initialFontSize,
  initialLetterSpacing,
  initialLineHeight,
  initialTextAlign,
  initialFillColor,
  initialFillGradient,
  initialTextRanges,
  customFonts,
  recentFonts,
  editingPathId,
  onSave,
  onOpenFill,
  savedStyles = [],
  onSaveStyle,
  onApplyStyle,
  onDeleteStyle,
}) => {
  const [text, setText] = useState(initialText);
  const [fontFamily, setFontFamily] = useState(initialFontFamily);
  const [fontSize, setFontSize] = useState(initialFontSize);
  const [letterSpacing, setLetterSpacing] = useState(initialLetterSpacing);
  const [lineHeight, setLineHeight] = useState(initialLineHeight);
  const [textAlign, setTextAlign] = useState<TextAlign>(initialTextAlign);
  const [fillColor, setFillColor] = useState(initialFillColor);
  const [fillGradient, setFillGradient] = useState<GradientDef | undefined>(initialFillGradient);
  const [ranges, setRanges] = useState<TextRange[]>(initialTextRanges ?? []);
  // Its own swatch: tinting from the label's colour would paint a range the
  // same colour as the rest of the word.
  const [tintColor, setTintColor] = useState('#FF5C8A');
  const [selectedChars, setSelectedChars] = useState(0);
  const textArea = React.useRef<HTMLTextAreaElement | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    setText(initialText);
    setFontFamily(initialFontFamily);
    setFontSize(initialFontSize);
    setLetterSpacing(initialLetterSpacing);
    setLineHeight(initialLineHeight);
    setTextAlign(initialTextAlign);
    setFillColor(initialFillColor);
    setFillGradient(initialFillGradient);
    setRanges(initialTextRanges ?? []);
    setSelectedChars(0);
    setQuery('');
  }, [
    open,
    initialText,
    initialFontFamily,
    initialFontSize,
    initialLetterSpacing,
    initialLineHeight,
    initialTextAlign,
    initialFillColor,
    initialFillGradient,
    initialTextRanges,
  ]);

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

  /** The characters the user has highlighted in the field above */
  const selectedRange = (): { start: number; end: number } | null => {
    const el = textArea.current;
    if (!el) return null;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    return end > start ? { start, end } : null;
  };

  /** Tints the highlighted letters, replacing any range they sit inside */
  const tintSelection = () => {
    const selection = selectedRange();
    if (!selection) return;
    const fill = tintColor.toUpperCase();
    const kept = ranges.filter(
      (range) => range.end <= selection.start || range.start >= selection.end
    );
    setRanges(normalizeTextRanges([...kept, { ...selection, fill }], text.length) ?? []);
    setSelectedChars(0);
  };

  const tintedChars = ranges.reduce((total, range) => total + (range.end - range.start), 0);

  const data = (): TextSheetData => ({
    text: text.trim(),
    fontFamily,
    fontSize,
    letterSpacing,
    lineHeight,
    textAlign,
    fillColor,
    fillGradient,
    textRanges: ranges,
    editingPathId,
  });

  const submit = () => {
    if (!text.trim()) return;
    onSave(data());
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
      lineHeight !== initialLineHeight ||
      textAlign !== initialTextAlign ||
      fillColor !== initialFillColor ||
      JSON.stringify(ranges) !== JSON.stringify(initialTextRanges ?? []);
    if (changed) submit();
    else onClose();
  };

  // Lines are only shifted against each other, so a single line has nothing to
  // align; the control says so rather than pretending to move the label.
  const lineCount = text.split(/\r?\n/).length;

  const fontLabel = (family: string) =>
    allFonts.find((f) => f.value === family)?.label ?? family.split(',')[0];

  /** A style is type plus paint: the words stay where they are */
  const applyStyle = (style: SavedTextStyle) => {
    setFontFamily(style.fontFamily);
    setFontSize(style.fontSize);
    setLetterSpacing(style.letterSpacing);
    setLineHeight(style.lineHeight);
    setTextAlign(style.textAlign);
    setFillColor(style.fill);
    setFillGradient(style.fillGradient);
    onApplyStyle?.(style);
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
          ref={textArea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onSelect={(e) =>
            setSelectedChars(
              Math.max(0, (e.currentTarget.selectionEnd ?? 0) - (e.currentTarget.selectionStart ?? 0))
            )
          }
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
            <span className="flex items-center gap-1">
              <NumberField
                value={fontSize}
                onChange={setFontSize}
                min={6}
                max={400}
                label="Font size in pixels"
              />
              <span className="font-mono text-[10px] text-mute">px</span>
            </span>
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
            <span className="flex items-center gap-1">
              <NumberField
                value={letterSpacing}
                onChange={setLetterSpacing}
                min={-20}
                max={96}
                label="Letter spacing in pixels"
              />
              <span className="font-mono text-[10px] text-mute">px</span>
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

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <SectionLabel>Line height</SectionLabel>
            <span className="flex items-center gap-1">
              <NumberField
                value={lineHeight}
                onChange={setLineHeight}
                min={0.5}
                max={4}
                decimals={2}
                label="Line height multiplier"
              />
              <span className="font-mono text-[10px] text-mute">
                × {Math.round(fontSize * lineHeight)} px
              </span>
            </span>
          </div>
          <RangeInput
            type="range"
            min={0.8}
            max={2.4}
            step={0.05}
            value={lineHeight}
            onChange={(e) => setLineHeight(Number(Number(e.target.value).toFixed(2)))}
            aria-label="Line height"
          />
          <div className="flex items-center gap-1.5">
            {LEADING.map((v) => (
              <Chip key={v} active={Math.abs(lineHeight - v) < 0.001} onClick={() => setLineHeight(v)}>
                <span className="font-mono text-[11px]">{v}</span>
              </Chip>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <SectionLabel>Align</SectionLabel>
            {lineCount < 2 && <span className="font-mono text-[10px] text-mute">one line</span>}
          </div>
          <div className="flex items-center gap-1">
            {(
              [
                { value: 'left' as const, icon: AlignLeft, label: 'Align lines left' },
                { value: 'center' as const, icon: AlignCenter, label: 'Align lines centre' },
                { value: 'right' as const, icon: AlignRight, label: 'Align lines right' },
              ]
            ).map(({ value, icon: Icon, label }) => (
              <button
                key={value}
                type="button"
                aria-label={label}
                aria-pressed={textAlign === value}
                disabled={lineCount < 2}
                onClick={() => setTextAlign(value)}
                className={`press grid h-8 flex-1 place-items-center rounded-md border ${
                  textAlign === value
                    ? 'border-accent/60 bg-ink-3 text-text'
                    : 'border-line bg-ink-0 text-dim hover:text-text'
                } ${lineCount < 2 ? 'opacity-40' : ''}`}
              >
                <Icon size={15} />
              </button>
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
          {onOpenFill && (
            <button
              type="button"
              onClick={() => onOpenFill(data())}
              disabled={!text.trim()}
              className="press rounded-md border border-line px-2 py-1.5 text-[11px] font-semibold text-dim hover:text-text disabled:opacity-40"
            >
              Gradient…
            </button>
          )}
          <TypeIcon size={14} className="text-mute" />
        </section>

        {/* Part of a word, without converting it: the label keeps its string and
            the highlighted letters keep their own paint. */}
        <section className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <SectionLabel>Part of the word</SectionLabel>
            <span className="font-mono text-[10px] text-mute">
              {tintedChars > 0 ? `${tintedChars} letters` : 'none'}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <label className="relative h-8 w-8 shrink-0 cursor-pointer overflow-hidden rounded-md border border-line-strong">
              <span className="absolute inset-0" style={{ backgroundColor: tintColor }} />
              <input
                type="color"
                value={tintColor}
                onChange={(e) => setTintColor(e.target.value.toUpperCase())}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label="Tint colour"
              />
            </label>
            <button
              type="button"
              aria-label="Tint selected letters"
              disabled={selectedChars === 0 || !text.trim()}
              onClick={tintSelection}
              className="press h-8 flex-1 rounded-md border border-line bg-ink-2 text-[11.5px] font-semibold text-dim hover:text-text disabled:opacity-40"
            >
              Tint {selectedChars > 0 ? `${selectedChars} highlighted` : 'highlighted letters'}
            </button>
            <button
              type="button"
              aria-label="Clear letter tint"
              disabled={tintedChars === 0}
              onClick={() => setRanges([])}
              className="press h-8 rounded-md border border-line px-2.5 text-[11.5px] font-semibold text-dim hover:text-text disabled:opacity-40"
            >
              Clear
            </button>
          </div>
          <p className="text-[10.5px] leading-snug text-mute">
            Highlight letters above, then tint them with the colour beside it. The label stays
            type.
          </p>
        </section>

        {onSaveStyle && (
          <section className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <SectionLabel>My styles</SectionLabel>
              <button
                type="button"
                disabled={!text.trim()}
                aria-label="Save this style"
                onClick={() =>
                  onSaveStyle(data(), `${fontLabel(fontFamily)} ${Math.round(fontSize)}`)
                }
                className="press flex items-center gap-1 rounded-md border border-line px-2 py-1 text-[11px] font-semibold text-dim hover:text-text disabled:opacity-40"
              >
                <Plus size={12} /> Save style
              </button>
            </div>
            {savedStyles.length === 0 ? (
              <p className="text-[11px] leading-snug text-mute">
                Save this label’s type and fill, then put them on another label in one tap.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {savedStyles.map((style) => (
                  <span
                    key={style.id}
                    className="flex items-center overflow-hidden rounded-lg border border-line bg-ink-0"
                  >
                    <button
                      type="button"
                      aria-label={`Apply style ${style.name}`}
                      onClick={() => applyStyle(style)}
                      className="press flex items-center gap-1.5 py-1 pl-2 pr-1.5 text-[11.5px] text-text"
                    >
                      <span
                        className="text-[13px] font-bold"
                        style={{ fontFamily: style.fontFamily, color: style.fill }}
                      >
                        Aa
                      </span>
                      {style.name}
                    </button>
                    <button
                      type="button"
                      aria-label={`Delete style ${style.name}`}
                      onClick={() => onDeleteStyle?.(style.id)}
                      className="press grid h-full w-6 place-items-center text-mute hover:text-danger"
                    >
                      <X size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Preview: the same line height and alignment the artboard will use */}
        <div className="grid min-h-[86px] place-items-center overflow-hidden rounded-lg border border-line bg-ink-0 px-3 py-4">
          <p
            className="max-w-full break-words font-bold"
            style={{
              fontFamily,
              color: fillColor,
              fontSize: Math.min(fontSize, 44),
              letterSpacing: letterSpacing * (Math.min(fontSize, 44) / fontSize),
              lineHeight,
              textAlign,
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
