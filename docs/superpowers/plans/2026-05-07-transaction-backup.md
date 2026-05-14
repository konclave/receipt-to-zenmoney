# Transaction History Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add export (download `.rzm.gz` backup) and import (merge from backup file) of transaction history to the Settings page.

**Architecture:** A new `backup.ts` service wraps IndexedDB reads/writes and stream-based gzip compression. The Settings page gains a "Backup & Restore" section with two buttons — export triggers a Web Share API call with an `<a download>` fallback; import opens a hidden file input. All logic is pure TypeScript tested with Vitest; the UI is Svelte 5 reactive state.

**Tech Stack:** `json5` (serialize/parse), native `CompressionStream` / `DecompressionStream` (Node 24 / modern browsers), `idb` (already used), SvelteKit + Svelte 5

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `src/lib/services/backup.ts` | `exportBackup` and `importBackup` functions |
| Create | `src/lib/services/backup.test.ts` | All backup service tests |
| Modify | `src/lib/db/transactions.ts` | Add `bulkInsertTransactions` |
| Modify | `src/routes/settings/+page.svelte` | Add Backup & Restore section |
| Create | `docs/superpowers/specs/2026-05-07-transaction-backup-design.md` | Design spec |

---

### Task 1: Feature branch

- [ ] **Step 1: Create and switch to feature branch**

```bash
git checkout -b feat/transaction-backup
```

Expected: `Switched to a new branch 'feat/transaction-backup'`

---

### Task 2: Install json5

- [ ] **Step 1: Install json5**

```bash
npm install json5
```

- [ ] **Step 2: Verify TypeScript types resolve (json5 v2 ships its own types)**

```bash
npx tsc --noEmit
```

Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add json5 dependency for backup serialization"
```

---

### Task 3: Add `bulkInsertTransactions` to transactions.ts

**Files:**
- Modify: `src/lib/db/transactions.ts`
- Test: `src/lib/db/transactions.test.ts`

- [ ] **Step 1: Write failing tests**

Add to the bottom of `src/lib/db/transactions.test.ts`:

```typescript
import { getTransactions, saveTransaction, updateTransaction, bulkInsertTransactions } from './transactions';
```

Replace the existing import line (line 3) — add `bulkInsertTransactions` to the import.

Then add these tests at the bottom of the file:

```typescript
it('bulkInsertTransactions inserts multiple transactions', async () => {
  const txs = [
    makeTx({ id: 'b1', date: '2026-01-01' }),
    makeTx({ id: 'b2', date: '2026-02-01' }),
  ];
  await bulkInsertTransactions(txs);
  const result = await getTransactions();
  expect(result).toHaveLength(2);
  expect(result.map((t) => t.id)).toContain('b1');
  expect(result.map((t) => t.id)).toContain('b2');
});

it('bulkInsertTransactions is a no-op for empty array', async () => {
  await bulkInsertTransactions([]);
  expect(await getTransactions()).toHaveLength(0);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose
```

Expected: FAIL — `bulkInsertTransactions is not a function`

- [ ] **Step 3: Implement `bulkInsertTransactions`**

Add to the bottom of `src/lib/db/transactions.ts`:

```typescript
export async function bulkInsertTransactions(transactions: Transaction[]): Promise<void> {
  if (transactions.length === 0) return;
  const db = await getDb();
  const tx = db.transaction('transactions', 'readwrite');
  await Promise.all(transactions.map((t) => tx.store.put(t)));
  await tx.done;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- --reporter=verbose
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/db/transactions.ts src/lib/db/transactions.test.ts
git commit -m "feat: add bulkInsertTransactions for batch import"
```

---

### Task 4: Create backup service — `exportBackup`

**Files:**
- Create: `src/lib/services/backup.ts`
- Create: `src/lib/services/backup.test.ts`

- [ ] **Step 1: Write failing tests**

Create `src/lib/services/backup.test.ts`:

```typescript
// src/lib/services/backup.test.ts
import { it, expect, beforeEach, describe } from 'vitest';
import JSON5 from 'json5';
import { exportBackup } from './backup';
import { saveTransaction } from '$lib/db/transactions';
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose
```

Expected: FAIL — `Cannot find module './backup'`

- [ ] **Step 3: Implement `exportBackup`**

Create `src/lib/services/backup.ts`:

```typescript
// src/lib/services/backup.ts
import JSON5 from 'json5';
import { getTransactions, bulkInsertTransactions } from '$lib/db/transactions';
import type { Transaction } from '$lib/types';

interface BackupEnvelope {
  version: number;
  exportedAt: string;
  transactions: Transaction[];
}

export async function exportBackup(): Promise<{ blob: Blob; count: number }> {
  const transactions = await getTransactions();
  const envelope: BackupEnvelope = {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions,
  };
  const compressed = await new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON5.stringify(envelope, null, 2)));
        controller.close();
      },
    }).pipeThrough(new CompressionStream('gzip'))
  ).arrayBuffer();
  return { blob: new Blob([compressed], { type: 'application/gzip' }), count: transactions.length };
}

