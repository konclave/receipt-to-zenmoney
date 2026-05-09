# Receipt Image Crop — Design Spec

**Date:** 2026-05-09
**Goal:** Reduce the size of receipt images stored in IndexedDB by cropping to the receipt boundary after Claude parses the image.

---

## Overview

Extend the existing Claude parse call to also return the receipt's bounding box within the image. After parsing, crop the image client-side with the Canvas API and store the cropped JPEG instead of the full compressed photo. If Claude cannot locate the bounds, the full image is stored unchanged.

---

## 1. Claude Prompt & Response Schema

### `src/lib/types/index.ts`

Add `receipt_bounds` to `ParseResult`:

```ts
receipt_bounds: { x: number; y: number; w: number; h: number } | null
```

`x`, `y`, `w`, `h` are fractions (0.0–1.0) of the image dimensions — the tightest rectangle containing the receipt. `null` means Claude could not locate it.

### `src/lib/services/claude.ts`

- `buildPrompt` updated to instruct Claude to return `receipt_bounds` alongside the existing fields, with `null` if the receipt boundary cannot be determined.
- `validateParseResult` updated to accept both a valid bounds object (four numeric fields, each 0–1) and `null`.

---

## 2. Cropping Logic

### `src/lib/services/image-crop.ts` (new file)

```ts
cropImage(imageBase64: string, bounds: { x: number; y: number; w: number; h: number }): Promise<string>
```

- Loads the base64 image into an `HTMLImageElement`.
- Draws the clipped region onto a temporary `<canvas>`.
- Returns a JPEG base64 string at quality 0.85.

### `src/routes/review/+page.svelte`

After `parseReceipt` returns in `onMount`:

1. If `result.receipt_bounds` is non-null, call `cropImage(capture.imageBase64, result.receipt_bounds)` and store the result in a component-level `croppedImageBase64` state variable.
2. Errors from `cropImage` are caught silently; `croppedImageBase64` stays `null` on failure.

In `handleSubmit`, when constructing the blob for `saveReceiptImage`, use `croppedImageBase64 ?? capture.imageBase64`.

The `pending-capture` record is not updated — it holds the full image as source of truth for the duration of the review flow.

---

## 3. Testing

### `src/lib/services/image-crop.test.ts` (new file)

- **Happy path:** given a known base64 PNG and bounds `{ x: 0.1, y: 0.1, w: 0.8, h: 0.8 }`, the returned image dimensions match the expected cropped size.
- **Null bounds no-op:** when `receipt_bounds` is `null`, the original image is stored unchanged.

### `src/lib/services/claude.test.ts` (additions)

- A mock response with a valid `receipt_bounds` object passes `validateParseResult`.
- A mock response with `receipt_bounds: null` also passes `validateParseResult`.

---

## Out of Scope

- Showing the cropped image to the user before saving.
- Adjusting crop bounds manually.
- Client-side receipt detection (no TensorFlow.js / OpenCV.js).
- Updating the `pending-capture` record with the cropped image.
