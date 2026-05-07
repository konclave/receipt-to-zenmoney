// src/lib/db/transactions.test.ts
import { it, expect, beforeEach } from 'vitest';
import {
  getTransactions,
  getTransaction,
  saveTransaction,
  updateTransaction,
  bulkInsertTransactions,
} from './transactions';
import { _resetDb } from './index';
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

beforeEach(async () => {
  _resetDb();
  await new Promise<void>((resolve) => {
    const req = globalThis.indexedDB.deleteDatabase('rzm');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
});

it('returns empty array initially', async () => {
  expect(await getTransactions()).toEqual([]);
});

it('returns newest date first', async () => {
  await saveTransaction(makeTx({ date: '2026-01-01' }));
  await saveTransaction(makeTx({ date: '2026-05-05' }));
  const result = await getTransactions();
  expect(result[0].date).toBe('2026-05-05');
  expect(result[1].date).toBe('2026-01-01');
});

it('saves and retrieves a transaction', async () => {
  const tx = makeTx({ id: 'tx-1', amount: 500, accountId: 'acc-cash' });
  await saveTransaction(tx);
  const result = await getTransactions();
  expect(result).toHaveLength(1);
  expect(result[0].amount).toBe(500);
  expect(result[0].accountId).toBe('acc-cash');
});

it('updateTransaction changes status and zenmoneyId', async () => {
  const tx = makeTx({ id: 'tx-u' });
  await saveTransaction(tx);
  await updateTransaction('tx-u', { status: 'submitted', zenmoneyId: 'zm-123' });
  const result = await getTransactions();
  expect(result[0].status).toBe('submitted');
  expect(result[0].zenmoneyId).toBe('zm-123');
});

it('updateTransaction throws for unknown id', async () => {
  await expect(updateTransaction('missing', { status: 'failed' })).rejects.toThrow();
});

it('bulkInsertTransactions inserts multiple transactions', async () => {
  const txs = [makeTx({ id: 'b1', date: '2026-01-01' }), makeTx({ id: 'b2', date: '2026-02-01' })];
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

it('bulkInsertTransactions overwrites existing record with same id', async () => {
  const tx = makeTx({ id: 'upsert-1', amount: 100 });
  await saveTransaction(tx);
  await bulkInsertTransactions([{ ...tx, amount: 999 }]);
  const result = await getTransactions();
  expect(result).toHaveLength(1);
  expect(result[0].amount).toBe(999);
});

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
