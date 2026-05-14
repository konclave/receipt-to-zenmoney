# DB Cleanup Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add storage stats display and year-scoped delete with pre-deletion backup offer to the Settings page.

**Architecture:** Data layer (delete + stats) → backup service extension → two Svelte modal components → Settings page wiring. All new DB functions follow the existing IDB pattern in `src/lib/db/`. Components use Svelte 5 runes (`$state`, `$props`, `$derived`).

**Tech Stack:** SvelteKit, Svelte 5 runes, idb, JSON5, CompressionStream/DecompressionStream, vitest/jsdom

---

## File Map

| Status | File | Purpose |
|--------|------|---------|
| Modify | `src/lib/db/transactions.ts` | Add `deleteTransactionsByPeriod()` |
| Modify | `src/lib/db/transactions.test.ts` | Tests for above |
| Modify | `src/lib/db/receipt-images.ts` | Add `bulkDeleteReceiptImages()` |
| Modify | `src/lib/db/receipt-images.test.ts` | Tests for above |
| Create | `src/lib/services/storage-stats.ts` | `YearStats`, `StorageStats`, `formatBytes`, `getStorageStats()` |
| Create | `src/lib/services/storage-stats.test.ts` | Tests for above |
| Modify | `src/lib/services/backup.ts` | Add `exportBackupForPeriod()` |
| Modify | `src/lib/services/backup.test.ts` | Tests for above |
| Create | `src/lib/components/CleanupModal.svelte` | Year-list modal |
| Create | `src/lib/components/CleanupConfirmModal.svelte` | Confirm + backup-offer modal |
| Modify | `src/routes/settings/+page.svelte` | Storage stats display + modal wiring |

---

### Task 1: `deleteTransactionsByPeriod`

**Files:**
- Modify: `src/lib/db/transactions.ts`
- Modify: `src/lib/db/transactions.test.ts`

- [ ] **Step 1: Add tests**

Append to `src/lib/db/transactions.test.ts` (after the existing imports, add `deleteTransactionsByPeriod` to the import line):

```ts
import {
  getTransactions,
  getTransaction,
  saveTransaction,
  updateTransaction,
  bulkInsertTransactions,
  deleteTransactionsByPeriod,
} from './transactions';
```

Then append the following tests at the end of the file:

```ts
it('deleteTransactionsByPeriod deletes only matching year and returns ids', async () => {
  const tx2023a = makeTx({ id: 'del-2023-a', date: '2023-06-01' });
  const tx2023b = makeTx({ id: 'del-2023-b', date: '2023-11-15' });
  const tx2024 = makeTx({ id: 'keep-2024', date: '2024-03-01' });
  await bulkInsertTransactions([tx2023a, tx2023b, tx2024]);
  const deleted = await deleteTransactionsByPeriod(2023);
  expect(deleted.sort()).toEqual(['del-2023-a', 'del-2023-b'].sort());
  const remaining = await getTransactions();
  expect(remaining).toHaveLength(1);
  expect(remaining[0].id).toBe('keep-2024');
});

it("deleteTransactionsByPeriod('all') removes everything and returns all ids", async () => {
  const tx1 = makeTx({ id: 'all-1', date: '2023-01-01' });
  const tx2 = makeTx({ id: 'all-2', date: '2024-01-01' });
  await bulkInsertTransactions([tx1, tx2]);
  const deleted = await deleteTransactionsByPeriod('all');
  expect(deleted.sort()).toEqual(['all-1', 'all-2'].sort());
  expect(await getTransactions()).toHaveLength(0);
});

it('deleteTransactionsByPeriod returns empty array when no matching transactions', async () => {
  await saveTransaction(makeTx({ date: '2024-05-01' }));
  const deleted = await deleteTransactionsByPeriod(2020);
  expect(deleted).toHaveLength(0);
  expect(await getTransactions()).toHaveLength(1);
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm exec vitest run src/lib/db/transactions.test.ts
```

Expected: tests fail with `deleteTransactionsByPeriod is not a function` or similar.

- [ ] **Step 3: Implement the function**

Append to `src/lib/db/transactions.ts`:

