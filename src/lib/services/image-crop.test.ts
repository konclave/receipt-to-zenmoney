import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cropImage } from './image-crop';

class MockImage {
  onload: (() => void) | null = null;
  onerror: ((e: unknown) => void) | null = null;
  naturalWidth = 200;
  naturalHeight = 400;
  set src(_: string) {
    this.onload?.();
  }
}

describe('cropImage', () => {
  let createElementSpy: ReturnType<typeof vi.spyOn>;
  const mockCtx = { drawImage: vi.fn() };
  const mockCanvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => mockCtx),
    toDataURL: vi.fn(() => 'data:image/jpeg;base64,CROPPED_BASE64'),
  };

  beforeEach(() => {
    vi.stubGlobal('Image', MockImage);
    createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'canvas') return mockCanvas as unknown as HTMLCanvasElement;
      return document.createElement(tag);
    });
    mockCtx.drawImage.mockClear();
    mockCanvas.getContext.mockClear();
    mockCanvas.toDataURL.mockClear();
  });

  afterEach(() => {
    createElementSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it('crops to bounds and returns JPEG base64', async () => {
    // Image is 200×400. Bounds: x=0.1, y=0.1, w=0.8, h=0.85
    // sx=round(0.1*200)=20, sy=round(0.1*400)=40, sw=round(0.8*200)=160, sh=round(0.85*400)=340
    const result = await cropImage('FAKE_BASE64', { x: 0.1, y: 0.1, w: 0.8, h: 0.85 });

    expect(mockCanvas.width).toBe(160);
    expect(mockCanvas.height).toBe(340);
    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      expect.any(MockImage),
      20,
      40,
      160,
      340,
      0,
      0,
      160,
      340,
    );
    expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.85);
    expect(result).toBe('CROPPED_BASE64');
  });

  it('rejects when image fails to load', async () => {
    vi.stubGlobal(
      'Image',
      class {
        onerror: ((e: unknown) => void) | null = null;
        set src(_: string) {
          this.onerror?.(new Error('load failed'));
        }
      },
    );

    await expect(cropImage('BAD', { x: 0, y: 0, w: 1, h: 1 })).rejects.toBeTruthy();
  });
});
