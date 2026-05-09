# Receipt Image Crop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After Claude parses a receipt image it also returns the receipt bounding box; the review page uses that box to crop the image before storing it in IndexedDB, reducing stored size.

**Architecture:** `ParseResult` gains a nullable `receipt_bounds` field. `buildPrompt` is updated to ask Claude for it. A new `cropImage` utility does the Canvas crop. The review page calls `cropImage` after parsing and passes the cropped base64 to `saveReceiptImage` at submit time.

**Tech Stack:** TypeScript, SvelteKit/Svelte 5, Canvas API, Vitest + jsdom

---

## File Map

| Action | File |
|--------|------|
| Modify | `src/lib/types/index.ts` |
| Modify | `src/lib/services/claude.ts` |
| Modify | `src/lib/services/claude.test.ts` |
| Create | `src/lib/services/image-crop.ts` |
| Create | `src/lib/services/image-crop.test.ts` |
| Modify | `src/routes/review/+page.svelte` |

---

## Task 1: Add `receipt_bounds` to `ParseResult`

**Files:**
- Modify: `src/lib/types/index.ts`

- [ ] **Step 1: Update the type**

In `src/lib/types/index.ts`, replace:

```ts
export interface ParseResult {
  amount: number;
  currency: string;
  merchant: string;
  categoryId: string;
  date: string;
  confidence: 'high' | 'medium' | 'low';
}
```

with:

```ts
export interface ReceiptBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ParseResult {
  amount: number;
  currency: string;
  merchant: string;
  categoryId: string;
  date: string;
  confidence: 'high' | 'medium' | 'low';
  receipt_bounds: ReceiptBounds | null;
}
```

- [ ] **Step 2: Run type check to verify no regressions**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors (existing code ignores `receipt_bounds` so adding it is backwards-compatible).

- [ ] **Step 3: Commit**

```bash
git checkout -b feat/receipt-crop
git add src/lib/types/index.ts
git commit -m "feat: add receipt_bounds field to ParseResult type"
```

---

## Task 2: Update Claude prompt and validation

**Files:**
- Modify: `src/lib/services/claude.ts`
- Modify: `src/lib/services/claude.test.ts`

- [ ] **Step 1: Write failing tests**

In `src/lib/services/claude.test.ts`, add after the last `it(...)` block in the `'parseReceipt — Anthropic provider'` describe block:

```ts
  it('accepts a valid receipt_bounds object', async () => {
    mockAnthropic(JSON.stringify({
      ...PARSE_RESULT,
      receipt_bounds: { x: 0.05, y: 0.1, w: 0.9, h: 0.85 }
    }));
    const result = await parseReceipt('img', CATEGORIES, { provider: 'anthropic', apiKey: 'sk-test' });
    expect(result.receipt_bounds).toEqual({ x: 0.05, y: 0.1, w: 0.9, h: 0.85 });
  });

  it('accepts receipt_bounds: null', async () => {
    mockAnthropic(JSON.stringify({ ...PARSE_RESULT, receipt_bounds: null }));
    const result = await parseReceipt('img', CATEGORIES, { provider: 'anthropic', apiKey: 'sk-test' });
    expect(result.receipt_bounds).toBeNull();
  });

  it('throws when receipt_bounds has a value outside 0–1', async () => {
    mockAnthropic(JSON.stringify({
      ...PARSE_RESULT,
      receipt_bounds: { x: 1.5, y: 0.1, w: 0.9, h: 0.85 }
    }));
    await expect(
      parseReceipt('img', CATEGORIES, { provider: 'anthropic', apiKey: 'sk-test' })
    ).rejects.toThrow('receipt_bounds');
  });
```

Also update `PARSE_RESULT` at the top of the test file to include `receipt_bounds: null`:

```ts
const PARSE_RESULT = {
  amount: 1250,
  currency: 'RUB',
  merchant: 'Magnit',
  categoryId: 'c1',
  date: '2026-05-05',
  confidence: 'high',
  receipt_bounds: null,
};
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm exec vitest run src/lib/services/claude.test.ts
```

Expected: the 3 new tests fail (`receipt_bounds` is not yet validated or prompted for).

- [ ] **Step 3: Update `buildPrompt` in `claude.ts`**

Replace the `buildPrompt` function:

```ts
function buildPrompt(categories: Category[]): string {
  const categoryList = categories.map((c) => `${c.id}: ${c.title}`).join('\n');
  const today = new Date().toISOString().slice(0, 10);
  return `Extract from this receipt:
- total amount paid (number only, no currency symbol)
- currency code (ISO 4217, e.g. RUB)
- merchant/store name
- best matching category ID from this list:
${categoryList}
- transaction date (ISO 8601, use today ${today} if not visible)
- receipt bounding box as fractions of image size (x, y, w, h each 0.0–1.0, tightest rectangle around the receipt); set to null if the receipt boundary cannot be determined

Respond ONLY with valid JSON, no markdown:
{"amount":number,"currency":"string","merchant":"string","categoryId":"string","date":"string","confidence":"high"|"medium"|"low","receipt_bounds":{"x":number,"y":number,"w":number,"h":number}|null}`;
}
```

