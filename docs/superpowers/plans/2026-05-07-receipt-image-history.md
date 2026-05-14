# Receipt Image History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist receipt photos alongside transactions so users can view thumbnails in history, open full images on a dedicated page, and include images in backup exports.

**Architecture:** Images are stored as native `Blob` objects in a separate `receipt-images` IndexedDB store (DB v5), keyed by transaction ID. `Transaction` gets a `hasReceipt?: boolean` flag so the history list can skip loading Blobs during scroll. Backup envelope bumps to v2 with a `receiptImages` map of base64-encoded images.

**Tech Stack:** SvelteKit, Svelte 5, `idb`, `fake-indexeddb` (tests), `jsdom` (vitest), JSON5, gzip (CompressionStream)

---

## File Map

| File | Action |
|------|--------|
| `src/lib/types/index.ts` | Add `ReceiptImage` type; add `hasReceipt?: boolean` to `Transaction` |
| `src/lib/db/index.ts` | Add `receipt-images` to `AppDB`; bump DB to v5 |
| `src/lib/db/receipt-images.ts` | **New** — CRUD for receipt Blobs |
| `src/lib/db/receipt-images.test.ts` | **New** — tests for above |
| `src/lib/db/transactions.ts` | Add `getTransaction(id)` |
| `src/lib/db/transactions.test.ts` | Add test for `getTransaction` |
| `src/lib/services/backup.ts` | Envelope v2, export/import receipt images, remove size limit |
| `src/lib/services/backup.test.ts` | Update for v2 envelope, add receipt round-trip tests, remove oversized test |
| `src/lib/components/TransactionCard.svelte` | Add `receiptImage` prop + 48×48 thumbnail |
| `src/routes/history/+page.svelte` | Load receipt images after transactions, pass to cards |
| `src/routes/receipt/[id]/+page.svelte` | **New** — full receipt view page |

---

## Task 1: Types + DB Schema

**Files:**
- Modify: `src/lib/types/index.ts`
- Modify: `src/lib/db/index.ts`

- [ ] **Step 1: Add `ReceiptImage` type and `hasReceipt` to `Transaction`**

In `src/lib/types/index.ts`, add after the `Transaction` interface closing brace:

```ts
export interface ReceiptImage {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  blob: Blob;
}
```

And add `hasReceipt?: boolean;` to the `Transaction` interface:

```ts
export interface Transaction {
  id: string;
  zenmoneyId: string | null;
  accountId?: string;
  amount: number;
  currency: string;
  merchant: string;
  categoryId: string;
  date: string;
  status: 'pending' | 'submitted' | 'failed';
  createdAt: number;
  hasReceipt?: boolean;
}
```

- [ ] **Step 2: Add `receipt-images` store to `AppDB` and bump DB version to 5**

In `src/lib/db/index.ts`, update `AppDB` to add the new store:

```ts
interface AppDB {
  settings: { key: string; value: string | number };
  categories: { key: string; value: Category };
  accounts: { key: string; value: ZenmoneyAccount };
  instruments: { key: number; value: ZenmoneyInstrument };
  transactions: {
    key: string;
    value: Transaction;
    indexes: { 'by-date': string };
  };
  'pending-capture': { key: string; value: PendingCapture };
  'receipt-images': { key: string; value: { blob: Blob; mimeType: string } };
}
```

Update the `openDB` call: change version from `4` to `5` and add the v5 upgrade block:

```ts
_db = await openDB<AppDB>('rzm', 5, {
  upgrade(db, oldVersion) {
    if (oldVersion < 1) {
      db.createObjectStore('settings');
      db.createObjectStore('categories', { keyPath: 'id' });
      const txStore = db.createObjectStore('transactions', { keyPath: 'id' });
      txStore.createIndex('by-date', 'date');
    }
    if (oldVersion < 2) {
      db.createObjectStore('pending-capture');
    }
    if (oldVersion < 3) {
      db.createObjectStore('accounts', { keyPath: 'id' });
    }
    if (oldVersion < 4) {
      db.createObjectStore('instruments', { keyPath: 'id' });
    }
    if (oldVersion < 5) {
      db.createObjectStore('receipt-images');
    }
  },
});
```

Also add `ReceiptImage` to the imports from `$lib/types`:

```ts
import type {
  Category,
  Transaction,
  PendingCapture,
  ZenmoneyAccount,
  ZenmoneyInstrument,
  ReceiptImage,
} from '$lib/types';
```