```ts
export async function deleteTransactionsByPeriod(year: number | 'all'): Promise<string[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('transactions', 'by-date');
  const toDelete = year === 'all' ? all : all.filter((t) => t.date.startsWith(String(year)));
  const ids = toDelete.map((t) => t.id);
  if (ids.length === 0) return [];
  const tx = db.transaction('transactions', 'readwrite');
  await Promise.all(ids.map((id) => tx.store.delete(id)));
  await tx.done;
  return ids;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm exec vitest run src/lib/db/transactions.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/transactions.ts src/lib/db/transactions.test.ts
git commit -m "feat: add deleteTransactionsByPeriod to transactions db"
```

---

### Task 2: `bulkDeleteReceiptImages`

**Files:**
- Modify: `src/lib/db/receipt-images.ts`
- Modify: `src/lib/db/receipt-images.test.ts`

- [ ] **Step 1: Add tests**

Append to the import line in `src/lib/db/receipt-images.test.ts`:

```ts
import {
  saveReceiptImage,
  getReceiptImage,
  bulkGetReceiptImages,
  deleteReceiptImage,
  bulkDeleteReceiptImages,
} from './receipt-images';
```

Then append these tests at the end of the file:

```ts
it('bulkDeleteReceiptImages removes all specified ids', async () => {
  await saveReceiptImage('tx-1', makeImage());
  await saveReceiptImage('tx-2', makeImage());
  await saveReceiptImage('tx-3', makeImage());
  await bulkDeleteReceiptImages(['tx-1', 'tx-3']);
  expect(await getReceiptImage('tx-1')).toBeUndefined();
  expect(await getReceiptImage('tx-2')).toBeDefined();
  expect(await getReceiptImage('tx-3')).toBeUndefined();
});

it('bulkDeleteReceiptImages is a no-op for empty array', async () => {
  await saveReceiptImage('keep', makeImage());
  await bulkDeleteReceiptImages([]);
  expect(await getReceiptImage('keep')).toBeDefined();
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm exec vitest run src/lib/db/receipt-images.test.ts
```

Expected: fail with import error.

- [ ] **Step 3: Implement the function**

Append to `src/lib/db/receipt-images.ts`:

```ts
export async function bulkDeleteReceiptImages(txIds: string[]): Promise<void> {
  if (txIds.length === 0) return;
  const db = await getDb();
  const tx = db.transaction('receipt-images', 'readwrite');
  await Promise.all(txIds.map((id) => tx.store.delete(id)));
  await tx.done;
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm exec vitest run src/lib/db/receipt-images.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/receipt-images.ts src/lib/db/receipt-images.test.ts
git commit -m "feat: add bulkDeleteReceiptImages to receipt-images db"
```

---

### Task 3: `getStorageStats` service

**Files:**
- Create: `src/lib/services/storage-stats.ts`
- Create: `src/lib/services/storage-stats.test.ts`

- [ ] **Step 1: Create the test file**

Create `src/lib/services/storage-stats.test.ts` with this content:

```ts
import { it, expect, beforeEach } from 'vitest';
import { getStorageStats } from './storage-stats';
import { saveTransaction, bulkInsertTransactions } from '$lib/db/transactions';
import { saveReceiptImage } from '$lib/db/receipt-images';
import { _resetDb } from '$lib/db/index';
import type { Transaction } from '$lib/types';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: crypto.randomUUID(),
    zenmoneyId: null,
    accountId: 'acc-1',
    amount: 100,
    currency: 'RUB',
    merchant: 'Test',
    categoryId: 'c1',
    date: '2026-05-01',
    status: 'pending',
    createdAt: Date.now(),
    ...overrides,
  };
}

beforeEach(async () => {
  _resetDb();
  await new Promise<void>((resolve) => {
    const req = globalThis.indexedDB.deleteDatabase('rzm');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
});

it('returns empty stats for empty DB', async () => {
  const result = await getStorageStats();
  expect(result.totalBytes).toBe(0);
  expect(result.byYear).toHaveLength(0);
});

it('groups transactions by year in descending order', async () => {
  await bulkInsertTransactions([
    makeTx({ id: 'a', date: '2023-01-01' }),
    makeTx({ id: 'b', date: '2023-06-15' }),
    makeTx({ id: 'c', date: '2024-03-01' }),
  ]);
  const result = await getStorageStats();
  expect(result.byYear).toHaveLength(2);
  expect(result.byYear[0].year).toBe(2024);
  expect(result.byYear[1].year).toBe(2023);
  expect(result.byYear[1].txCount).toBe(2);
});

it('includes receipt image blob sizes in byte count', async () => {
  const tx = makeTx({ id: 'img-tx', date: '2025-01-01', hasReceipt: true });
  await saveTransaction(tx);
  const imageData = new Uint8Array(1000);
  await saveReceiptImage('img-tx', {
    mimeType: 'image/jpeg',
    blob: new Blob([imageData], { type: 'image/jpeg' }),
  });
  const result = await getStorageStats();
  const year2025 = result.byYear.find((y) => y.year === 2025)!;
  expect(year2025.bytes).toBe(1000 + 500); // blob size + 500-byte overhead per tx
});

it('totalBytes equals sum of all byYear entries', async () => {
  await bulkInsertTransactions([
    makeTx({ id: 'x1', date: '2023-01-01' }),
    makeTx({ id: 'x2', date: '2024-01-01' }),
  ]);
  const result = await getStorageStats();
  expect(result.totalBytes).toBe(result.byYear.reduce((s, y) => s + y.bytes, 0));
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm exec vitest run src/lib/services/storage-stats.test.ts
```

