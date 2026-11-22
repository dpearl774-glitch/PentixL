import type { GradientDef, SavedTextStyle } from '../types/vector';

/**
 * The style a label keeps: its type settings and its paint. A pure function
 * because the one thing it must never do silently is drop the gradient — a
 * label renders from its gradient, so a style that forgets it looks flat on
 * the next label and blames the type.
 */
export function savedTextStyleFrom(
  data: {
    fontFamily: string;
    fontSize: number;
    letterSpacing: number;
    lineHeight: number;
    textAlign: 'left' | 'center' | 'right';
    fillColor: string;
    fillGradient?: GradientDef;
  },
  name: string,
  /** The label's own gradient, for a panel that was opened before one was set */
  existingGradient?: GradientDef
): SavedTextStyle {
  const gradient = data.fillGradient ?? existingGradient;
  return {
    id: `style-${Date.now()}`,
    name: gradient ? `${name} · gradient` : name,
    fontFamily: data.fontFamily,
    fontSize: data.fontSize,
    letterSpacing: data.letterSpacing,
    lineHeight: data.lineHeight,
    textAlign: data.textAlign,
    fill: data.fillColor,
    ...(gradient ? { fillGradient: gradient } : {}),
  };
}
