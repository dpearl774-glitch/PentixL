import React, { useState, useEffect } from 'react';
import { Type, X, Check, Copy, ClipboardPaste, Palette, Sparkles } from 'lucide-react';

interface TextInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialText?: string;
  initialFontFamily?: string;
  initialFontSize?: number;
  initialFillColor?: string;
  customFonts?: string[];
  editingPathId?: string | null;
  onSaveText: (data: {
    text: string;
    fontFamily: string;
    fontSize: number;
    fillColor: string;
    editingPathId?: string | null;
  }) => void;
}

const PRESET_SIZES = [24, 36, 48, 64, 80, 100, 120];

export const TextInputModal: React.FC<TextInputModalProps> = ({
  isOpen,
  onClose,
  initialText = '',
  initialFontFamily = 'Inter, sans-serif',
  initialFontSize = 52,
  initialFillColor = '#00E5FF',
  customFonts = [],
  editingPathId = null,
  onSaveText,
}) => {
  const [text, setText] = useState(initialText);
  const [fontFamily, setFontFamily] = useState(initialFontFamily);
  const [fontSize, setFontSize] = useState(initialFontSize);
  const [fillColor, setFillColor] = useState(initialFillColor);
  const [copiedNotification, setCopiedNotification] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setText(initialText || '');
      setFontFamily(initialFontFamily || 'Inter, sans-serif');
      setFontSize(initialFontSize || 52);
      setFillColor(initialFillColor || '#00E5FF');
    }
  }, [isOpen, initialText, initialFontFamily, initialFontSize, initialFillColor]);

  if (!isOpen) return null;

  const handlePaste = async () => {
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        setText((prev) => (prev ? `${prev}\n${clipText}` : clipText));
      }
    } catch (err) {
      console.warn('Clipboard read failed:', err);
    }
  };

  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedNotification(true);
      setTimeout(() => setCopiedNotification(false), 1500);
    } catch (err) {
      console.warn('Clipboard write failed:', err);
    }
  };

  const handleSave = () => {
    if (!text.trim()) return;
    onSaveText({
      text: text.trim(),
      fontFamily,
      fontSize,
      fillColor,
      editingPathId,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 select-none">
      <div className="bg-[#0b0f19] border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col text-slate-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-4 border-b border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
              <Type size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">
                {editingPathId ? 'Edit Vector Text' : 'Add Vector Text'}
              </h2>
              <p className="text-[11px] text-slate-400">
                Live SVG typography • Expand to vector curves anytime
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 flex flex-col gap-4 max-h-[75vh] overflow-y-auto no-scrollbar">
          {/* Text Input Area & Quick Actions */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-300">Text Content</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePaste}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors"
                  title="Paste from Clipboard"
                >
                  <ClipboardPaste size={12} />
                  <span>Paste</span>
                </button>
                <button
                  type="button"
                  onClick={handleCopy}
                  disabled={!text}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors disabled:opacity-40"
                  title="Copy Text"
                >
                  <Copy size={12} />
                  <span>{copiedNotification ? 'Copied!' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type or paste text here..."
              rows={3}
              autoFocus
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-sm font-medium text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 resize-none font-mono"
            />
          </div>

          {/* Typography Controls Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Font Family Selector */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-300">Font Family</label>
              <select
                value={fontFamily}
                onChange={(e) => setFontFamily(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-medium text-cyan-300 focus:outline-none focus:border-cyan-400"
              >
                <optgroup label="Standard Vector Fonts">
                  <option value="Inter, sans-serif">Inter (Clean Sans)</option>
                  <option value="Impact, sans-serif">Impact (Bold Logo)</option>
                  <option value="Arial, sans-serif">Arial</option>
                  <option value="'Times New Roman', serif">Times New Roman (Serif)</option>
                  <option value="Georgia, serif">Georgia</option>
                  <option value="'Courier New', monospace">Courier New (Monospace)</option>
                  <option value="'Trebuchet MS', sans-serif">Trebuchet MS</option>
                </optgroup>
                {customFonts.length > 0 && (
                  <optgroup label="Your Custom Fonts">
                    {customFonts.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Font Color Picker */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-slate-300">Text Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={fillColor}
                  onChange={(e) => setFillColor(e.target.value)}
                  className="w-9 h-9 rounded-xl border border-slate-700 bg-slate-900 cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  value={fillColor}
                  onChange={(e) => setFillColor(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-cyan-300 uppercase flex-1 focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>

          {/* Font Size Slider & Presets */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs">
              <label className="font-semibold text-slate-300">Font Size</label>
              <span className="font-mono text-cyan-400 font-bold">{fontSize}px</span>
            </div>
            <input
              type="range"
              min={16}
              max={180}
              step={2}
              value={fontSize}
              onChange={(e) => setFontSize(parseInt(e.target.value, 10))}
              className="w-full accent-cyan-400 cursor-pointer"
            />
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1">
              {PRESET_SIZES.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setFontSize(sz)}
                  className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border transition-colors ${
                    fontSize === sz
                      ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {sz}px
                </button>
              ))}
            </div>
          </div>

          {/* Real-time Preview */}
          <div className="flex flex-col gap-1 border-t border-slate-800 pt-3">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Preview
            </span>
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 min-h-[70px] flex items-center justify-center overflow-hidden">
              <p
                style={{
                  fontFamily,
                  fontSize: `${Math.min(fontSize, 42)}px`,
                  color: fillColor,
                  lineHeight: 1.2,
                }}
                className="text-center font-bold break-all max-w-full"
              >
                {text || 'Sample Text Preview'}
              </p>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="p-4 border-t border-slate-800 bg-[#080c16] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!text.trim()}
            className="px-5 py-2 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-400/20 disabled:opacity-40"
          >
            <Check size={14} />
            <span>{editingPathId ? 'Save Changes' : 'Insert Text'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