Expected: fail — module not found.

- [ ] **Step 3: Create the implementation**

Create `src/lib/services/storage-stats.ts`:

```ts
import { getTransactions } from '$lib/db/transactions';
import { bulkGetReceiptImages } from '$lib/db/receipt-images';

export interface YearStats {
  year: number;
  txCount: number;
  bytes: number;
}

export interface StorageStats {
  totalBytes: number;
  byYear: YearStats[]; // descending by year
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function getStorageStats(): Promise<StorageStats> {
  const transactions = await getTransactions();

  const grouped = new Map<number, string[]>();
  for (const tx of transactions) {
    const year = parseInt(tx.date.slice(0, 4), 10);
    if (!grouped.has(year)) grouped.set(year, []);
    grouped.get(year)!.push(tx.id);
  }

  const years = Array.from(grouped.keys()).sort((a, b) => b - a);

  const byYear: YearStats[] = await Promise.all(
    years.map(async (year) => {
      const txIds = grouped.get(year)!;
      const images = await bulkGetReceiptImages(txIds);
      let bytes = txIds.length * 500;
      for (const img of images.values()) {
        bytes += img.blob.size;
      }
      return { year, txCount: txIds.length, bytes };
    }),
  );

  const totalBytes = byYear.reduce((sum, s) => sum + s.bytes, 0);
  return { totalBytes, byYear };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm exec vitest run src/lib/services/storage-stats.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/storage-stats.ts src/lib/services/storage-stats.test.ts
git commit -m "feat: add storage-stats service with getStorageStats and formatBytes"
```

---

### Task 4: `exportBackupForPeriod`

**Files:**
- Modify: `src/lib/services/backup.ts`
- Modify: `src/lib/services/backup.test.ts`

- [ ] **Step 1: Add tests**

Add `exportBackupForPeriod` to the import at the top of `src/lib/services/backup.test.ts`:

```ts
import { exportBackup, importBackup, exportBackupForPeriod } from './backup';
```

Append a new `describe` block at the end of `src/lib/services/backup.test.ts`:

