import React, { useMemo } from 'react';
import { RotateCcw, Check } from 'lucide-react';
import { AnchorPoint, PressureConfig } from '../types/vector';
import { generateVariableStrokePolygon } from '../utils/bezier';
import { Button, SectionLabel, Segmented, Sheet } from './ui/primitives';

interface PressureSheetProps {
  open: boolean;
  onClose: () => void;
  config: PressureConfig;
  onChange: (config: PressureConfig) => void;
}

const DEFAULTS: PressureConfig = {
  source: 'stylus-or-touch',
  minWidth: 2,
  maxWidth: 24,
  smoothing: 0.7,
  calligraphyAngle: 30,
};

/** Preview stroke: a sine wave whose pressure swells in the middle. */
function previewPoints(): AnchorPoint[] {
  const pts: AnchorPoint[] = [];
  for (let i = 0; i <= 46; i++) {
    const t = i / 46;
    pts.push({
      id: `p-${i}`,
      x: 8 + t * 244,
      y: 30 + Math.sin(t * Math.PI * 2) * 13,
      type: 'smooth',
      pressure: 0.08 + Math.sin(t * Math.PI) * 0.92,
    });
  }
  return pts;
}

export const PressureSheet: React.FC<PressureSheetProps> = ({ open, onClose, config, onChange }) => {
  const preview = useMemo(() => generateVariableStrokePolygon(previewPoints(), config), [config]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Brush pressure"
      eyebrow="Studio"
      subtitle="How finger and stylus speed turns into stroke weight."
    >
      <div className="flex flex-col gap-5">
        <div className="grid h-20 place-items-center rounded-xl border border-line bg-ink-0">
          <svg viewBox="0 0 260 60" className="h-16 w-full px-2">
            <path d={preview} fill="#cdff5c" />
          </svg>
        </div>

        <section className="flex flex-col gap-2">
          <SectionLabel>Input</SectionLabel>
          <Segmented
            value={config.source}
            onChange={(source) => onChange({ ...config, source })}
            options={[
              { value: 'stylus-or-touch', label: 'Auto' },
              { value: 'velocity', label: 'Speed' },
              { value: 'fixed', label: 'Uniform' },
            ]}
          />
          <p className="text-[11px] leading-relaxed text-mute">
            {config.source === 'stylus-or-touch'
              ? 'Stylus pressure when available, finger speed otherwise.'
              : config.source === 'velocity'
                ? 'Always derive weight from speed — predictable with a finger.'
                : 'One constant weight, like a technical pen.'}
          </p>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <SectionLabel>Thin end</SectionLabel>
            <span className="font-mono text-[11px] font-bold text-accent">{config.minWidth} px</span>
          </div>
          <input
            type="range"
            min={1}
            max={16}
            step={1}
            value={config.minWidth}
            onChange={(e) => {
              const minWidth = parseInt(e.target.value, 10);
              onChange({
                ...config,
                minWidth,
                maxWidth: Math.max(config.maxWidth, minWidth + 2),
              });
            }}
            aria-label="Minimum stroke width"
          />
          <div className="flex items-center justify-between">
            <SectionLabel>Thick end</SectionLabel>
            <span className="font-mono text-[11px] font-bold text-accent">{config.maxWidth} px</span>
          </div>
          <input
            type="range"
            min={Math.max(6, config.minWidth + 2)}
            max={64}
            step={1}
            value={config.maxWidth}
            onChange={(e) => onChange({ ...config, maxWidth: parseInt(e.target.value, 10) })}
            aria-label="Maximum stroke width"
          />
          <div className="flex items-center justify-between">
            <SectionLabel>Nib angle</SectionLabel>
            <span className="font-mono text-[11px] font-bold text-accent">
              {config.calligraphyAngle}°
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={90}
            step={5}
            value={config.calligraphyAngle}
            onChange={(e) => onChange({ ...config, calligraphyAngle: parseInt(e.target.value, 10) })}
            aria-label="Calligraphy nib angle"
          />
          <div className="flex items-center justify-between">
            <SectionLabel>Stabiliser</SectionLabel>
            <span className="font-mono text-[11px] font-bold text-accent">
              {Math.round(config.smoothing * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={0.92}
            step={0.02}
            value={config.smoothing}
            onChange={(e) => onChange({ ...config, smoothing: parseFloat(e.target.value) })}
            aria-label="Stroke stabiliser"
          />
        </section>

        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => onChange(DEFAULTS)}>
            <RotateCcw size={14} /> Reset
          </Button>
          <Button variant="primary" className="flex-1" onClick={onClose}>
            <Check size={14} /> Done
          </Button>
        </div>
      </div>
    </Sheet>
  );
};
