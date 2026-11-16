import { ReferenceImage } from '../types/vector';

const ACCEPTED = /^image\//;

export function isImageFile(file: File): boolean {
  return ACCEPTED.test(file.type);
}

/** Builds a reference overlay from any image URL, scaled to fit the artboard. */
export function referenceImageFromSrc(src: string, name = 'Reference'): Promise<ReferenceImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const maxSide = 480;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      resolve({
        id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name,
        url: src,
        naturalWidth: img.width,
        naturalHeight: img.height,
        x: 60,
        y: 60,
        width: Math.max(40, Math.round(img.width * scale)),
        height: Math.max(40, Math.round(img.height * scale)),
        opacity: 0.45,
        // Movable on arrival: a reference you cannot position is not a reference.
        // The lock is for when it is finally aligned and tracing begins.
        locked: false,
        visible: true,
      });
    };
    img.onerror = () => reject(new Error('Could not load that image.'));
    img.src = src;
  });
}

/** Reads an image file into a reference overlay sized to the artboard. */
export function referenceImageFromFile(file: File): Promise<ReferenceImage> {
  return new Promise((resolve, reject) => {
    if (!isImageFile(file)) {
      reject(new Error('That file is not an image.'));
      return;
    }
    // The bytes are kept as a Blob; base64 inside the project record made every
    // imported photo a third larger and had to be decoded on each load.
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const maxSide = 480;
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      resolve({
        id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: file.name.replace(/\.[^/.]+$/, '') || 'Reference',
        url,
        blob: file,
        naturalWidth: img.width,
        naturalHeight: img.height,
        x: 60,
        y: 60,
        width: Math.round(img.width * scale),
        height: Math.round(img.height * scale),
        opacity: 0.45,
        locked: false,
        visible: true,
      });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode the image.'));
    };
    img.src = url;
  });
}

/**
 * Rebuilds drawable URLs for a document that came back from storage. A blob URL
 * from the previous session is dead, so anything carrying bytes gets a fresh
 * one; older documents keep their data URL untouched.
 */
export function hydrateReferenceUrls(references: ReferenceImage[]): ReferenceImage[] {
  return references.map((reference) => {
    if (!reference.blob) return reference;
    if (reference.url?.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(reference.url);
      } catch {
        // A URL the browser already dropped is not worth failing a load over.
      }
    }
    return { ...reference, url: URL.createObjectURL(reference.blob) };
  });
}

/**
 * Reference images as the JSON backup needs them: bytes inlined as data URLs,
 * because a Blob cannot be written into a .json file.
 */
export async function referencesForBackup(
  references: ReferenceImage[] | undefined
): Promise<ReferenceImage[] | undefined> {
  if (!references?.length) return references;
  return Promise.all(
    references.map(async (reference) => {
      if (!reference.blob) return reference;
      const dataUrl = await blobToDataUrl(reference.blob);
      return { ...reference, url: dataUrl, blob: undefined };
    })
  );
}

/** Placed photos are capped so a 12 MP camera shot cannot bloat the document. */
const ARTWORK_MAX_SIDE = 1600;

async function referenceBytes(reference: ReferenceImage): Promise<Blob> {
  if (reference.blob) return reference.blob;
  const response = await fetch(reference.url);
  if (!response.ok) throw new Error('Could not read that image.');
  return response.blob();
}

/**
 * The paint an image object carries.
 *
 * A reference can draw from an object URL, because it is only ever painted by
 * the live canvas. Artwork cannot: a blob: URL dies with the session, and both
 * an exported SVG and the rasteriser used for PNG refuse to load one, so a photo
 * placed as artwork disappeared from every export and shared file. The bytes are
 * therefore embedded as a data URL, downscaled to keep the document small.
 */
export async function imagePaintFromReference(
  reference: ReferenceImage
): Promise<{ url: string; width: number; height: number }> {
  const blob = await referenceBytes(reference);
  const bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    const url = reference.url?.startsWith('blob:') ? reference.url : URL.createObjectURL(blob);
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not decode the image.'));
    img.src = url;
  });
  const sourceWidth = bitmap.naturalWidth || reference.naturalWidth || reference.width;
  const sourceHeight = bitmap.naturalHeight || reference.naturalHeight || reference.height;
  const scale = Math.min(1, ARTWORK_MAX_SIDE / Math.max(sourceWidth, sourceHeight));
  const width = Math.max(1, Math.round(sourceWidth * scale));
  const height = Math.max(1, Math.round(sourceHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not prepare that image.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  // Keep transparency when the file had any; a photo is stored as JPEG.
  const lossless = /png|webp|gif|avif|svg/i.test(blob.type);
  const url = lossless ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.92);
  return { url, width, height };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image.'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') resolve(result);
      else reject(new Error('Could not read the image.'));
    };
    reader.readAsDataURL(blob);
  });
}
