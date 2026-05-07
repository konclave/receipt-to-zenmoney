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
