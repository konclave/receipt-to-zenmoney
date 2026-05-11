import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createZenMoneyDataStore } from './zenmoney-data.store.svelte';

describe('createZenMoneyDataStore', () => {
  const repo = {
    reloadZenMoneyData: vi.fn(),
    saveDefaultAccount: vi.fn(),
  };

  beforeEach(() => {
    repo.reloadZenMoneyData.mockReset();
    repo.saveDefaultAccount.mockReset();
  });

  it('reports whether multiple accounts are available', () => {
    const singleAccountStore = createZenMoneyDataStore(
      {
        categoryCount: 0,
        lastSyncDate: null,
        accounts: [{ id: 'acc-1', title: 'Main' }],
        selectedAccountId: 'acc-1',
      },
      repo,
    );
    const multiAccountStore = createZenMoneyDataStore(
      {
        categoryCount: 0,
        lastSyncDate: null,
        accounts: [
          { id: 'acc-1', title: 'Main' },
          { id: 'acc-2', title: 'Spare' },
        ],
        selectedAccountId: 'acc-1',
      },
      repo,
    );

    expect(singleAccountStore.hasMultipleAccounts).toBe(false);
    expect(multiAccountStore.hasMultipleAccounts).toBe(true);
  });

  it('reloads categories and applies the returned auto-selected account', async () => {
    repo.reloadZenMoneyData.mockResolvedValue({
      categoryCount: 12,
      lastSyncDate: '5/10/2026',
      accounts: [{ id: 'acc-1', title: 'Main account' }],
      selectedAccountId: 'acc-1',
    });

    const store = createZenMoneyDataStore(
      {
        categoryCount: 0,
        lastSyncDate: null,
        accounts: [],
        selectedAccountId: '',
      },
      repo,
    );

    await store.reloadCategories();

    expect(store.categoryCount).toBe(12);
    expect(store.selectedAccountId).toBe('acc-1');
    expect(store.accountDirty).toBe(false);
  });

  it('tracks accountDirty independently from sync state', async () => {
    let resolveReload!: (value: {
      categoryCount: number;
      lastSyncDate: string | null;
      accounts: Array<{ id: string; title: string }>;
      selectedAccountId: string;
    }) => void;
    repo.reloadZenMoneyData.mockReturnValue(
      new Promise((resolve) => {
        resolveReload = resolve;
      }),
    );

    const store = createZenMoneyDataStore(
      {
        categoryCount: 0,
        lastSyncDate: null,
        accounts: [
          { id: 'acc-1', title: 'Main' },
          { id: 'acc-2', title: 'Spare' },
        ],
        selectedAccountId: 'acc-1',
      },
      repo,
    );

    const reloadPromise = store.reloadCategories();
    expect(store.syncing).toBe(true);
    expect(store.accountDirty).toBe(false);

    store.selectAccount('acc-2');
    expect(store.accountDirty).toBe(true);

    resolveReload({
      categoryCount: 3,
      lastSyncDate: '5/10/2026',
      accounts: [
        { id: 'acc-1', title: 'Main' },
        { id: 'acc-2', title: 'Spare' },
      ],
      selectedAccountId: '',
    });
    await reloadPromise;
    expect(store.syncing).toBe(false);
    expect(store.accountDirty).toBe(true);
  });

  it('persists the current account and clears accountDirty', async () => {
    const store = createZenMoneyDataStore(
      {
        categoryCount: 0,
        lastSyncDate: null,
        accounts: [
          { id: 'acc-1', title: 'Main' },
          { id: 'acc-2', title: 'Spare' },
        ],
        selectedAccountId: 'acc-1',
      },
      repo,
    );

    store.selectAccount('acc-2');
    await store.saveAccount();

    expect(repo.saveDefaultAccount).toHaveBeenCalledWith('acc-2');
    expect(store.success).toBe('Saved');
    expect(store.accountDirty).toBe(false);
  });

  it('keeps accountDirty true when the selection changes during an in-flight save', async () => {
    let resolveSave!: () => void;
    repo.saveDefaultAccount.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSave = resolve;
      }),
    );

    const store = createZenMoneyDataStore(
      {
        categoryCount: 0,
        lastSyncDate: null,
        accounts: [
          { id: 'acc-1', title: 'Main' },
          { id: 'acc-2', title: 'Spare' },
          { id: 'acc-3', title: 'Travel' },
        ],
        selectedAccountId: 'acc-1',
      },
      repo,
    );

    store.selectAccount('acc-2');
    const savePromise = store.saveAccount();
    expect(store.savingAccount).toBe(true);

    store.selectAccount('acc-3');
    resolveSave();
    await savePromise;

    expect(repo.saveDefaultAccount).toHaveBeenCalledWith('acc-2');
    expect(store.accountDirty).toBe(true);
    expect(store.success).toBe('Saved');
  });

  it('sets error when reload or saveAccount fails', async () => {
    repo.reloadZenMoneyData.mockRejectedValueOnce(new Error('reload failed'));
    repo.saveDefaultAccount.mockRejectedValueOnce(new Error('save failed'));

    const store = createZenMoneyDataStore(
      {
        categoryCount: 0,
        lastSyncDate: null,
        accounts: [
          { id: 'acc-1', title: 'Main' },
          { id: 'acc-2', title: 'Spare' },
        ],
        selectedAccountId: 'acc-1',
      },
      repo,
    );

    await store.reloadCategories();
    expect(store.error).toBe('reload failed');

    store.selectAccount('acc-2');
    await store.saveAccount();
    expect(store.error).toBe('save failed');
  });
});
