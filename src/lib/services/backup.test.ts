// src/lib/services/backup.test.ts
import { it, expect, beforeEach, describe } from 'vitest';
import JSON5 from 'json5';
import { exportBackup, importBackup } from './backup';
import { saveTransaction, getTransactions } from '$lib/db/transactions';
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
    const allAfter = await getTransactions();
    expect(allAfter).toHaveLength(2);
    expect(allAfter.find((t) => t.id === 'new-1')).toBeDefined();
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
});