export async function importBackup(file: File): Promise<{ imported: number; skipped: number }> {
  // placeholder — implemented in Task 5
  throw new Error('not implemented');
}
```

- [ ] **Step 4: Run tests to verify export tests pass**

```bash
npm test -- --reporter=verbose
```

Expected: export tests PASS; importBackup tests may not exist yet — that's fine

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/backup.ts src/lib/services/backup.test.ts
git commit -m "feat: implement exportBackup — gzip JSON5 transaction dump"
```

---

### Task 5: Implement `importBackup`

**Files:**
- Modify: `src/lib/services/backup.ts` (replace placeholder)
- Modify: `src/lib/services/backup.test.ts` (add import tests)

- [ ] **Step 1: Write failing tests**

Add to `src/lib/services/backup.test.ts` — at the top add the missing import:

```typescript
import { exportBackup, importBackup } from './backup';
import { saveTransaction, getTransactions } from '$lib/db/transactions';
```

Replace the existing import lines that reference `exportBackup` and `saveTransaction` with the above.

Then add this helper and test suite after the `exportBackup` describe block:

```typescript
async function makeBackupFile(data: unknown): Promise<File> {
  const compressed = await new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON5.stringify(data)));
        controller.close();
      },
    }).pipeThrough(new CompressionStream('gzip'))
  ).arrayBuffer();
  const blob = new Blob([compressed], { type: 'application/gzip' });
  return new File([blob], 'test.rzm.gz', { type: 'application/gzip' });
}

describe('importBackup', () => {
  it('round-trip: export then import restores all transactions', async () => {
    const tx1 = makeTx({ id: 'rt-1', amount: 500 });
    const tx2 = makeTx({ id: 'rt-2', amount: 1000 });
    await saveTransaction(tx1);
    await saveTransaction(tx2);
    const { blob } = await exportBackup();
    await resetDb();
    const file = new File([blob], 'backup.rzm.gz', { type: 'application/gzip' });
    const result = await importBackup(file);
    expect(result.imported).toBe(2);
    expect(result.skipped).toBe(0);
    const restored = await getTransactions();
    expect(restored).toHaveLength(2);
    expect(restored.map((t) => t.id)).toContain('rt-1');
    expect(restored.map((t) => t.id)).toContain('rt-2');
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
    expect(await getTransactions()).toHaveLength(2);
  });

  it('throws a readable error for invalid gzip data', async () => {
    const bad = new File([new Uint8Array([0x00, 0x01, 0x02, 0x03])], 'bad.rzm.gz', {
      type: 'application/gzip',
    });
    await expect(importBackup(bad)).rejects.toThrow('could not read file');
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
});
```

- [ ] **Step 2: Run tests to verify new tests fail**

```bash
npm test -- --reporter=verbose
```

Expected: import tests FAIL — `not implemented`

- [ ] **Step 3: Implement `importBackup`**

Replace the `importBackup` placeholder in `src/lib/services/backup.ts`:

```typescript
export async function importBackup(file: File): Promise<{ imported: number; skipped: number }> {
  let text: string;
  try {
    text = await new Response(
      new Blob([await file.arrayBuffer()]).stream().pipeThrough(new DecompressionStream('gzip'))
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

  if (envelope.version !== 1) throw new Error('Import failed: unsupported backup version');
  if (!Array.isArray(envelope.transactions)) throw new Error('Import failed: invalid backup file');

  const existing = await getTransactions();
  const existingIds = new Set(existing.map((t) => t.id));
  const toInsert = envelope.transactions.filter((t) => !existingIds.has(t.id));
  await bulkInsertTransactions(toInsert);
  return { imported: toInsert.length, skipped: envelope.transactions.length - toInsert.length };
}
```

- [ ] **Step 4: Run all tests to verify everything passes**

```bash
npm test -- --reporter=verbose
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/backup.ts src/lib/services/backup.test.ts
git commit -m "feat: implement importBackup — merge from gzip JSON5 backup"
```

---

### Task 6: Add Backup & Restore section to Settings page

**Files:**
- Modify: `src/routes/settings/+page.svelte`

- [ ] **Step 1: Add import and reactive state to the `<script>` block**

In `src/routes/settings/+page.svelte`, add this import after the existing imports (after line 9):

```svelte
  import { exportBackup, importBackup } from '$lib/services/backup'
```

