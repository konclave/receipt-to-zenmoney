// src/lib/db/transactions.test.ts
import { it, expect, beforeEach } from 'vitest';
import { getTransactions, saveTransaction, updateTransaction } from './transactions';
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
