import { registerOutlineFont } from './fontOutlines';

/**
 * The typeface that ships with Pentix, in the weights the app draws with.
 *
 * Each file does two jobs. The outline registry reads its curves, so "To curves"
 * produces the typeface's own Bézier outlines. A FontFace makes the browser draw
 * the label from the same bytes. Both matter: with only the registry the artboard
 * depended on the network for its Jakarta, so a blocked or slow font request left
 * the text drawn in a fallback face while the conversion built real Jakarta
 * glyphs — every letter changed shape the moment it was outlined.
 */
const BUNDLED_FACES: Array<[string, string, string]> = [
  ['Plus Jakarta Sans', 'fonts/PlusJakartaSans-Regular.woff', '400'],
  ['Plus Jakarta Sans', 'fonts/PlusJakartaSans-Bold.woff', '700'],
];

let loading: Promise<void> | null = null;

/**
 * Loads the bundled faces once and remembers the promise.
 *
 * Conversion awaits this. Parsing happens after first paint, so a label
 * converted in the first moment after opening the app used to find an empty
 * registry and fall through to the tracer — a word of melted pixels instead of
 * the font's own curves, for every family at once.
 */
export function ensureBundledFonts(): Promise<void> {
  if (loading) return loading;

  loading = (async () => {
    for (const [family, path, weight] of BUNDLED_FACES) {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}${path}`);
        if (!response.ok) continue;
        const bytes = await response.arrayBuffer();
        await registerOutlineFont(family, bytes.slice(0));
        if (typeof FontFace !== 'undefined' && typeof document !== 'undefined') {
          document.fonts.add(await new FontFace(family, bytes, { weight }).load());
        }
      } catch {
        // Without the file, conversion stays on the tracer.
      }
    }
  })();

  return loading;
}
