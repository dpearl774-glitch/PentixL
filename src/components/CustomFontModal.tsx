import React, { useState } from 'react';
import { Upload, Type as FontIcon, Check, Trash2, X } from 'lucide-react';

interface CustomFontModalProps {
  isOpen: boolean;
  onClose: () => void;
  customFonts?: string[];
  onAddFont?: (fontName: string) => void;
  onFontUploaded?: (fontName: string) => void;
  onRemoveFont?: (fontName: string) => void;
}

export const CustomFontModal: React.FC<CustomFontModalProps> = ({
  isOpen,
  onClose,
  customFonts = [],
  onAddFont,
  onFontUploaded,
  onRemoveFont,
}) => {
  const [fontNameInput, setFontNameInput] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setErrorMsg(null);
    setIsUploading(true);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Clean font name from file name
      const fontName = fontNameInput.trim() || file.name.replace(/\.[^/.]+$/, '').replace(/[^a-zA-Z0-9\s_-]/g, '');

      try {
        const arrayBuffer = await file.arrayBuffer();
        const fontFace = new FontFace(fontName, arrayBuffer);
        const loadedFace = await fontFace.load();
        document.fonts.add(loadedFace);

        onAddFont?.(fontName);
        onFontUploaded?.(fontName);
        setFontNameInput('');
      } catch (err) {
        console.error('Error loading custom font:', err);
        setErrorMsg(`Failed to load "${file.name}". Please ensure it is a valid TTF, OTF, WOFF or WOFF2 font file.`);
      }
    }

    setIsUploading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-[#0F172A] border border-slate-800 rounded-xl p-5 shadow-2xl w-full max-w-md flex flex-col gap-4 text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <FontIcon size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100">Custom Typography</h3>
              <p className="text-[11px] text-slate-400">Import OTF, TTF, WOFF font files for logos</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Upload Drop Zone */}
        <div className="flex flex-col gap-2">
          <label className="text-[11px] font-semibold text-slate-300">
            Font Family Name (Optional)
          </label>
          <input
            type="text"
            value={fontNameInput}
            onChange={(e) => setFontNameInput(e.target.value)}
            placeholder="e.g. Brand Display Serif (defaults to file name)"
            className="w-full bg-[#070B14] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
          />

          <label className="relative cursor-pointer mt-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-cyan-500/40 rounded-xl p-6 bg-[#070B14]/60 hover:bg-[#070B14] transition-all group">
            <Upload size={22} className="text-slate-400 group-hover:text-cyan-400 transition-colors mb-2" />
            <span className="text-xs font-semibold text-slate-200">
              {isUploading ? 'Loading Font File...' : 'Choose or Drag Font File'}
            </span>
            <span className="text-[10px] text-slate-500 mt-0.5">Supports .ttf, .otf, .woff, .woff2</span>
            <input
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              onChange={handleFileUpload}
              className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
            />
          </label>
        </div>

        {errorMsg && (
          <p className="text-xs text-rose-400 bg-rose-950/40 border border-rose-900/50 p-2.5 rounded-lg">
            {errorMsg}
          </p>
        )}

        {/* Active Custom Fonts List */}
        <div className="flex flex-col gap-2 pt-2 border-t border-slate-800">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Loaded Fonts ({customFonts.length})
          </span>
          {customFonts.length === 0 ? (
            <p className="text-xs text-slate-500 italic py-1">No custom fonts imported yet. Standard web fonts available.</p>
          ) : (
            <div className="flex flex-col gap-1.5 max-h-40 overflow-y-auto pr-1">
              {customFonts.map((font) => (
                <div
                  key={font}
                  className="flex items-center justify-between p-2.5 bg-[#070B14] border border-slate-800/80 rounded-lg"
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <Check size={13} className="text-cyan-400 shrink-0" />
                    <span className="text-xs font-medium text-slate-200 truncate" style={{ fontFamily: font }}>
                      {font}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveFont?.(font)}
                    className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                    title="Remove font"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