```ts
describe('exportBackupForPeriod', () => {
  it('filters to only the specified year', async () => {
    const tx2023 = makeTx({ id: 'p2023', date: '2023-06-01' });
    const tx2024 = makeTx({ id: 'p2024', date: '2024-06-01' });
    await saveTransaction(tx2023);
    await saveTransaction(tx2024);
    const { blob, count } = await exportBackupForPeriod(2023);
    expect(count).toBe(1);
    const text = await new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(await blob.arrayBuffer()));
          controller.close();
        },
      }).pipeThrough(new DecompressionStream('gzip')),
    ).text();
    const envelope = JSON5.parse(text);
    expect(envelope.transactions).toHaveLength(1);
    expect(envelope.transactions[0].id).toBe('p2023');
  });

  it("'all' exports every transaction", async () => {
    await saveTransaction(makeTx({ id: 'a-all', date: '2023-01-01' }));
    await saveTransaction(makeTx({ id: 'b-all', date: '2024-01-01' }));
    const { count } = await exportBackupForPeriod('all');
    expect(count).toBe(2);
  });

  it('includes receipt images only for filtered transactions', async () => {
    const tx2023 = makeTx({ id: 'img2023', date: '2023-03-01', hasReceipt: true });
    const tx2024 = makeTx({ id: 'img2024', date: '2024-03-01', hasReceipt: true });
    await saveTransaction(tx2023);
    await saveTransaction(tx2024);
    await saveReceiptImage('img2023', { mimeType: 'image/jpeg', blob: new Blob(['a']) });
    await saveReceiptImage('img2024', { mimeType: 'image/png', blob: new Blob(['b']) });
    const { blob } = await exportBackupForPeriod(2023);
    const text = await new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(await blob.arrayBuffer()));
          controller.close();
        },
      }).pipeThrough(new DecompressionStream('gzip')),
    ).text();
    const envelope = JSON5.parse(text);
    expect(Object.keys(envelope.receiptImages)).toEqual(['img2023']);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm exec vitest run src/lib/services/backup.test.ts
```

Expected: fail with import error on `exportBackupForPeriod`.

- [ ] **Step 3: Implement the function**

Append to `src/lib/services/backup.ts`:

```ts
export async function exportBackupForPeriod(year: number | 'all'): Promise<{ blob: Blob; count: number }> {
  const all = await getTransactions();
  const transactions = year === 'all' ? all : all.filter((t) => t.date.startsWith(String(year)));

  const receiptTxIds = transactions.filter((t) => t.hasReceipt).map((t) => t.id);
  const receiptMap = await bulkGetReceiptImages(receiptTxIds);
  const receiptImages: Record<string, { mimeType: string; data: string }> = {};
  await Promise.all(
    receiptTxIds.map(async (id) => {
      const img = receiptMap.get(id);
      if (img) receiptImages[id] = { mimeType: img.mimeType, data: await blobToBase64(img.blob) };
    }),
  );

  const envelope: BackupEnvelope = {
    version: 2,
    exportedAt: new Date().toISOString(),
    transactions,
    receiptImages,
  };

  const compressed = await new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON5.stringify(envelope, null, 2)));
        controller.close();
      },
    }).pipeThrough(new CompressionStream('gzip')),
  ).arrayBuffer();

  return { blob: new Blob([compressed], { type: 'application/gzip' }), count: transactions.length };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm exec vitest run src/lib/services/backup.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/backup.ts src/lib/services/backup.test.ts
git commit -m "feat: add exportBackupForPeriod to backup service"
```

---

### Task 5: `CleanupModal.svelte`

**Files:**
- Create: `src/lib/components/CleanupModal.svelte`

No unit tests — consistent with existing codebase (no Svelte component tests).

- [ ] **Step 1: Create the component**

Create `src/lib/components/CleanupModal.svelte`:

