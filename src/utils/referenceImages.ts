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
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the image.'));
    reader.onload = (event) => {
      const url = event.target?.result;
      if (typeof url !== 'string') {
        reject(new Error('Could not read the image.'));
        return;
      }
      const img = new Image();
      img.onload = () => {
        const maxSide = 480;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        resolve({
          id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: file.name.replace(/\.[^/.]+$/, '') || 'Reference',
          url,
          x: 60,
          y: 60,
          width: Math.round(img.width * scale),
          height: Math.round(img.height * scale),
          opacity: 0.45,
          locked: false,
          visible: true,
        });
      };
      img.onerror = () => reject(new Error('Could not decode the image.'));
      img.src = url;
    };
    reader.readAsDataURL(file);
  });
}