- [ ] **Step 4: Update `validateParseResult` in `claude.ts`**

Add the `receipt_bounds` validation block before the final `return raw as ParseResult;` line:

```ts
  if (r.receipt_bounds !== null && r.receipt_bounds !== undefined) {
    if (typeof r.receipt_bounds !== 'object' || Array.isArray(r.receipt_bounds))
      throw new Error('Invalid parse result: receipt_bounds must be an object or null');
    const b = r.receipt_bounds as Record<string, unknown>;
    for (const k of ['x', 'y', 'w', 'h'] as const) {
      if (typeof b[k] !== 'number' || !isFinite(b[k] as number) || (b[k] as number) < 0 || (b[k] as number) > 1)
        throw new Error(`Invalid parse result: receipt_bounds.${k} must be a number between 0 and 1`);
    }
  }
```

- [ ] **Step 5: Run tests to verify all pass**

```bash
pnpm exec vitest run src/lib/services/claude.test.ts
```

Expected: all tests pass, including the 3 new ones.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/claude.ts src/lib/services/claude.test.ts
git commit -m "feat: extend Claude prompt and validation to return receipt_bounds"
```

---

## Task 3: Create `cropImage` utility

**Files:**
- Create: `src/lib/services/image-crop.ts`
- Create: `src/lib/services/image-crop.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/services/image-crop.test.ts`:

```ts
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
    // Image is 200×400. Bounds: x=0.1, y=0.05, w=0.8, h=0.9
    // sx=20, sy=20, sw=160, sh=360
    const result = await cropImage('FAKE_BASE64', { x: 0.1, y: 0.05, w: 0.8, h: 0.9 });

    expect(mockCanvas.width).toBe(160);
    expect(mockCanvas.height).toBe(360);
    expect(mockCtx.drawImage).toHaveBeenCalledWith(
      expect.any(MockImage),
      20, 20, 160, 360,
      0, 0, 160, 360
    );
    expect(mockCanvas.toDataURL).toHaveBeenCalledWith('image/jpeg', 0.85);
    expect(result).toBe('CROPPED_BASE64');
  });

  it('rejects when image fails to load', async () => {
    vi.stubGlobal('Image', class {
      onerror: ((e: unknown) => void) | null = null;
      set src(_: string) {
        this.onerror?.(new Error('load failed'));
      }
    });

    await expect(cropImage('BAD', { x: 0, y: 0, w: 1, h: 1 })).rejects.toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm exec vitest run src/lib/services/image-crop.test.ts
```

Expected: FAIL — module `./image-crop` not found.

- [ ] **Step 3: Create `image-crop.ts`**

Create `src/lib/services/image-crop.ts`:

```ts
import type { ReceiptBounds } from '$lib/types';

export async function cropImage(imageBase64: string, bounds: ReceiptBounds): Promise<string> {
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
      canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
      resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1]);
    };
    img.onerror = reject;
    img.src = `data:image/jpeg;base64,${imageBase64}`;
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm exec vitest run src/lib/services/image-crop.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
pnpm exec vitest run
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/image-crop.ts src/lib/services/image-crop.test.ts
git commit -m "feat: add cropImage utility using Canvas API"
```

---

## Task 4: Wire crop into the review page

**Files:**
- Modify: `src/routes/review/+page.svelte`

- [ ] **Step 1: Add import and state variable**

In the `<script>` block of `src/routes/review/+page.svelte`, add the import after the existing imports:

```ts
  import { cropImage } from '$lib/services/image-crop'
```

And add a new state variable alongside the other `$state` declarations at the top:

```ts
  let croppedImageBase64 = $state<string | null>(null)
```

- [ ] **Step 2: Call `cropImage` after parsing**

Inside `onMount`, after the line `lowConfidence = result.confidence === 'low'`, add:

```ts
      if (result.receipt_bounds) {
        try {
          croppedImageBase64 = await cropImage(capture.imageBase64, result.receipt_bounds)
        } catch {
          // skip crop — original image will be stored
        }
      }
```

- [ ] **Step 3: Use cropped image when saving receipt**

In `handleSubmit`, find these two lines:

```ts
      const blob = await (await fetch(`data:${capture!.mimeType};base64,${capture!.imageBase64}`)).blob()
      await saveReceiptImage(txId, { blob, mimeType: capture!.mimeType })
```

Replace them with:

```ts
      const storedBase64 = croppedImageBase64 ?? capture!.imageBase64
      const storedMime: 'image/jpeg' | 'image/png' | 'image/webp' = croppedImageBase64 ? 'image/jpeg' : capture!.mimeType
      const blob = await (await fetch(`data:${storedMime};base64,${storedBase64}`)).blob()
      await saveReceiptImage(txId, { blob, mimeType: storedMime })
```

Note: `cropImage` always outputs JPEG, so `storedMime` is `'image/jpeg'` when a crop was applied.

- [ ] **Step 4: Run full test suite**

```bash
pnpm exec vitest run
```

Expected: all tests pass.

- [ ] **Step 5: Run type check**

```bash
pnpm exec tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/routes/review/+page.svelte
git commit -m "feat: crop receipt image to bounds before storing in IndexedDB"
```
