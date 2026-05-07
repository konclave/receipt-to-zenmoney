# Receipt Image History — Design Spec

**Date:** 2026-05-07  
**Status:** approved

## Goal

Persist the receipt photo alongside each transaction so users can browse, view, and back up their receipt images.

## Decisions

- Images stored as native `Blob` objects in a separate IndexedDB store (not embedded on `Transaction`)
- History list shows a 48×48 thumbnail below each transaction row (tappable)
- Tapping thumbnail navigates to a dedicated `/receipt/[id]` page (full image + transaction summary)
- Images are included in backup exports (base64-encoded in the JSON5 envelope)

---

## Data Model

### `ReceiptImage` (new type in `src/lib/types/index.ts`)

```ts
export interface ReceiptImage {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  blob: Blob;
}
```

### `Transaction` (updated)

Add optional field:

```ts
hasReceipt?: boolean;
```

The flag lets the history list know a receipt is available without loading the Blob.

---

## IndexedDB

**DB version bumps to 5.** New object store added in the v5 upgrade:

```
receipt-images
  key:   txId (string)
  value: { blob: Blob; mimeType: string }
```

New module: `src/lib/db/receipt-images.ts`
- `saveReceiptImage(txId: string, image: ReceiptImage): Promise<void>`
- `getReceiptImage(txId: string): Promise<ReceiptImage | undefined>`
- `bulkGetReceiptImages(txIds: string[]): Promise<Map<string, ReceiptImage>>`
- `deleteReceiptImage(txId: string): Promise<void>`

---

## Capture Flow

In `src/routes/review/+page.svelte`, after `saveTransaction(tx)` and before `clearPendingCapture()`:

1. Save the transaction as-is (without `hasReceipt`)
2. Convert `capture.imageBase64` to `Blob`:
   ```ts
   const blob = await (await fetch(`data:${capture.mimeType};base64,${capture.imageBase64}`)).blob();
   ```
3. Call `saveReceiptImage(txId, { blob, mimeType: capture.mimeType })`
4. On success: call `updateTransaction(txId, { hasReceipt: true })`
5. On failure: swallow the error — the transaction is saved without `hasReceipt`, no thumbnail will appear

---

## History UI

### `TransactionCard` changes

New optional prop: `receiptImage?: ReceiptImage`

When present:
- Creates an object URL: `const src = URL.createObjectURL(receiptImage.blob)`
- Renders a 48×48 `<img>` below the main data row, wrapped in `<a href="/receipt/{transaction.id}">`
- Revokes the object URL in `onDestroy`

When absent (old records, or image save failed): no thumbnail rendered, no placeholder.

### History page changes

After loading `transactions`, collect all IDs where `hasReceipt === true`, call `bulkGetReceiptImages(ids)`, build a `Map<string, ReceiptImage>`, pass images into each `TransactionCard`.

---

## Receipt Page

**New route:** `src/routes/receipt/[id]/+page.svelte`

On mount:
1. Load transaction by `params.id` from `transactions` store
2. Load `ReceiptImage` via `getReceiptImage(params.id)`
3. If image found: create object URL, show full-width `<img>`, revoke on destroy
4. If no image: show "No receipt image available" message
5. Show transaction summary below image: merchant, amount + currency, category, date, status

Header: `← Back` button navigates to `/history`.

View-only — no editing on this page.

---

## Backup

### Envelope bumps to version 2

```ts
interface BackupEnvelope {
  version: 2;
  exportedAt: string;
  transactions: Transaction[];
  receiptImages: Record<string, { mimeType: string; data: string }>; // txId → base64
}
```

### Export (`exportBackup`)

For each transaction where `hasReceipt === true`:
1. Load Blob from `receipt-images` store
2. Convert to base64: `btoa(String.fromCharCode(...new Uint8Array(await blob.arrayBuffer())))`
3. Add to `receiptImages` map

Transactions without a receipt are exported normally — just absent from `receiptImages`.

### Import (`importBackup`)

For each entry in `receiptImages`:
1. Decode base64 → `Uint8Array` → `Blob`
2. Call `saveReceiptImage(txId, { blob, mimeType })`
3. Set `hasReceipt: true` on the matching transaction before inserting

Version 1 backups (no `receiptImages` field): treated as `{}` — transactions import unchanged, no receipts attached.

### Size limit

Remove the 10 MB import guard entirely. A year of daily receipts compressed could easily exceed 10 MB, and the user explicitly selects the file so the guard adds no safety value.

---

## File Checklist

| File | Change |
|------|--------|
| `src/lib/types/index.ts` | Add `ReceiptImage`; add `hasReceipt?: boolean` to `Transaction` |
| `src/lib/db/index.ts` | Version 5 upgrade — create `receipt-images` store |
| `src/lib/db/receipt-images.ts` | New module — CRUD for receipt images |
| `src/lib/components/TransactionCard.svelte` | Add `receiptImage` prop, thumbnail rendering |
| `src/routes/history/+page.svelte` | Load receipt images after transactions, pass to cards |
| `src/routes/receipt/[id]/+page.svelte` | New receipt page |
| `src/lib/services/backup.ts` | Envelope v2, export/import receipt images |
| `src/routes/review/+page.svelte` | Save receipt image on submit |