(The `ReceiptImage` import is not strictly needed here but confirms the type is exported — remove if the linter flags an unused import.)

- [ ] **Step 3: Run existing tests to verify nothing is broken**

```bash
pnpm test run
```

Expected: all existing tests pass (DB upgrade is backward-compatible).

- [ ] **Step 4: Commit**

```bash
git add src/lib/types/index.ts src/lib/db/index.ts
git commit -m "feat: add ReceiptImage type and receipt-images IndexedDB store (v5)"
```

---

## Task 2: `receipt-images` DB Module

**Files:**
- Create: `src/lib/db/receipt-images.ts`
- Create: `src/lib/db/receipt-images.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/db/receipt-images.test.ts`:

```ts
import { it, expect, beforeEach } from 'vitest';
import {
  saveReceiptImage,
  getReceiptImage,
  bulkGetReceiptImages,
  deleteReceiptImage,
} from './receipt-images';
import { _resetDb } from './index';
import type { ReceiptImage } from '$lib/types';

function makeImage(overrides: Partial<ReceiptImage> = {}): ReceiptImage {
  return {
    mimeType: 'image/jpeg',
    blob: new Blob(['fake-image-data'], { type: 'image/jpeg' }),
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

it('returns undefined for unknown txId', async () => {
  expect(await getReceiptImage('no-such-id')).toBeUndefined();
});

it('saves and retrieves a receipt image', async () => {
  const img = makeImage({ mimeType: 'image/png' });
  await saveReceiptImage('tx-1', img);
  const result = await getReceiptImage('tx-1');
  expect(result).toBeDefined();
  expect(result!.mimeType).toBe('image/png');
});

it('overwrites on duplicate txId', async () => {
  await saveReceiptImage('tx-1', makeImage({ mimeType: 'image/jpeg' }));
  await saveReceiptImage('tx-1', makeImage({ mimeType: 'image/webp' }));
  const result = await getReceiptImage('tx-1');
  expect(result!.mimeType).toBe('image/webp');
});

it('deleteReceiptImage removes the entry', async () => {
  await saveReceiptImage('tx-del', makeImage());
  await deleteReceiptImage('tx-del');
  expect(await getReceiptImage('tx-del')).toBeUndefined();
});

it('deleteReceiptImage is a no-op for unknown id', async () => {
  await expect(deleteReceiptImage('ghost')).resolves.toBeUndefined();
});

it('bulkGetReceiptImages returns empty map for empty input', async () => {
  const result = await bulkGetReceiptImages([]);
  expect(result.size).toBe(0);
});

it('bulkGetReceiptImages returns only found entries', async () => {
  await saveReceiptImage('tx-a', makeImage({ mimeType: 'image/jpeg' }));
  await saveReceiptImage('tx-b', makeImage({ mimeType: 'image/png' }));
  const result = await bulkGetReceiptImages(['tx-a', 'tx-b', 'tx-missing']);
  expect(result.size).toBe(2);
  expect(result.get('tx-a')!.mimeType).toBe('image/jpeg');
  expect(result.get('tx-b')!.mimeType).toBe('image/png');
  expect(result.has('tx-missing')).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test run src/lib/db/receipt-images.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement `receipt-images.ts`**

Create `src/lib/db/receipt-images.ts`:

```ts
import { getDb } from './index';
import type { ReceiptImage } from '$lib/types';

export async function saveReceiptImage(txId: string, image: ReceiptImage): Promise<void> {
  const db = await getDb();
  await db.put('receipt-images', { blob: image.blob, mimeType: image.mimeType }, txId);
}

export async function getReceiptImage(txId: string): Promise<ReceiptImage | undefined> {
  const db = await getDb();
  const row = await db.get('receipt-images', txId);
  if (!row) return undefined;
  return { blob: row.blob, mimeType: row.mimeType as ReceiptImage['mimeType'] };
}

export async function bulkGetReceiptImages(txIds: string[]): Promise<Map<string, ReceiptImage>> {
  if (txIds.length === 0) return new Map();
  const db = await getDb();
  const rows = await Promise.all(txIds.map((id) => db.get('receipt-images', id)));
  const map = new Map<string, ReceiptImage>();
  txIds.forEach((id, i) => {
    const row = rows[i];
    if (row) map.set(id, { blob: row.blob, mimeType: row.mimeType as ReceiptImage['mimeType'] });
  });
  return map;
}

