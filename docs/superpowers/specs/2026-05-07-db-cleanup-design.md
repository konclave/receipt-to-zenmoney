# Database Cleanup Feature — Design

**Date:** 2026-05-07

## Overview

Allow users to see how much storage the app consumes and selectively delete transactions (with their receipt images) for a specific year or all years. Before deletion the app offers to download a scoped backup. After deletion the storage stats refresh in place.

---

## UI Entry Point

The existing **Backup & Restore** section in `src/routes/settings/+page.svelte` gains a storage subsection below the export/import buttons:

```
Storage used
~157 MB  ·  3 years · 248 transactions
[Clean Up…]         ← destructive-styled button
```

`getStorageStats()` is called on mount and the result drives this display. While loading, the size shows as "—" and the "Clean Up…" button is disabled.

---

## Modal Flow (Approach B — two modals)

### Modal 1 — Year list (`CleanupModal.svelte`)

Props: `stats: { byYear: { year, txCount, bytes }[] }`
Events: `select(year: number | 'all')`, `close`

Renders one row per year (descending), each showing:
- Year
- Transaction count
- Human-readable size (e.g. "89 MB")
- Red "Delete" button

A final "Delete all" row spans all years combined. A "Cancel" button closes without action.

### Modal 2 — Confirm (`CleanupConfirmModal.svelte`)

Props: `period: number | 'all'`, `txCount: number`, `bytes: number`
Events: `confirm({ withBackup: boolean })`, `close`

Title: "Delete [year] data?" or "Delete all data?"
Subtitle: tx count + size.

Two actions:
1. **Download backup & delete** (primary, blue) — triggers `exportBackupForPeriod()` + download/share, then deletes. If the Share sheet is dismissed (AbortError), deletion does NOT proceed — mirrors existing export behaviour.
2. **Delete without backup** (secondary, red-tinted) — shows an inline "Are you sure? This cannot be undone." confirmation before proceeding.

"Cancel" closes without action.

---

## Data Layer

### `src/lib/db/transactions.ts`

```ts
deleteTransactionsByPeriod(year: number | 'all'): Promise<string[]>
```
Deletes all transactions where `date` starts with `String(year)`, or all transactions when `year === 'all'`. Returns the deleted transaction IDs (used to cascade-delete receipt images).

### `src/lib/db/receipt-images.ts`

```ts
bulkDeleteReceiptImages(txIds: string[]): Promise<void>
```
Opens a single `readwrite` IDB transaction and deletes all matching receipt image entries.

### `src/lib/services/storage-stats.ts` (new file)

```ts
interface YearStats {
  year: number;
  txCount: number;
  bytes: number;
}

interface StorageStats {
  totalBytes: number;
  byYear: YearStats[];  // descending by year
}

getStorageStats(): Promise<StorageStats>
```

Implementation:
1. Call `getTransactions()` to get all transactions.
2. Group by year (from `date.slice(0, 4)`).
3. For each group, call `bulkGetReceiptImages(txIds)` and sum `blob.size` across the returned images.
4. Add a fixed 500-byte overhead per transaction to account for IDB record metadata.
5. `totalBytes` = sum of all `YearStats.bytes`.

---

## Backup Service

### `src/lib/services/backup.ts`

```ts
exportBackupForPeriod(year: number | 'all'): Promise<{ blob: Blob; count: number }>
```

Filters transactions to the target year (or all), then follows the exact same gzip+JSON5 path as the existing `exportBackup()`. Receipt images are included for the filtered transaction set only.

Filename convention:
- Year: `rzm-backup-<year>.rzm.gz`
- All: `rzm-backup-all-<date>.rzm.gz`

The existing `exportBackup()` is unchanged.

---

## Settings Page Changes (`src/routes/settings/+page.svelte`)

New state:
```ts
let storageStats = $state<StorageStats | null>(null)
let cleanupModalOpen = $state(false)
let cleanupConfirmPeriod = $state<{ period: number | 'all'; txCount: number; bytes: number } | null>(null)
```

On mount: calls `getStorageStats()` and stores result (non-blocking — stats load after other settings).

Handler `handleCleanupSelect(period)`:
1. Closes year-list modal.
2. Looks up txCount + bytes for the selected period from `storageStats`.
3. Opens confirm modal with that data.

Handler `handleCleanupConfirm({ withBackup })`:
1. If `withBackup`: calls `exportBackupForPeriod(period)`, triggers download/share via the existing Share API + `<a download>` fallback.
2. Calls `deleteTransactionsByPeriod(period)` → gets deleted IDs → calls `bulkDeleteReceiptImages(deletedIds)`.
3. Calls `getStorageStats()` and updates `storageStats`.
4. Closes confirm modal, shows success toast ("Deleted X transactions · freed ~Y MB").

---

## Testing

| File | What's tested |
|------|--------------|
| `src/lib/db/transactions.test.ts` (extend) | `deleteTransactionsByPeriod(year)` deletes only that year and returns correct IDs; `deleteTransactionsByPeriod('all')` clears everything |
| `src/lib/db/receipt-images.test.ts` (extend) | `bulkDeleteReceiptImages()` removes all specified IDs; no-op on empty array |
| `src/lib/services/storage-stats.test.ts` (new) | Correct grouping by year; correct byte summation; empty-DB returns `{ totalBytes: 0, byYear: [] }` |
| `src/lib/services/backup.test.ts` (extend) | `exportBackupForPeriod(year)` contains only that year's transactions and images; `exportBackupForPeriod('all')` matches `exportBackup()` output |

No Svelte component tests — consistent with the existing codebase.

---

## Out of Scope

- Deleting categories, accounts, instruments, or settings — these are small reference data, not user-generated content.
- Storage breakdown by month — years are sufficient granularity.
- Progress indicator during deletion — the operation is fast enough on mobile for a spinner to suffice.
