import type { ReceiptBounds } from '$lib/types';

export async function cropImage(
  imageBase64: string,
  bounds: ReceiptBounds,
  sourceMimeType: string = 'image/jpeg',
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const sx = Math.round(bounds.x * img.naturalWidth);
      const sy = Math.round(bounds.y * img.naturalHeight);
      const sw = Math.round(bounds.w * img.naturalWidth);
      const sh = Math.round(bounds.h * img.naturalHeight);
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
