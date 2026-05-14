import type { ZenmoneyAccount } from '$lib/types';

interface ReloadZenmoneyDataResult {
  categoryCount: number;
  lastSyncDate: string | null;
  accounts: ZenmoneyAccount[];
  selectedAccountId: string;
}

interface ZenmoneyDataRepo {
  reloadZenmoneyData(): Promise<ReloadZenmoneyDataResult>;
  saveDefaultAccount(accountId: string): Promise<void>;
}

export function createZenmoneyDataStore(
  initial: {
    categoryCount: number;
    lastSyncDate: string | null;
    accounts: ZenmoneyAccount[];
    selectedAccountId: string;
  },
  repo: ZenmoneyDataRepo,
) {
  let categoryCount = $state(initial.categoryCount);
  let lastSyncDate = $state(initial.lastSyncDate);
  let accounts = $state<ZenmoneyAccount[]>(initial.accounts);
  let selectedAccountId = $state(initial.selectedAccountId);
  let savedSelectedAccountId = $state(initial.selectedAccountId);
  let syncing = $state(false);
  let savingAccount = $state(false);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);

  const hasMultipleAccounts = $derived(accounts.length > 1);
  const accountDirty = $derived(selectedAccountId !== savedSelectedAccountId);

  function selectAccount(accountId: string) {
    selectedAccountId = accountId;
  }

  async function reloadCategories() {
    syncing = true;
    error = null;
    success = null;

    try {
      const next = await repo.reloadZenmoneyData();
      categoryCount = next.categoryCount;
      lastSyncDate = next.lastSyncDate;
      accounts = next.accounts;

      if (next.selectedAccountId) {
        selectedAccountId = next.selectedAccountId;
        savedSelectedAccountId = next.selectedAccountId;
      }

      success = 'Categories reloaded';
    } catch (cause) {
      success = null;
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      syncing = false;
    }
  }

  async function saveAccount() {
    savingAccount = true;
    error = null;
    success = null;
    const accountIdToSave = selectedAccountId;

    try {
      await repo.saveDefaultAccount(accountIdToSave);
      savedSelectedAccountId = accountIdToSave;
      success = 'Saved';
    } catch (cause) {
      success = null;
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      savingAccount = false;
    }
  }

  return {
    get categoryCount() {
      return categoryCount;
    },
    get lastSyncDate() {
      return lastSyncDate;
    },
    get accounts() {
      return accounts;
    },
    get selectedAccountId() {
      return selectedAccountId;
    },
    get syncing() {
      return syncing;
    },
    get savingAccount() {
      return savingAccount;
    },
    get error() {
      return error;
    },
    get success() {
      return success;
    },
    get hasMultipleAccounts() {
      return hasMultipleAccounts;
    },
    get accountDirty() {
      return accountDirty;
    },
    selectAccount,
    reloadCategories,
    saveAccount,
  };
}