```svelte
<script lang="ts">
  import type { StorageStats } from '$lib/services/storage-stats'
  import { formatBytes } from '$lib/services/storage-stats'

  let { stats, onselect, onclose }: {
    stats: StorageStats
    onselect: (period: number | 'all') => void
    onclose: () => void
  } = $props()

  const totalTxCount = $derived(stats.byYear.reduce((s, y) => s + y.txCount, 0))
</script>

<div class="overlay" role="presentation" onclick={onclose}>
  <div
    class="modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="cleanup-title"
    onclick={(e) => e.stopPropagation()}
  >
    <div class="modal-header">
      <h2 id="cleanup-title">Clean Up Data</h2>
      <p class="subtitle">Select a period to delete</p>
    </div>
    <div class="modal-body">
      {#each stats.byYear as yearStat}
        <div class="year-row">
          <div class="year-info">
            <span class="year">{yearStat.year}</span>
            <span class="meta">{yearStat.txCount} transactions · {formatBytes(yearStat.bytes)}</span>
          </div>
          <button class="btn-delete" onclick={() => onselect(yearStat.year)}>Delete</button>
        </div>
      {/each}
      <div class="year-row all-row">
        <div class="year-info">
          <span class="year-all">All years</span>
          <span class="meta">{totalTxCount} transactions · {formatBytes(stats.totalBytes)}</span>
        </div>
        <button class="btn-delete-all" onclick={() => onselect('all')}>Delete all</button>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-cancel" onclick={onclose}>Cancel</button>
    </div>
  </div>
</div>

<style>
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: flex-end; z-index: 100; }
  .modal { background: var(--color-surface); border-radius: 16px 16px 0 0; width: 100%; max-height: 80vh; overflow-y: auto; }
  .modal-header { padding: 20px 16px 12px; border-bottom: 1px solid var(--color-border); }
  h2 { font-size: 18px; font-weight: 700; margin: 0; }
  .subtitle { font-size: 13px; color: var(--color-text-muted); margin: 4px 0 0; }
  .modal-body { display: flex; flex-direction: column; }
  .year-row { display: flex; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--color-border); gap: 12px; }
  .all-row { background: var(--color-surface-2); }
  .year-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .year { font-weight: 600; font-size: 15px; }
  .year-all { font-weight: 600; font-size: 15px; color: var(--color-error, #d93025); }
  .meta { font-size: 12px; color: var(--color-text-muted); }
  .btn-delete { background: color-mix(in srgb, var(--color-error, #d93025) 15%, transparent); color: var(--color-error, #d93025); border: none; border-radius: var(--radius-sm); padding: 6px 12px; font-size: 13px; font-weight: 500; cursor: pointer; }
  .btn-delete-all { background: var(--color-error, #d93025); color: #fff; border: none; border-radius: var(--radius-sm); padding: 6px 12px; font-size: 13px; font-weight: 500; cursor: pointer; }
  .modal-footer { padding: 12px 16px; }
  .btn-cancel { width: 100%; background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 12px; font-weight: 500; font-size: 15px; cursor: pointer; }
</style>
```

- [ ] **Step 2: Run the full test suite to confirm nothing broken**

```bash
pnpm test
```

Expected: all existing tests pass (no new tests for this component).

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/CleanupModal.svelte
git commit -m "feat: add CleanupModal component"
```

---

### Task 6: `CleanupConfirmModal.svelte`

**Files:**
- Create: `src/lib/components/CleanupConfirmModal.svelte`

- [ ] **Step 1: Create the component**

Create `src/lib/components/CleanupConfirmModal.svelte`:

```svelte
<script lang="ts">
  import { formatBytes } from '$lib/services/storage-stats'

  let { period, txCount, bytes, onconfirm, onclose }: {
    period: number | 'all'
    txCount: number
    bytes: number
    onconfirm: (opts: { withBackup: boolean }) => void
    onclose: () => void
  } = $props()

  let confirmingDelete = $state(false)

  const title = $derived(period === 'all' ? 'Delete all data?' : `Delete ${period} data?`)
  const backupFilename = $derived(
    period === 'all'
      ? `rzm-backup-all-${new Date().toISOString().slice(0, 10)}.rzm.gz`
      : `rzm-backup-${period}.rzm.gz`,
  )
</script>

