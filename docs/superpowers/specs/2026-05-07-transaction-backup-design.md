# Transaction History Backup — Design Spec

## Context

Users store all captured transactions locally in IndexedDB. If they clear browser storage, switch
devices, or reinstall the PWA, all local history is lost. This feature adds export (backup to a
file) and import (restore from a backup file) to safeguard and move transaction history.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Backup scope | Transactions only | Categories/accounts/instruments are re-syncable from ZenMoney |
| File format | JSON5 + gzip | Clean serialization; native CompressionStream (no extra runtime dep) |
| Import strategy | Merge (skip duplicates by `id`) | Safe, non-destructive, idempotent |
| Export UX | Web Share API → `<a download>` fallback | Native share sheet on iOS; works on desktop |
| UI location | Settings page, "Backup & Restore" section | No new routes needed |

## Backup File Format

Extension: `.rzm.gz`  
Filename: `rzm-backup-YYYY-MM-DD.rzm.gz`

Envelope (JSON5, then gzip-compressed):

```json5
{
  version: 1,
  exportedAt: '2026-05-07T12:00:00Z',
  transactions: [
    {
      id: 'uuid-123',
      zenmoneyId: 'zm-456',
      accountId: 'acc-001',
      amount: 1250.50,
      currency: 'RUB',
      merchant: 'Пятёрочка',
      categoryId: 'cat-789',
      date: '2026-05-06',
      status: 'submitted',
      createdAt: 1746691200000,
    },
  ],
}
```

## Architecture

### `src/lib/services/backup.ts`

- `exportBackup(): Promise<{ blob: Blob; count: number }>` — reads all transactions, serializes
  to JSON5, compresses via `CompressionStream('gzip')`, returns Blob + count
- `importBackup(file: File): Promise<{ imported: number; skipped: number }>` — decompresses,
  parses JSON5, validates envelope, merges into IndexedDB skipping existing IDs

### `src/lib/db/transactions.ts` additions

- `bulkInsertTransactions(transactions: Transaction[]): Promise<void>` — single IDB `readwrite`
  transaction, `put()` each record (upsert semantics — callers must pre-filter duplicates)

### `src/routes/settings/+page.svelte`

New "Backup & Restore" section with Export button, Import button, hidden file input, status line.

## Error Handling

| Scenario | Message |
|---|---|
| Decompression fails | "Import failed: could not read file" |
| JSON5 parse error | "Import failed: invalid backup file" |
| Envelope not a plain object | "Import failed: invalid backup file" |
| `version !== 1` | "Import failed: unsupported backup version" |
| `transactions` not an array | "Import failed: invalid backup file" |
| Share cancelled (AbortError) | No error shown |
| Share unavailable | Falls back to `<a download>` silently |
