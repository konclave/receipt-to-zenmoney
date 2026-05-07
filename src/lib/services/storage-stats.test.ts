import { it, expect, beforeEach, vi } from 'vitest';
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
  const { bulkGetReceiptImages } = await import('$lib/db/receipt-images');
  const tx = makeTx({ id: 'img-tx', date: '2025-01-01', hasReceipt: true });
  await saveTransaction(tx);

  // Mock bulkGetReceiptImages to return a blob with known size
  const spy = vi.spyOn(await import('$lib/db/receipt-images'), 'bulkGetReceiptImages')
  spy.mockResolvedValueOnce(
    new Map([['img-tx', { blob: new Blob([new Uint8Array(1000)], { type: 'image/jpeg' }), mimeType: 'image/jpeg' as const }]])
  );

  const result = await getStorageStats();
  const year2025 = result.byYear.find((y) => y.year === 2025)!;
  expect(year2025.bytes).toBe(1000 + 500);

  spy.mockRestore();
});

it('totalBytes equals sum of all byYear entries', async () => {
  await bulkInsertTransactions([
    makeTx({ id: 'x1', date: '2023-01-01' }),
    makeTx({ id: 'x2', date: '2024-01-01' }),
  ]);
  const result = await getStorageStats();
  expect(result.totalBytes).toBe(result.byYear.reduce((s, y) => s + y.bytes, 0));
});