<div class="overlay" role="presentation" onclick={onclose}>
  <div
    class="modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-title"
    onclick={(e) => e.stopPropagation()}
  >
    <div class="modal-header">
      <h2 id="confirm-title">{title}</h2>
      <p class="subtitle">{txCount} transactions · {formatBytes(bytes)}</p>
    </div>
    <div class="modal-body">
      {#if !confirmingDelete}
        <p class="description">Download a backup of this period before deleting? The file can be reimported later.</p>
        <button class="btn-primary" onclick={() => onconfirm({ withBackup: true })}>
          <span>Download backup & delete</span>
          <span class="btn-hint">Saves {backupFilename} first</span>
        </button>
        <button class="btn-delete-secondary" onclick={() => { confirmingDelete = true }}>
          Delete without backup
        </button>
      {:else}
        <p class="description warning">Are you sure? This cannot be undone.</p>
        <button class="btn-delete-confirm" onclick={() => onconfirm({ withBackup: false })}>
          Yes, delete permanently
        </button>
        <button class="btn-back" onclick={() => { confirmingDelete = false }}>Go back</button>
      {/if}
      <button class="btn-cancel" onclick={onclose}>Cancel</button>
    </div>
  </div>
</div>

<style>
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: flex-end; z-index: 100; }
  .modal { background: var(--color-surface); border-radius: 16px 16px 0 0; width: 100%; }
  .modal-header { padding: 20px 16px 12px; border-bottom: 1px solid var(--color-border); }
  h2 { font-size: 18px; font-weight: 700; margin: 0; }
  .subtitle { font-size: 13px; color: var(--color-text-muted); margin: 4px 0 0; }
  .modal-body { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
  .description { font-size: 14px; color: var(--color-text-muted); line-height: 1.5; margin: 0; }
  .description.warning { color: var(--color-error, #d93025); font-weight: 500; }
  .btn-primary { background: var(--color-primary); color: #fff; border: none; border-radius: var(--radius-sm); padding: 14px 16px; font-size: 15px; font-weight: 600; cursor: pointer; display: flex; flex-direction: column; gap: 3px; width: 100%; text-align: left; }
  .btn-hint { font-size: 11px; font-weight: 400; opacity: 0.8; }
  .btn-delete-secondary { background: color-mix(in srgb, var(--color-error, #d93025) 12%, transparent); color: var(--color-error, #d93025); border: 1px solid color-mix(in srgb, var(--color-error, #d93025) 30%, transparent); border-radius: var(--radius-sm); padding: 14px; font-size: 15px; font-weight: 500; cursor: pointer; }
  .btn-delete-confirm { background: var(--color-error, #d93025); color: #fff; border: none; border-radius: var(--radius-sm); padding: 14px; font-size: 15px; font-weight: 600; cursor: pointer; }
  .btn-back { background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 12px; font-size: 15px; font-weight: 500; cursor: pointer; }
  .btn-cancel { background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 12px; font-size: 15px; font-weight: 500; cursor: pointer; }
</style>
```

- [ ] **Step 2: Run the full test suite**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/CleanupConfirmModal.svelte
git commit -m "feat: add CleanupConfirmModal component"
```

---

### Task 7: Settings page integration

**Files:**
- Modify: `src/routes/settings/+page.svelte`

- [ ] **Step 1: Add imports to the `<script>` block**

In `src/routes/settings/+page.svelte`, add these imports to the existing import block at the top of `<script>`:

```ts
import { getStorageStats, formatBytes } from '$lib/services/storage-stats'
import type { StorageStats } from '$lib/services/storage-stats'
import { deleteTransactionsByPeriod } from '$lib/db/transactions'
import { bulkDeleteReceiptImages } from '$lib/db/receipt-images'
import { exportBackupForPeriod } from '$lib/services/backup'
import CleanupModal from '$lib/components/CleanupModal.svelte'
import CleanupConfirmModal from '$lib/components/CleanupConfirmModal.svelte'
```

- [ ] **Step 2: Add new state variables**

Add the following after the existing `let fileInput` state declaration in the `<script>` block:

```ts
let storageStats = $state<StorageStats | null>(null)
let cleanupModalOpen = $state(false)
let cleanupConfirmPeriod = $state<{ period: number | 'all'; txCount: number; bytes: number } | null>(null)
let cleaning = $state(false)
```

- [ ] **Step 3: Load storage stats on mount**

Inside the `onMount` callback, add a non-blocking call **after** the existing `Promise.all` line:

```ts
// Non-blocking — resolves after main settings are loaded
getStorageStats().then((s) => { storageStats = s })
```

The `onMount` should end like this after the change:

```ts
  accounts = savedAccounts
  if (cats.length > 0) lastSyncDate = new Date(cats[0].syncedAt).toLocaleDateString()

  getStorageStats().then((s) => { storageStats = s })

  // Fetch OpenRouter vision-capable models...
```

- [ ] **Step 4: Add handler functions**

Append these two handlers after the existing `handleImport` function (before the closing `</script>` tag):

```ts
  function handleCleanupSelect(period: number | 'all') {
    cleanupModalOpen = false
    if (!storageStats) return
    if (period === 'all') {
      const totalTxCount = storageStats.byYear.reduce((s, y) => s + y.txCount, 0)
      cleanupConfirmPeriod = { period: 'all', txCount: totalTxCount, bytes: storageStats.totalBytes }
    } else {
      const yearStat = storageStats.byYear.find((y) => y.year === period)
      if (!yearStat) return
      cleanupConfirmPeriod = { period, txCount: yearStat.txCount, bytes: yearStat.bytes }
    }
  }

  async function handleCleanupConfirm({ withBackup }: { withBackup: boolean }) {
    const target = cleanupConfirmPeriod
    if (!target) return
    cleaning = true
    backupError = null
    try {
      if (withBackup) {
        const { blob } = await exportBackupForPeriod(target.period)
        const date = new Date().toISOString().slice(0, 10)
        const filename =
          target.period === 'all'
            ? `rzm-backup-all-${date}.rzm.gz`
            : `rzm-backup-${target.period}.rzm.gz`
        const shareFile = new File([blob], filename, { type: 'application/gzip' })
        let shared = false
        if (navigator.canShare?.({ files: [shareFile] })) {
          try {
            await navigator.share({ files: [shareFile], title: 'Zenmoney Backup' })
            shared = true
          } catch (shareErr) {
            if (shareErr instanceof Error && shareErr.name === 'AbortError') return
          }
        }
        if (!shared) {
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = filename
          a.click()
          URL.revokeObjectURL(url)
        }
      }
      const deletedIds = await deleteTransactionsByPeriod(target.period)
      await bulkDeleteReceiptImages(deletedIds)
      storageStats = await getStorageStats()
      cleanupConfirmPeriod = null
      backupStatus = `Deleted ${target.txCount} transactions · freed ~${formatBytes(target.bytes)}`
      setTimeout(() => (backupStatus = null), 4000)
    } catch (e) {
      backupError = e instanceof Error ? e.message : String(e)
    } finally {
      cleaning = false
    }
  }
```

- [ ] **Step 5: Add storage stats UI to the Backup & Restore section**

In the HTML, find the `<input aria-hidden="true" ...>` tag (the hidden file input inside the Backup & Restore `<section>`). Add the storage stats block **after** that `<input>` and before `</section>`:

```svelte
    <div class="storage-stats">
      <span class="hint">Storage used</span>
      <span class="storage-size">{storageStats ? formatBytes(storageStats.totalBytes) : '—'}</span>
      {#if storageStats}
        <span class="hint">
          {storageStats.byYear.length} {storageStats.byYear.length === 1 ? 'year' : 'years'} · {storageStats.byYear.reduce((s, y) => s + y.txCount, 0)} transactions
        </span>
      {/if}
      <button
        class="btn-danger"
        onclick={() => { cleanupModalOpen = true }}
        disabled={!storageStats || storageStats.byYear.length === 0 || cleaning}
      >
        {cleaning ? 'Cleaning…' : 'Clean Up…'}
      </button>
    </div>
```

- [ ] **Step 6: Add the two modals to the bottom of the page**

Find the closing `</div>` of the `<div class="page">` element (the last element before `</div>` before `<style>`). Add the modals just before that closing `</div>`:

```svelte
  {#if cleanupModalOpen && storageStats}
    <CleanupModal
      stats={storageStats}
      onselect={handleCleanupSelect}
      onclose={() => { cleanupModalOpen = false }}
    />
  {/if}

  {#if cleanupConfirmPeriod}
    <CleanupConfirmModal
      period={cleanupConfirmPeriod.period}
      txCount={cleanupConfirmPeriod.txCount}
      bytes={cleanupConfirmPeriod.bytes}
      onconfirm={handleCleanupConfirm}
      onclose={() => { cleanupConfirmPeriod = null }}
    />
  {/if}
```

- [ ] **Step 7: Add CSS for the storage stats block**

Append to the `<style>` block in `src/routes/settings/+page.svelte`:

```css
  .storage-stats { display: flex; flex-direction: column; gap: 4px; padding-top: 4px; }
  .storage-size { font-size: 22px; font-weight: 700; }
  .btn-danger { background: color-mix(in srgb, var(--color-error, #d93025) 12%, transparent); color: var(--color-error, #d93025); border: 1px solid color-mix(in srgb, var(--color-error, #d93025) 30%, transparent); border-radius: var(--radius-sm); padding: 12px; font-weight: 500; font-size: 15px; cursor: pointer; }
  .btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 8: Run the full test suite and type check**

```bash
pnpm test && pnpm check
```

Expected: all tests pass, no type errors.

- [ ] **Step 9: Commit**

```bash
git add src/routes/settings/+page.svelte
git commit -m "feat: add storage stats and cleanup flow to settings page"
```
