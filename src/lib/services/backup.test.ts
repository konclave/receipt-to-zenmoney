import { it, expect, beforeEach, describe } from 'vitest';
import JSON5 from 'json5';
import { exportBackup, importBackup, exportBackupForPeriod } from './backup';
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

describe('exportBackupForPeriod', () => {
  it('filters to only the specified year', async () => {
    const tx2023 = makeTx({ id: 'p2023', date: '2023-06-01' });
    const tx2024 = makeTx({ id: 'p2024', date: '2024-06-01' });
    await saveTransaction(tx2023);
    await saveTransaction(tx2024);
    const { blob, count } = await exportBackupForPeriod(2023);
    expect(count).toBe(1);
    const buffer = await blob.arrayBuffer();
    const text = await new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(buffer));
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
    const buffer = await blob.arrayBuffer();
    const text = await new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(buffer));
          controller.close();
        },
      }).pipeThrough(new DecompressionStream('gzip')),
    ).text();
    const envelope = JSON5.parse(text);
    expect(Object.keys(envelope.receiptImages)).toEqual(['img2023']);
  });
});