export async function deleteReceiptImage(txId: string): Promise<void> {
  const db = await getDb();
  await db.delete('receipt-images', txId);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test run src/lib/db/receipt-images.test.ts
```

Expected: all 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/receipt-images.ts src/lib/db/receipt-images.test.ts
git commit -m "feat: add receipt-images DB module with CRUD operations"
```

---

## Task 3: Add `getTransaction` to Transactions Module

**Files:**
- Modify: `src/lib/db/transactions.ts`
- Modify: `src/lib/db/transactions.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/db/transactions.test.ts`:

```ts
import {
  getTransactions,
  getTransaction,
  saveTransaction,
  updateTransaction,
  bulkInsertTransactions,
} from './transactions';
```

(Update the existing import at the top of the file to add `getTransaction`.)

Then append this test:

```ts
it('getTransaction returns the transaction by id', async () => {
  const tx = makeTx({ id: 'get-1', amount: 750 });
  await saveTransaction(tx);
  const result = await getTransaction('get-1');
  expect(result).toBeDefined();
  expect(result!.amount).toBe(750);
});

it('getTransaction returns undefined for unknown id', async () => {
  expect(await getTransaction('no-such-id')).toBeUndefined();
});
```

- [ ] **Step 2: Run to verify they fail**

```bash
pnpm test run src/lib/db/transactions.test.ts
```

Expected: FAIL — `getTransaction` is not exported.

- [ ] **Step 3: Add `getTransaction` to `transactions.ts`**

Append to `src/lib/db/transactions.ts`:

```ts
export async function getTransaction(id: string): Promise<Transaction | undefined> {
  const db = await getDb();
  return db.get('transactions', id);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test run src/lib/db/transactions.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/transactions.ts src/lib/db/transactions.test.ts
git commit -m "feat: add getTransaction(id) to transactions module"
```

---

## Task 4: Backup v2 — Images in Export/Import

**Files:**
- Modify: `src/lib/services/backup.ts`
- Modify: `src/lib/services/backup.test.ts`

- [ ] **Step 1: Write failing tests**

Replace the contents of `src/lib/services/backup.test.ts` with:

```ts
import { it, expect, beforeEach, describe } from 'vitest';
import JSON5 from 'json5';
import { exportBackup, importBackup } from './backup';
import { saveTransaction, getTransactions } from '$lib/db/transactions';
import { saveReceiptImage, getReceiptImage } from '$lib/db/receipt-images';
import { _resetDb } from '$lib/db/index';
import type { Transaction } from '$lib/types';

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: crypto.randomUUID(),
    zenmoneyId: null,
    accountId: 'acc-1',
    amount: 100,
    currency: 'RUB',
    merchant: 'Test Store',
    categoryId: 'c1',
    date: '2026-05-01',
    status: 'pending',
    createdAt: Date.now(),
    ...overrides,
  };
}

async function resetDb() {
  _resetDb();
  await new Promise<void>((resolve) => {
    const req = globalThis.indexedDB.deleteDatabase('rzm');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
}

beforeEach(resetDb);

async function makeBackupFile(data: unknown): Promise<File> {
  const compressed = await new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON5.stringify(data)));
        controller.close();
      },
    }).pipeThrough(new CompressionStream('gzip')),
  ).arrayBuffer();
  const blob = new Blob([compressed], { type: 'application/gzip' });
  return new File([blob], 'test.rzm.gz', { type: 'application/gzip' });
}

describe('exportBackup', () => {
  it('returns a non-empty gzip Blob', async () => {
    await saveTransaction(makeTx());
    const { blob } = await exportBackup();
    expect(blob.size).toBeGreaterThan(0);
    expect(blob.type).toBe('application/gzip');
  });

  it('count matches number of transactions', async () => {
    await saveTransaction(makeTx());
    await saveTransaction(makeTx());
    const { count } = await exportBackup();
    expect(count).toBe(2);
  });

  it('count is 0 when no transactions exist', async () => {
    const { count } = await exportBackup();
    expect(count).toBe(0);
  });
});

describe('importBackup', () => {
  it('round-trip: export then import restores transactions and receipt images', async () => {
    const tx1 = makeTx({ id: 'rt-1', amount: 500, hasReceipt: true });
    const tx2 = makeTx({ id: 'rt-2', amount: 1000 });
    await saveTransaction(tx1);
    await saveTransaction(tx2);
    await saveReceiptImage('rt-1', {
      mimeType: 'image/jpeg',
      blob: new Blob(['fake-image'], { type: 'image/jpeg' }),
    });
    const { blob } = await exportBackup();
    await resetDb();
    const file = new File([blob], 'backup.rzm.gz', { type: 'application/gzip' });
    const result = await importBackup(file);
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    const restored = await getTransactions();
    expect(restored).toHaveLength(2);
    expect(restored.find((t) => t.id === 'rt-1')?.hasReceipt).toBe(true);
    const img = await getReceiptImage('rt-1');
    expect(img).toBeDefined();
    expect(img!.mimeType).toBe('image/jpeg');
  });

  it('skips duplicate ids, imports only new transactions', async () => {
    const existing = makeTx({ id: 'ex-1' });
    const newTx = makeTx({ id: 'new-1' });
    await saveTransaction(existing);
    await saveTransaction(newTx);
    const { blob } = await exportBackup();
    await resetDb();
    await saveTransaction(existing);
    const file = new File([blob], 'backup.rzm.gz', { type: 'application/gzip' });
    const result = await importBackup(file);
    expect(result.imported).toBe(1);
    expect(result.skipped).toBe(1);
    const allAfter = await getTransactions();
    expect(allAfter).toHaveLength(2);
    expect(allAfter.find((t) => t.id === 'new-1')).toBeDefined();
  });

  it('v1 backup (no receiptImages) imports transactions without error', async () => {
    const file = await makeBackupFile({
      version: 1,
      exportedAt: new Date().toISOString(),
      transactions: [makeTx({ id: 'v1-tx' })],
    });
    const result = await importBackup(file);
    expect(result.imported).toBe(1);
    const txs = await getTransactions();
    expect(txs[0].id).toBe('v1-tx');
  });

  it('throws a readable error for invalid gzip data', async () => {
    const bad = new File([new Uint8Array([0x00, 0x01, 0x02, 0x03])], 'bad.rzm.gz', {
      type: 'application/gzip',
    });
    await expect(importBackup(bad)).rejects.toThrow('could not read file');
  });

  it('throws for valid gzip that contains non-JSON5 content', async () => {
    const rawText = '{ this is: not valid json5 [[[';
    const compressed = await new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode(rawText));
          controller.close();
        },
      }).pipeThrough(new CompressionStream('gzip')),
    ).arrayBuffer();
    const file = new File([compressed], 'bad.rzm.gz', { type: 'application/gzip' });
    await expect(importBackup(file)).rejects.toThrow('invalid backup file');
  });

  it('throws for unsupported backup version', async () => {
    const file = await makeBackupFile({
      version: 99,
      exportedAt: new Date().toISOString(),
      transactions: [],
    });
    await expect(importBackup(file)).rejects.toThrow('unsupported backup version');
  });

  it('throws when transactions field is missing', async () => {
    const file = await makeBackupFile({ version: 1, exportedAt: new Date().toISOString() });
    await expect(importBackup(file)).rejects.toThrow('invalid backup file');
  });

  it('throws for backup with invalid transaction item', async () => {
    const file = await makeBackupFile({
      version: 1,
      exportedAt: new Date().toISOString(),
      transactions: [{ notAnId: 'bad' }, null, 42],
    });
    await expect(importBackup(file)).rejects.toThrow('invalid backup file');
  });
});
```

- [ ] **Step 2: Run to verify new tests fail**

```bash
pnpm test run src/lib/services/backup.test.ts
```

Expected: round-trip receipt test fails; v1 import test fails (version check rejects v1... wait, v1 currently passes — so the new v1 test should pass already). The round-trip receipt test fails because images aren't yet included. That's sufficient.

- [ ] **Step 3: Rewrite `backup.ts`**

Replace the contents of `src/lib/services/backup.ts`:

```ts
import JSON5 from 'json5';
import { getTransactions, bulkInsertTransactions } from '$lib/db/transactions';
import {
  getReceiptImage,
  saveReceiptImage,
  bulkGetReceiptImages,
} from '$lib/db/receipt-images';
import type { Transaction } from '$lib/types';

interface BackupEnvelope {
  version: number;
  exportedAt: string;
  transactions: Transaction[];
  receiptImages?: Record<string, { mimeType: string; data: string }>;
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(data: string, mimeType: string): Blob {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

export async function exportBackup(): Promise<{ blob: Blob; count: number }> {
  const transactions = await getTransactions();

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

export async function importBackup(file: File): Promise<{ imported: number; skipped: number }> {
  let text: string;
  try {
    const buffer = await file.arrayBuffer();
    text = await new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(buffer));
          controller.close();
        },
      }).pipeThrough(new DecompressionStream('gzip')),
    ).text();
  } catch {
    throw new Error('Import failed: could not read file');
  }

  let envelope: BackupEnvelope;
  try {
    envelope = JSON5.parse(text);
  } catch {
    throw new Error('Import failed: invalid backup file');
  }

  if (envelope === null || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new Error('Import failed: invalid backup file');
  }
  if (envelope.version !== 1 && envelope.version !== 2) {
    throw new Error('Import failed: unsupported backup version');
  }
  if (!Array.isArray(envelope.transactions)) {
    throw new Error('Import failed: invalid backup file');
  }

  const valid = envelope.transactions.every(
    (t: unknown) =>
      t !== null &&
      typeof t === 'object' &&
      !Array.isArray(t) &&
      typeof (t as Record<string, unknown>).id === 'string',
  );
  if (!valid) throw new Error('Import failed: invalid backup file');

  const receiptImages = envelope.receiptImages ?? {};

  // Mark hasReceipt on transactions that have an image in the backup
  const txsToInsert = envelope.transactions.map((t) =>
    receiptImages[t.id] ? { ...t, hasReceipt: true } : t,
  );

  const existing = await getTransactions();
  const existingIds = new Set(existing.map((t) => t.id));
  const toInsert = txsToInsert.filter((t) => !existingIds.has(t.id));
  await bulkInsertTransactions(toInsert);

  // Save receipt images for inserted transactions only
  await Promise.all(
    toInsert
      .filter((t) => t.hasReceipt && receiptImages[t.id])
      .map(async (t) => {
        const { mimeType, data } = receiptImages[t.id];
        await saveReceiptImage(t.id, {
          blob: base64ToBlob(data, mimeType),
          mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
        });
      }),
  );

  return { imported: toInsert.length, skipped: envelope.transactions.length - toInsert.length };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test run src/lib/services/backup.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
pnpm test run
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/backup.ts src/lib/services/backup.test.ts
git commit -m "feat: backup v2 includes receipt images in export/import"
```

---

## Task 5: Capture Flow — Save Receipt Image on Submit

**Files:**
- Modify: `src/routes/review/+page.svelte`

No automated tests for this task — it is a Svelte page wiring verified manually.

- [ ] **Step 1: Import `saveReceiptImage` and update the submit handler**

In `src/routes/review/+page.svelte`, add the import at the top of the `<script>` block:

```ts
import { saveReceiptImage } from '$lib/db/receipt-images'
```

In `handleSubmit`, after `await saveTransaction(tx)` and before the `try` block that calls `syncDiff`, add:

```ts
// Persist the receipt image; non-fatal if it fails
try {
  const blob = await (await fetch(`data:${capture!.mimeType};base64,${capture!.imageBase64}`)).blob()
  await saveReceiptImage(txId, { blob, mimeType: capture!.mimeType })
  await updateTransaction(txId, { hasReceipt: true })
} catch {
  // image save failed — transaction is still saved without hasReceipt
}
```

The full updated `handleSubmit` should read:

```ts
async function handleSubmit() {
  submitting = true
  submitError = null
  const reviewAccountId = selectedAccountId
  const txId = crypto.randomUUID()
  const tx = {
    id: txId,
    zenmoneyId: null,
    accountId: reviewAccountId,
    amount: parseFloat(amount) || 0,
    currency,
    merchant,
    categoryId,
    date,
    status: 'pending' as const,
    createdAt: Date.now()
  }
  await saveTransaction(tx)

  // Persist the receipt image; non-fatal if it fails
  try {
    const blob = await (await fetch(`data:${capture!.mimeType};base64,${capture!.imageBase64}`)).blob()
    await saveReceiptImage(txId, { blob, mimeType: capture!.mimeType })
    await updateTransaction(txId, { hasReceipt: true })
  } catch {
    // image save failed — transaction is still saved without hasReceipt
  }

  try {
    const settings = await getSettings()
    if (!settings.zenmoneyToken) throw new Error('Zenmoney token not set')
    if (!reviewAccountId)
      throw new Error('No Zenmoney account available — go to Settings and reload categories')
    if (!settings.zenmoneyUserId)
      throw new Error('No Zenmoney user ID — go to Settings and reload categories')
    const instrument = await getInstrumentByCurrency(tx.currency)
    if (!instrument)
      throw new Error(`No Zenmoney instrument for currency ${tx.currency} — go to Settings and reload categories`)
    const payload = buildTransactionPayload(tx, reviewAccountId, settings.zenmoneyUserId, instrument.id)
    const diffResponse = await syncDiff(settings.zenmoneyToken, settings.zenmoneyServerTimestamp, [payload])
    await saveSettings({ zenmoneyServerTimestamp: diffResponse.serverTimestamp })
    await updateTransaction(txId, { status: 'submitted', zenmoneyId: txId })
  } catch (e) {
    await updateTransaction(txId, { status: 'failed' })
    submitError = String(e)
    submitting = false
    return
  }
  await clearPendingCapture()
  captureStore.set(null)
  goto('/history')
}
```

- [ ] **Step 2: Run full test suite**

```bash
pnpm test run
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/routes/review/+page.svelte
git commit -m "feat: save receipt image to IndexedDB on transaction submit"
```

---

## Task 6: TransactionCard Thumbnail

**Files:**
- Modify: `src/lib/components/TransactionCard.svelte`

- [ ] **Step 1: Add `receiptImage` prop and thumbnail rendering**

Replace the contents of `src/lib/components/TransactionCard.svelte`:

```svelte
<script lang="ts">
  import type { Transaction, Category, ReceiptImage } from '$lib/types'

  let {
    transaction,
    categories,
    receiptImage,
    onRetry
  }: {
    transaction: Transaction
    categories: Category[]
    receiptImage?: ReceiptImage
    onRetry?: (tx: Transaction) => Promise<void>
  } = $props()

  const category = $derived(categories.find((c) => c.id === transaction.categoryId))
  const formattedAmount = $derived(
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: transaction.currency }).format(
      transaction.amount
    )
  )
  const formattedDate = $derived(
    new Date(transaction.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  )

  let retrying = $state(false)
  let retryError = $state<string | null>(null)

  let thumbnailUrl = $state<string | null>(null)
  $effect(() => {
    if (receiptImage) {
      thumbnailUrl = URL.createObjectURL(receiptImage.blob)
    }
    return () => {
      if (thumbnailUrl) URL.revokeObjectURL(thumbnailUrl)
    }
  })

  async function handleRetry() {
    if (!onRetry) return
    retrying = true
    retryError = null
    try {
      await onRetry(transaction)
    } catch (e) {
      retryError = e instanceof Error ? e.message : String(e)
    } finally {
      retrying = false
    }
  }
</script>

<div class="card">
  <div class="row">
    <div class="left">
      <span class="merchant">{transaction.merchant || 'Unknown'}</span>
      <span class="meta">{category?.title ?? 'Uncategorized'} · {formattedDate}</span>
    </div>
    <div class="right">
      <span class="amount">−{formattedAmount}</span>
      <span class="badge badge-{transaction.status}">{transaction.status}</span>
    </div>
  </div>
  {#if thumbnailUrl}
    <div class="thumbnail-row">
      <a href="/receipt/{transaction.id}">
        <img src={thumbnailUrl} alt="Receipt" class="thumbnail" />
      </a>
    </div>
  {/if}
  {#if transaction.status === 'failed' && onRetry}
    <div class="retry-row">
      {#if retryError}<span class="retry-error">{retryError}</span>{/if}
      <button class="btn-retry" onclick={handleRetry} disabled={retrying}>
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  {/if}
</div>

<style>
  .card { padding: 14px 16px; border-bottom: 1px solid var(--color-border); }
  .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .left { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .merchant { font-size: 15px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .meta { font-size: 12px; color: var(--color-text-muted); }
  .right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
  .amount { font-size: 15px; font-weight: 600; }
  .badge { font-size: 11px; padding: 2px 8px; border-radius: 99px; font-weight: 500; }
  .badge-submitted { background: color-mix(in srgb, var(--color-success) 20%, transparent); color: var(--color-success); }
  .badge-pending { background: color-mix(in srgb, var(--color-warning) 20%, transparent); color: var(--color-warning); }
  .badge-failed { background: color-mix(in srgb, var(--color-error) 20%, transparent); color: var(--color-error); }
  .thumbnail-row { margin-top: 8px; }
  .thumbnail { width: 48px; height: 48px; object-fit: cover; border-radius: var(--radius-sm); border: 1px solid var(--color-border); display: block; }
  .retry-row { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 8px; }
  .retry-error { font-size: 11px; color: var(--color-error); flex: 1; }
  .btn-retry { font-size: 12px; font-weight: 600; color: var(--color-primary); padding: 4px 12px; border: 1px solid var(--color-primary); border-radius: var(--radius-sm); }
  .btn-retry:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
```

- [ ] **Step 2: Run full test suite**

```bash
pnpm test run
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/TransactionCard.svelte
git commit -m "feat: add receipt thumbnail to TransactionCard"
```

---

## Task 7: History Page — Load Receipt Images

**Files:**
- Modify: `src/routes/history/+page.svelte`

- [ ] **Step 1: Update history page to load receipt images**

Replace the contents of `src/routes/history/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount } from 'svelte'
  import { getTransactions, updateTransaction } from '$lib/db/transactions'
  import { getCategories } from '$lib/db/categories'
  import { getSettings, saveSettings } from '$lib/db/settings'
  import { getInstrumentByCurrency } from '$lib/db/instruments'
  import { bulkGetReceiptImages } from '$lib/db/receipt-images'
  import { syncDiff, buildTransactionPayload } from '$lib/services/zenmoney'
  import TransactionCard from '$lib/components/TransactionCard.svelte'
  import type { Transaction, Category, ReceiptImage } from '$lib/types'

  let transactions = $state<Transaction[]>([])
  let categories = $state<Category[]>([])
  let receiptImages = $state<Map<string, ReceiptImage>>(new Map())
  let loading = $state(true)

  onMount(async () => {
    ;[transactions, categories] = await Promise.all([getTransactions(), getCategories()])
    const receiptTxIds = transactions.filter((t) => t.hasReceipt).map((t) => t.id)
    receiptImages = await bulkGetReceiptImages(receiptTxIds)
    loading = false
  })

  async function retryTransaction(tx: Transaction): Promise<void> {
    const settings = await getSettings()
    if (!settings.zenmoneyToken) throw new Error('Zenmoney token not set')
    const accountId = tx.accountId || settings.zenmoneyAccountId
    if (!accountId)
      throw new Error('No Zenmoney account set — go to Settings → Reload Categories')
    if (!settings.zenmoneyUserId)
      throw new Error('No Zenmoney user ID — go to Settings → Reload Categories')
    const instrument = await getInstrumentByCurrency(tx.currency)
    if (!instrument)
      throw new Error(`No Zenmoney instrument for currency ${tx.currency} — go to Settings → Reload Categories`)

    await updateTransaction(tx.id, { status: 'pending' })
    transactions = await getTransactions()

    try {
      const payload = buildTransactionPayload(tx, accountId, settings.zenmoneyUserId, instrument.id)
      const diffResponse = await syncDiff(
        settings.zenmoneyToken,
        settings.zenmoneyServerTimestamp,
        [payload]
      )
      await saveSettings({ zenmoneyServerTimestamp: diffResponse.serverTimestamp })
      await updateTransaction(tx.id, { status: 'submitted', zenmoneyId: tx.id })
    } catch (e) {
      await updateTransaction(tx.id, { status: 'failed' })
      throw e
    } finally {
      transactions = await getTransactions()
    }
  }
</script>

<div class="page">
  <h1>History</h1>
  {#if loading}
    <div class="empty">Loading…</div>
  {:else if transactions.length === 0}
    <div class="empty">
      <p>No transactions yet.</p>
      <p>Capture a receipt to get started.</p>
    </div>
  {:else}
    <div class="list">
      {#each transactions as tx (tx.id)}
        <TransactionCard
          transaction={tx}
          {categories}
          receiptImage={receiptImages.get(tx.id)}
          onRetry={tx.status === 'failed' ? retryTransaction : undefined}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  .page { padding-top: 20px; padding-bottom: var(--nav-height); }
  h1 { font-size: 24px; font-weight: 700; padding: 0 16px 16px; }
  .list { border-top: 1px solid var(--color-border); }
  .empty { padding: 48px 16px; text-align: center; color: var(--color-text-muted); display: flex; flex-direction: column; gap: 8px; }
</style>
```

- [ ] **Step 2: Run full test suite**

```bash
pnpm test run
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/routes/history/+page.svelte
git commit -m "feat: load and display receipt image thumbnails in history"
```

---

## Task 8: Receipt Page

**Files:**
- Create: `src/routes/receipt/[id]/+page.svelte`

- [ ] **Step 1: Create the route directory and page**

```bash
mkdir -p src/routes/receipt/\[id\]
```

Create `src/routes/receipt/[id]/+page.svelte`:

```svelte
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { get } from 'svelte/store'
  import { getTransaction } from '$lib/db/transactions'
  import { getReceiptImage } from '$lib/db/receipt-images'
  import { getCategories } from '$lib/db/categories'
  import type { Transaction, Category, ReceiptImage } from '$lib/types'

  const txId = get(page).params.id

  let transaction = $state<Transaction | null>(null)
  let receiptImage = $state<ReceiptImage | null>(null)
  let categories = $state<Category[]>([])
  let imageUrl = $state<string | null>(null)
  let loading = $state(true)

  onMount(async () => {
    ;[transaction, receiptImage, categories] = await Promise.all([
      getTransaction(txId),
      getReceiptImage(txId),
      getCategories(),
    ])
    if (!transaction) { goto('/history'); return }
    if (receiptImage) imageUrl = URL.createObjectURL(receiptImage.blob)
    loading = false
  })

  onDestroy(() => {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
  })

  const category = $derived(
    transaction ? categories.find((c) => c.id === transaction!.categoryId) : undefined
  )
  const formattedAmount = $derived(
    transaction
      ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: transaction.currency }).format(
          transaction.amount
        )
      : ''
  )
  const formattedDate = $derived(
    transaction
      ? new Date(transaction.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
      : ''
  )
</script>

<div class="page">
  <div class="header">
    <a href="/history" class="back">← Back</a>
    <h1>Receipt</h1>
  </div>

  {#if loading}
    <div class="loading">Loading…</div>
  {:else}
    {#if imageUrl}
      <img src={imageUrl} alt="Receipt" class="receipt-img" />
    {:else}
      <div class="no-image">No receipt image available</div>
    {/if}

    {#if transaction}
      <div class="summary">
        <div class="summary-row">
          <span class="label">Merchant</span>
          <span>{transaction.merchant || 'Unknown'}</span>
        </div>
        <div class="summary-row">
          <span class="label">Amount</span>
          <span>−{formattedAmount}</span>
        </div>
        <div class="summary-row">
          <span class="label">Category</span>
          <span>{category?.title ?? 'Uncategorized'}</span>
        </div>
        <div class="summary-row">
          <span class="label">Date</span>
          <span>{formattedDate}</span>
        </div>
        <div class="summary-row">
          <span class="label">Status</span>
          <span class="badge badge-{transaction.status}">{transaction.status}</span>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .page { padding: 16px; display: flex; flex-direction: column; gap: 16px; padding-bottom: calc(var(--nav-height) + 16px); }
  .header { display: flex; align-items: center; gap: 12px; }
  .back { color: var(--color-primary); font-size: 15px; }
  h1 { font-size: 20px; font-weight: 700; }
  .loading { padding: 48px 16px; text-align: center; color: var(--color-text-muted); }
  .receipt-img { width: 100%; border-radius: var(--radius-md); border: 1px solid var(--color-border); object-fit: contain; }
  .no-image { padding: 48px 16px; text-align: center; color: var(--color-text-muted); border: 1px dashed var(--color-border); border-radius: var(--radius-md); }
  .summary { display: flex; flex-direction: column; gap: 0; border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
  .summary-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--color-border); font-size: 14px; }
  .summary-row:last-child { border-bottom: none; }
  .label { color: var(--color-text-muted); font-size: 13px; }
  .badge { font-size: 11px; padding: 2px 8px; border-radius: 99px; font-weight: 500; }
  .badge-submitted { background: color-mix(in srgb, var(--color-success) 20%, transparent); color: var(--color-success); }
  .badge-pending { background: color-mix(in srgb, var(--color-warning) 20%, transparent); color: var(--color-warning); }
  .badge-failed { background: color-mix(in srgb, var(--color-error) 20%, transparent); color: var(--color-error); }
</style>
```

- [ ] **Step 2: Run full test suite**

```bash
pnpm test run
```

Expected: all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/routes/receipt/
git commit -m "feat: add /receipt/[id] page for full receipt image view"
```

---

## Done

All 8 tasks complete. The feature is fully implemented:
- Receipt images saved to IndexedDB on submit
- 48×48 thumbnail in history, tapping navigates to receipt page
- Full receipt view at `/receipt/[id]`
- Backup v2 includes images; v1 backups still import cleanly