Add these state variables after `let success = $state<string | null>(null)` (after line 22):

```svelte
  let backupStatus = $state<string | null>(null)
  let backupError = $state<string | null>(null)
  let exporting = $state(false)
  let importing = $state(false)
  let fileInput: HTMLInputElement
```

- [ ] **Step 2: Add handler functions**

Add these two functions after `handleReloadCategories` (after the closing `}` at line 88, before the closing `</script>`):

```svelte
  async function handleExport() {
    exporting = true
    backupStatus = null
    backupError = null
    try {
      const { blob, count } = await exportBackup()
      const date = new Date().toISOString().slice(0, 10)
      const filename = `rzm-backup-${date}.rzm.gz`
      const shareFile = new File([blob], filename, { type: 'application/gzip' })
      if (navigator.canShare?.({ files: [shareFile] })) {
        await navigator.share({ files: [shareFile], title: 'Zenmoney Backup' })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      }
      backupStatus = `Exported ${count} transaction${count !== 1 ? 's' : ''}`
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      backupError = String(e)
    } finally {
      exporting = false
    }
  }

  async function handleImport(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    importing = true
    backupStatus = null
    backupError = null
    try {
      const { imported, skipped } = await importBackup(file)
      backupStatus = `Imported ${imported} new, skipped ${skipped} duplicate${skipped !== 1 ? 's' : ''}`
    } catch (e) {
      backupError = e instanceof Error ? e.message : String(e)
    } finally {
      importing = false
      ;(event.target as HTMLInputElement).value = ''
    }
  }
```

- [ ] **Step 3: Add UI section**

In the template, locate the block that reads `<p class="hint">App Version {data.appVersion}</p>`. Find the `<hr />` immediately above it. Insert the following block *before* that `<hr />` (i.e., between the `{/if}` that closes the accounts section and the hr before the version line):

```svelte
  <hr />

  <section>
    <h2>Backup & Restore</h2>
    {#if backupError}<div class="alert error">{backupError}</div>{/if}
    {#if backupStatus}<div class="alert success">{backupStatus}</div>{/if}
    <button class="btn-secondary" onclick={handleExport} disabled={exporting || importing}>
      {exporting ? 'Exporting…' : 'Export backup'}
    </button>
    <button class="btn-secondary" onclick={() => fileInput.click()} disabled={exporting || importing}>
      {importing ? 'Importing…' : 'Import backup'}
    </button>
    <input bind:this={fileInput} type="file" accept=".gz,.rzm.gz" style="display:none" onchange={handleImport} />
  </section>
```

- [ ] **Step 4: Run type check**

```bash
npm run check
```

Expected: no errors

- [ ] **Step 5: Run all tests**

```bash
npm test
```

Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add src/routes/settings/+page.svelte
git commit -m "feat: add Backup & Restore section to settings page"
```

---

### Task 7: Write spec doc and final cleanup

- [ ] **Step 1: Create spec doc**

Create `docs/superpowers/specs/2026-05-07-transaction-backup-design.md`:

```markdown
# Transaction History Backup — Design Spec

## Context

Users store all captured transactions locally in IndexedDB. If they clear browser storage, switch
devices, or reinstall the PWA, all local history is lost. This feature adds export (backup to a
file) and import (restore from a backup file) to safeguard and move transaction history.

## Design Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Backup scope | Transactions only | Categories/accounts/instruments are re-syncable from Zenmoney |
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
  transaction, `put()` each record

### `src/routes/settings/+page.svelte`

New "Backup & Restore" section with Export button, Import button, hidden file input, status line.

## Error Handling

| Scenario | Message |
|---|---|
| Decompression fails | "Import failed: could not read file" |
| JSON5 parse error | "Import failed: invalid backup file" |
| `version !== 1` | "Import failed: unsupported backup version" |
| `transactions` not an array | "Import failed: invalid backup file" |
| Share cancelled (AbortError) | No error shown |
| Share unavailable | Falls back to `<a download>` silently |
```

- [ ] **Step 2: Commit spec**

```bash
git add docs/superpowers/specs/2026-05-07-transaction-backup-design.md
git commit -m "docs: add transaction backup design spec"
```

---

## Verification

1. `npm test` — all tests pass, no regressions
2. `npm run dev` — open Settings page, verify "Backup & Restore" section appears with two buttons
3. Add a transaction via the capture flow, then tap "Export backup" — file downloads (or share sheet opens on mobile)
4. Open a second browser profile or clear IndexedDB, tap "Import backup", select the file — transactions restored, status shows "Imported N new, skipped 0 duplicates"
5. Import the same file again — status shows "Imported 0 new, skipped N duplicates"
6. Select a non-gzip file — status shows "Import failed: could not read file", no crash
