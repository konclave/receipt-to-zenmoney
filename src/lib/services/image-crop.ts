import type { ReceiptBounds } from '$lib/types';

export async function cropImage(
  imageBase64: string,
  bounds: ReceiptBounds,
  sourceMimeType: string = 'image/jpeg',
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const naturalWidth = img.naturalWidth;
      const naturalHeight = img.naturalHeight;
      if (naturalWidth <= 0 || naturalHeight <= 0) {
        reject(new Error('Image has invalid dimensions'));
        return;
      }

      const sx = Math.max(0, Math.min(naturalWidth, Math.floor(bounds.x * naturalWidth)));
      const sy = Math.max(0, Math.min(naturalHeight, Math.floor(bounds.y * naturalHeight)));
      const ex = Math.max(
        sx + 1,
        Math.min(naturalWidth, Math.ceil((bounds.x + bounds.w) * naturalWidth)),
      );
      const ey = Math.max(
        sy + 1,
        Math.min(naturalHeight, Math.ceil((bounds.y + bounds.h) * naturalHeight)),
      );
      const sw = ex - sx;
      const sh = ey - sy;

      const canvas = document.createElement('canvas');
      canvas.width = sw;
      canvas.height = sh;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not get 2D canvas context'));
        return;
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };
    img.onerror = reject;
    img.src = `data:${sourceMimeType};base64,${imageBase64}`;
  });
}
