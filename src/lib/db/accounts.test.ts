import { it, expect, beforeEach } from 'vitest';
import { getAccounts, saveAccounts } from './accounts';
import { _resetDb } from './index';
import type { ZenmoneyAccount } from '$lib/types';

const ACCOUNTS: ZenmoneyAccount[] = [
  { id: 'acc-1', title: 'Cash' },
  { id: 'acc-2', title: 'Card' },
];

beforeEach(async () => {
  _resetDb();
  await new Promise<void>((resolve) => {
    const req = globalThis.indexedDB.deleteDatabase('rzm');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
});

it('returns empty array initially', async () => {
  expect(await getAccounts()).toEqual([]);
});

it('saves and retrieves accounts', async () => {
  await saveAccounts(ACCOUNTS);
  const result = await getAccounts();
  expect(result).toHaveLength(ACCOUNTS.length);
  expect(result).toEqual(expect.arrayContaining(ACCOUNTS));
});

it('replaces old accounts on re-save', async () => {
  await saveAccounts(ACCOUNTS);
  await saveAccounts([{ id: 'acc-3', title: 'Savings' }]);
  expect(await getAccounts()).toEqual([{ id: 'acc-3', title: 'Savings' }]);
});
