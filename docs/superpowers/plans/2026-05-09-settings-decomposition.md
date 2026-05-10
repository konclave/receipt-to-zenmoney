# Settings Page Decomposition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `src/routes/settings/+page.svelte` into focused settings components and Svelte-native stores while preserving current behavior.

**Architecture:** Introduce a `src/lib/settings/` layer that owns page bootstrap, feature stores, and a narrow repository adapter over the existing DB/service modules. Replace the monolithic route with a composition shell that renders section components bound to those stores, keeping feature feedback local and async workflows outside the route component.

**Tech Stack:** SvelteKit 2, Svelte 5 runes and `.svelte.ts` modules, TypeScript, Vitest with jsdom and fake-indexeddb, `idb`

---

## File Map

### New files

- `src/lib/settings/settings.repository.ts` — settings-focused adapter over DB/service functions plus initial snapshot loader
- `src/lib/settings/settings.repository.test.ts` — repository contract tests
- `src/lib/settings/ai-settings.store.svelte.ts` — AI settings state, dirty tracking, model loading, save flow
- `src/lib/settings/ai-settings.store.test.ts` — AI settings store tests
- `src/lib/settings/zenmoney-connection.store.svelte.ts` — OAuth/manual token connection state and actions
- `src/lib/settings/zenmoney-connection.store.test.ts` — ZenMoney connection store tests
- `src/lib/settings/zenmoney-data.store.svelte.ts` — categories/accounts/default-account sync state and actions
- `src/lib/settings/zenmoney-data.store.test.ts` — ZenMoney data store tests
- `src/lib/settings/backup.store.svelte.ts` — backup export/import state and actions
- `src/lib/settings/backup.store.test.ts` — backup store tests
- `src/lib/settings/cleanup.store.svelte.ts` — storage stats, cleanup modal state, cleanup execution
- `src/lib/settings/cleanup.store.test.ts` — cleanup store tests
- `src/lib/settings/settings-page.store.svelte.ts` — page bootstrap store that wires feature stores together
- `src/lib/components/settings/AiSettingsSection.svelte` — AI provider/settings UI
- `src/lib/components/settings/ZenMoneyConnectionSection.svelte` — ZenMoney connect/disconnect/manual token UI
- `src/lib/components/settings/ZenMoneyDataSection.svelte` — category sync plus default-account UI
- `src/lib/components/settings/BackupRestoreSection.svelte` — export/import UI
- `src/lib/components/settings/StorageCleanupSection.svelte` — storage stats and cleanup UI
- `src/lib/components/settings/settings-sections.test.ts` — smoke tests for the extracted settings sections

### Modified files

- `src/routes/settings/+page.svelte` — replace feature logic with composition shell
- `src/routes/settings/version.test.ts` — update route assertions to match the new composition shell

## Task 1: Create the settings repository contract

**Files:**
- Create: `src/lib/settings/settings.repository.ts`
- Test: `src/lib/settings/settings.repository.test.ts`

- [ ] **Step 1: Write the failing repository tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('$lib/db/settings', () => ({
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
}));
vi.mock('$lib/db/categories', () => ({
  getCategories: vi.fn(),
  saveCategories: vi.fn(),
}));
vi.mock('$lib/db/accounts', () => ({
  getAccounts: vi.fn(),
  saveAccounts: vi.fn(),
}));
vi.mock('$lib/db/instruments', () => ({
  saveInstruments: vi.fn(),
}));
vi.mock('$lib/db/transactions', () => ({
  deleteTransactionsByPeriod: vi.fn(),
}));
vi.mock('$lib/db/receipt-images', () => ({
  bulkDeleteReceiptImages: vi.fn(),
}));
vi.mock('$lib/services/backup', () => ({
  exportBackup: vi.fn(),
  importBackup: vi.fn(),
  exportBackupForPeriod: vi.fn(),
}));
vi.mock('$lib/services/storage-stats', () => ({
  getStorageStats: vi.fn(),
}));
vi.mock('$lib/services/zenmoney', () => ({
  syncDiff: vi.fn(),
  mapResponseToCategories: vi.fn(),
}));
vi.mock('$lib/services/zenmoney-access', () => ({
  clearZenMoneyAccessToken: vi.fn(),
}));
vi.mock('$lib/services/zenmoney-client', () => ({
  runZenMoneyRequestWithStoredToken: vi.fn(),
}));

import { getSettings, saveSettings } from '$lib/db/settings';
import { getCategories, saveCategories } from '$lib/db/categories';
import { getAccounts, saveAccounts } from '$lib/db/accounts';
import { saveInstruments } from '$lib/db/instruments';
import { getStorageStats } from '$lib/services/storage-stats';
import { syncDiff, mapResponseToCategories } from '$lib/services/zenmoney';
import { runZenMoneyRequestWithStoredToken } from '$lib/services/zenmoney-client';
import { createSettingsRepository } from './settings.repository';

describe('createSettingsRepository', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('loads one normalized snapshot for the settings page', async () => {
    vi.mocked(getSettings).mockResolvedValue({
      claudeApiKey: 'sk-ant',
      zenmoneyToken: 'zm-token',
      zenmoneyAccessToken: '',
      zenmoneyAccessTokenExpiresAt: 0,
      zenmoneyServerTimestamp: 0,
      zenmoneyAccountId: 'acc-1',
      zenmoneyUserId: 7,
      aiProvider: 'openrouter',
      openrouterApiKey: 'sk-or',
      openrouterModel: 'anthropic/claude-sonnet-4.6',
    });
    vi.mocked(getCategories).mockResolvedValue([
      { id: 'cat-1', title: 'Food', parentId: null, syncedAt: 1746748800000 },
    ]);
    vi.mocked(getAccounts).mockResolvedValue([
      { id: 'acc-2', title: 'Savings' },
      { id: 'acc-1', title: 'Checking' },
    ]);
    vi.mocked(getStorageStats).mockResolvedValue({
      totalBytes: 42,
      byYear: [{ year: 2026, bytes: 42, txCount: 1 }],
    });

    const repo = createSettingsRepository();
    const snapshot = await repo.loadPageSnapshot({ oauthEnabled: true });

    expect(snapshot.oauthEnabled).toBe(true);
    expect(snapshot.settings.aiProvider).toBe('openrouter');
    expect(snapshot.categoryCount).toBe(1);
    expect(snapshot.lastSyncDate).toBe(new Date(1746748800000).toLocaleDateString());
    expect(snapshot.accounts.map((account) => account.title)).toEqual([
      'Checking',
      'Savings',
    ]);
    expect(snapshot.storageStats?.totalBytes).toBe(42);
  });

  it('persists synced categories, accounts, instruments, and account auto-selection', async () => {
    vi.mocked(runZenMoneyRequestWithStoredToken).mockImplementation(async (callback) =>
      callback('stored-token'),
    );
    vi.mocked(syncDiff).mockResolvedValue({
      serverTimestamp: 99,
      user: [{ id: 321 }],
      instrument: [{ id: 1, shortTitle: 'EUR' }],
      tag: [],
      account: [{ id: 'acc-9', title: 'Main account' }],
    });
    vi.mocked(mapResponseToCategories).mockReturnValue([
      { id: 'cat-1', title: 'Food', parentId: null, syncedAt: 1746748800000 },
    ]);

    const repo = createSettingsRepository();
    const result = await repo.reloadZenMoneyData();

    expect(saveCategories).toHaveBeenCalledTimes(1);
    expect(saveAccounts).toHaveBeenCalledWith([{ id: 'acc-9', title: 'Main account' }]);
    expect(saveInstruments).toHaveBeenCalledWith([{ id: 1, shortTitle: 'EUR' }]);
    expect(saveSettings).toHaveBeenCalledWith({
      zenmoneyServerTimestamp: 99,
      zenmoneyUserId: 321,
      zenmoneyAccountId: 'acc-9',
    });
    expect(result.selectedAccountId).toBe('acc-9');
  });
});
```

- [ ] **Step 2: Run the repository tests to verify they fail**

Run: `pnpm exec vitest run src/lib/settings/settings.repository.test.ts`

Expected: FAIL with `Cannot find module './settings.repository'` or missing export errors.

- [ ] **Step 3: Write the minimal repository implementation**

```ts
import { getSettings, saveSettings } from '$lib/db/settings';
import { getCategories, saveCategories } from '$lib/db/categories';
import { getAccounts, saveAccounts } from '$lib/db/accounts';
import { saveInstruments } from '$lib/db/instruments';
import { deleteTransactionsByPeriod } from '$lib/db/transactions';
import { bulkDeleteReceiptImages } from '$lib/db/receipt-images';
import {
  exportBackup,
  importBackup,
  exportBackupForPeriod,
} from '$lib/services/backup';
import { getStorageStats, type StorageStats } from '$lib/services/storage-stats';
import { syncDiff, mapResponseToCategories } from '$lib/services/zenmoney';
import { clearZenMoneyAccessToken } from '$lib/services/zenmoney-access';
import { runZenMoneyRequestWithStoredToken } from '$lib/services/zenmoney-client';
import type { Settings, ZenMoneyAccount } from '$lib/types';

export interface SettingsPageSnapshot {
  oauthEnabled: boolean;
  settings: Settings;
  categoryCount: number;
  lastSyncDate: string | null;
  accounts: ZenMoneyAccount[];
  storageStats: StorageStats | null;
}

export interface SettingsRepository {
  loadPageSnapshot(input: { oauthEnabled: boolean }): Promise<SettingsPageSnapshot>;
  fetchOpenRouterModels(): Promise<Array<{ id: string; name: string }>>;
  saveAiSettings(input: {
    aiProvider: Settings['aiProvider'];
    claudeApiKey: string;
    openrouterApiKey: string;
    openrouterModel: string;
  }): Promise<void>;
  saveManualZenMoneyToken(token: string): Promise<void>;
  disconnectZenMoney(): Promise<void>;
  reloadZenMoneyData(): Promise<{
    categoryCount: number;
    lastSyncDate: string;
    accounts: ZenMoneyAccount[];
    selectedAccountId: string;
  }>;
  saveDefaultAccount(accountId: string): Promise<void>;
  exportBackup: typeof exportBackup;
  importBackup: typeof importBackup;
  exportBackupForPeriod: typeof exportBackupForPeriod;
  getStorageStats(): Promise<StorageStats>;
  deleteTransactionsByPeriod(period: number | 'all'): Promise<string[]>;
  bulkDeleteReceiptImages(ids: string[]): Promise<void>;
  clearZenMoneyAccessToken(): Promise<void>;
}

export function createSettingsRepository(): SettingsRepository {
  return {
    async loadPageSnapshot({ oauthEnabled }) {
      const [settings, categories, accounts, storageStats] = await Promise.all([
        getSettings(),
        getCategories(),
        getAccounts(),
        getStorageStats().catch(() => null),
      ]);

      const sortedAccounts = [...accounts].sort((a, b) => a.title.localeCompare(b.title));
      return {
        oauthEnabled,
        settings,
        categoryCount: categories.length,
        lastSyncDate: categories.length
          ? new Date(categories[0].syncedAt).toLocaleDateString()
          : null,
        accounts: sortedAccounts,
        storageStats,
      };
    },
    async fetchOpenRouterModels() {
      const response = await fetch('https://openrouter.ai/api/v1/models');
      if (!response.ok) throw new Error(`OpenRouter model lookup failed: ${response.status}`);
      const json: {
        data: Array<{
          id: string;
          name: string;
          pricing?: { prompt?: string; completion?: string };
          architecture?: {
            modality?: string;
            input_modalities?: string[];
          };
        }>;
      } = await response.json();

      return json.data
        .filter(
          (model) =>
            model.architecture?.input_modalities?.includes('image') ||
            model.architecture?.modality?.includes('image'),
        )
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((model) => {
          const free =
            model.pricing?.prompt === '0' && model.pricing?.completion === '0';
          return {
            id: model.id,
            name: `${free ? '🆓 ' : ''}${model.name || model.id}`,
          };
        });
    },
    async saveAiSettings(input) {
      await saveSettings(input);
    },
    async saveManualZenMoneyToken(token) {
      await saveSettings({ zenmoneyToken: token });
    },
    async disconnectZenMoney() {
      await fetch('/api/zenmoney/logout', {
        method: 'POST',
        credentials: 'include',
      }).catch(() => {});
      await clearZenMoneyAccessToken();
      await saveSettings({ zenmoneyToken: '' });
    },
    async reloadZenMoneyData() {
      const response = await runZenMoneyRequestWithStoredToken((token) => syncDiff(token, 0));
      const categories = mapResponseToCategories(response);
      const sortedAccounts = [...response.account].sort((a, b) => a.title.localeCompare(b.title));
      const selectedAccountId = sortedAccounts.length === 1 ? sortedAccounts[0].id : '';

      await Promise.all([
        saveCategories(categories),
        saveAccounts(response.account),
        saveInstruments(response.instrument),
        saveSettings({
          zenmoneyServerTimestamp: response.serverTimestamp,
          zenmoneyUserId: response.user[0]?.id ?? 0,
          ...(selectedAccountId ? { zenmoneyAccountId: selectedAccountId } : {}),
        }),
      ]);

      return {
        categoryCount: categories.length,
        lastSyncDate: new Date().toLocaleDateString(),
        accounts: sortedAccounts,
        selectedAccountId,
      };
    },
    async saveDefaultAccount(accountId) {
      await saveSettings({ zenmoneyAccountId: accountId });
    },
    exportBackup,
    importBackup,
    exportBackupForPeriod,
    getStorageStats,
    deleteTransactionsByPeriod,
    bulkDeleteReceiptImages,
    clearZenMoneyAccessToken,
  };
}
```

- [ ] **Step 4: Run the repository tests to verify they pass**

Run: `pnpm exec vitest run src/lib/settings/settings.repository.test.ts`

Expected: PASS for the snapshot-loading and ZenMoney reload contract tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/settings/settings.repository.ts src/lib/settings/settings.repository.test.ts
git commit -m "refactor: add settings repository"
```

## Task 2: Extract the AI settings store

**Files:**
- Create: `src/lib/settings/ai-settings.store.svelte.ts`
- Test: `src/lib/settings/ai-settings.store.test.ts`

- [ ] **Step 1: Write the failing AI settings store tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAiSettingsStore } from './ai-settings.store.svelte';

describe('createAiSettingsStore', () => {
  const repo = {
    saveAiSettings: vi.fn(),
    fetchOpenRouterModels: vi.fn(),
  };

  beforeEach(() => {
    repo.saveAiSettings.mockReset();
    repo.fetchOpenRouterModels.mockReset();
  });

  it('tracks dirty state against the saved snapshot', () => {
    const store = createAiSettingsStore(
      {
        aiProvider: 'anthropic',
        claudeApiKey: '',
        openrouterApiKey: '',
        openrouterModel: 'anthropic/claude-sonnet-4.6',
      },
      repo,
    );

    expect(store.dirty).toBe(false);
    store.claudeApiKey = 'sk-ant-new';
    expect(store.dirty).toBe(true);
  });

  it('keeps the saved model visible when OpenRouter does not return it', async () => {
    repo.fetchOpenRouterModels.mockResolvedValue([
      { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini' },
    ]);
    const store = createAiSettingsStore(
      {
        aiProvider: 'openrouter',
        claudeApiKey: '',
        openrouterApiKey: 'sk-or',
        openrouterModel: 'anthropic/claude-sonnet-4.6',
      },
      repo,
    );

    await store.loadModels();

    expect(store.models[0]).toEqual({
      id: 'anthropic/claude-sonnet-4.6',
      name: 'anthropic/claude-sonnet-4.6',
    });
    expect(store.modelsLoading).toBe(false);
  });

  it('saves the current AI settings and refreshes the saved snapshot', async () => {
    const store = createAiSettingsStore(
      {
        aiProvider: 'anthropic',
        claudeApiKey: '',
        openrouterApiKey: '',
        openrouterModel: 'anthropic/claude-sonnet-4.6',
      },
      repo,
    );

    store.setProvider('openrouter');
    store.openrouterApiKey = 'sk-or-updated';
    await store.save();

    expect(repo.saveAiSettings).toHaveBeenCalledWith({
      aiProvider: 'openrouter',
      claudeApiKey: '',
      openrouterApiKey: 'sk-or-updated',
      openrouterModel: 'anthropic/claude-sonnet-4.6',
    });
    expect(store.success).toBe('Saved');
    expect(store.dirty).toBe(false);
  });
});
```

- [ ] **Step 2: Run the AI settings tests to verify they fail**

Run: `pnpm exec vitest run src/lib/settings/ai-settings.store.test.ts`

Expected: FAIL with missing module/export errors for `createAiSettingsStore`.

- [ ] **Step 3: Write the minimal AI settings store**

```ts
import type { Settings } from '$lib/types';

export interface OpenRouterModelOption {
  id: string;
  name: string;
}

interface AiSettingsRepo {
  saveAiSettings(input: {
    aiProvider: Settings['aiProvider'];
    claudeApiKey: string;
    openrouterApiKey: string;
    openrouterModel: string;
  }): Promise<void>;
  fetchOpenRouterModels(): Promise<OpenRouterModelOption[]>;
}

export function createAiSettingsStore(
  initial: Pick<
    Settings,
    'aiProvider' | 'claudeApiKey' | 'openrouterApiKey' | 'openrouterModel'
  >,
  repo: AiSettingsRepo,
) {
  let provider = $state(initial.aiProvider);
  let claudeApiKey = $state(initial.claudeApiKey);
  let openrouterApiKey = $state(initial.openrouterApiKey);
  let openrouterModel = $state(initial.openrouterModel);
  let saved = $state({ ...initial });
  let models = $state<OpenRouterModelOption[]>([]);
  let modelsLoading = $state(false);
  let modelsFailed = $state(false);
  let saving = $state(false);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);

  const dirty = $derived(
    provider !== saved.aiProvider ||
      claudeApiKey !== saved.claudeApiKey ||
      openrouterApiKey !== saved.openrouterApiKey ||
      openrouterModel !== saved.openrouterModel,
  );

  async function loadModels() {
    modelsLoading = true;
    modelsFailed = false;
    try {
      const next = await repo.fetchOpenRouterModels();
      models = next.some((model) => model.id === openrouterModel)
        ? next
        : [{ id: openrouterModel, name: openrouterModel }, ...next];
    } catch (cause) {
      modelsFailed = true;
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      modelsLoading = false;
    }
  }

  async function save() {
    saving = true;
    error = null;
    try {
      await repo.saveAiSettings({
        aiProvider: provider,
        claudeApiKey,
        openrouterApiKey,
        openrouterModel,
      });
      saved = {
        aiProvider: provider,
        claudeApiKey,
        openrouterApiKey,
        openrouterModel,
      };
      success = 'Saved';
    } catch (cause) {
      error = cause instanceof Error ? cause.message : String(cause);
    } finally {
      saving = false;
    }
  }

  return {
    get provider() {
      return provider;
    },
    get claudeApiKey() {
      return claudeApiKey;
    },
    set claudeApiKey(value: string) {
      claudeApiKey = value;
    },
    get openrouterApiKey() {
      return openrouterApiKey;
    },
    set openrouterApiKey(value: string) {
      openrouterApiKey = value;
    },
    get openrouterModel() {
      return openrouterModel;
    },
    set openrouterModel(value: string) {
      openrouterModel = value;
    },
    get models() {
      return models;
    },
    get modelsLoading() {
      return modelsLoading;
    },
    get modelsFailed() {
      return modelsFailed;
    },
    get saving() {
      return saving;
    },
    get error() {
      return error;
    },
    get success() {
      return success;
    },
    get dirty() {
      return dirty;
    },
    setProvider(value: Settings['aiProvider']) {
      provider = value;
    },
    loadModels,
    save,
  };
}
```

- [ ] **Step 4: Run the AI settings tests to verify they pass**

Run: `pnpm exec vitest run src/lib/settings/ai-settings.store.test.ts`

Expected: PASS for dirty state, saved-model fallback, and save-flow behavior.

- [ ] **Step 5: Commit**

```bash
git add src/lib/settings/ai-settings.store.svelte.ts src/lib/settings/ai-settings.store.test.ts
git commit -m "refactor: extract ai settings store"
```

## Task 3: Extract the ZenMoney connection and data stores

**Files:**
- Create: `src/lib/settings/zenmoney-connection.store.svelte.ts`
- Create: `src/lib/settings/zenmoney-data.store.svelte.ts`
- Test: `src/lib/settings/zenmoney-connection.store.test.ts`
- Test: `src/lib/settings/zenmoney-data.store.test.ts`

- [ ] **Step 1: Write the failing ZenMoney store tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createZenMoneyConnectionStore } from './zenmoney-connection.store.svelte';
import { createZenMoneyDataStore } from './zenmoney-data.store.svelte';

describe('createZenMoneyConnectionStore', () => {
  const repo = {
    saveManualZenMoneyToken: vi.fn(),
    disconnectZenMoney: vi.fn(),
  };

  beforeEach(() => {
    repo.saveManualZenMoneyToken.mockReset();
    repo.disconnectZenMoney.mockReset();
  });

  it('reports connected when a saved manual or access token exists', () => {
    const store = createZenMoneyConnectionStore(
      {
        zenmoneyToken: '',
        zenmoneyAccessToken: 'oauth-token',
      },
      repo,
    );

    expect(store.connected).toBe(true);
  });

  it('saves a pasted manual token and updates the saved snapshot', async () => {
    const store = createZenMoneyConnectionStore(
      {
        zenmoneyToken: '',
        zenmoneyAccessToken: '',
      },
      repo,
    );

    store.manualToken = 'zm-token-123';
    await store.saveManualToken();

    expect(repo.saveManualZenMoneyToken).toHaveBeenCalledWith('zm-token-123');
    expect(store.success).toBe('Saved');
    expect(store.connected).toBe(true);
  });
});

describe('createZenMoneyDataStore', () => {
  const repo = {
    reloadZenMoneyData: vi.fn(),
    saveDefaultAccount: vi.fn(),
  };

  beforeEach(() => {
    repo.reloadZenMoneyData.mockReset();
    repo.saveDefaultAccount.mockReset();
  });

  it('auto-selects and saves the only account returned by sync', async () => {
    repo.reloadZenMoneyData.mockResolvedValue({
      categoryCount: 3,
      lastSyncDate: '5/9/2026',
      accounts: [{ id: 'acc-1', title: 'Checking' }],
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

    expect(store.categoryCount).toBe(3);
    expect(store.selectedAccountId).toBe('acc-1');
    expect(store.success).toBe('Categories reloaded');
  });

  it('tracks accountDirty independently from category sync', async () => {
    const store = createZenMoneyDataStore(
      {
        categoryCount: 2,
        lastSyncDate: '5/8/2026',
        accounts: [
          { id: 'acc-1', title: 'Checking' },
          { id: 'acc-2', title: 'Savings' },
        ],
        selectedAccountId: 'acc-1',
      },
      repo,
    );

    store.selectAccount('acc-2');
    expect(store.accountDirty).toBe(true);

    await store.saveAccount();

    expect(repo.saveDefaultAccount).toHaveBeenCalledWith('acc-2');
    expect(store.accountDirty).toBe(false);
  });
});
```

- [ ] **Step 2: Run the ZenMoney store tests to verify they fail**

Run: `pnpm exec vitest run src/lib/settings/zenmoney-connection.store.test.ts src/lib/settings/zenmoney-data.store.test.ts`

Expected: FAIL with missing module/export errors.

- [ ] **Step 3: Write the minimal ZenMoney stores**

```ts
export function createZenMoneyConnectionStore(
  initial: {
    zenmoneyToken: string;
    zenmoneyAccessToken: string;
  },
  repo: {
    saveManualZenMoneyToken(token: string): Promise<void>;
    disconnectZenMoney(): Promise<void>;
  },
) {
  let manualToken = $state(initial.zenmoneyToken);
  let savedManualToken = $state(initial.zenmoneyToken);
  let accessToken = $state(initial.zenmoneyAccessToken);
  let saving = $state(false);
  let disconnecting = $state(false);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);
  const connected = $derived(savedManualToken.length > 0 || accessToken.length > 0);

  return {
    get manualToken() {
      return manualToken;
    },
    set manualToken(value: string) {
      manualToken = value;
    },
    get connected() {
      return connected;
    },
    get saving() {
      return saving;
    },
    get disconnecting() {
      return disconnecting;
    },
    get error() {
      return error;
    },
    get success() {
      return success;
    },
    startOAuthFlow() {
      window.location.href = '/api/zenmoney/oauth/start';
    },
    async saveManualToken() {
      saving = true;
      error = null;
      try {
        await repo.saveManualZenMoneyToken(manualToken);
        savedManualToken = manualToken;
        success = 'Saved';
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause);
      } finally {
        saving = false;
      }
    },
    async disconnect() {
      disconnecting = true;
      error = null;
      try {
        await repo.disconnectZenMoney();
        manualToken = '';
        savedManualToken = '';
        accessToken = '';
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause);
      } finally {
        disconnecting = false;
      }
    },
  };
}
```

```ts
import type { ZenMoneyAccount } from '$lib/types';

export function createZenMoneyDataStore(
  initial: {
    categoryCount: number;
    lastSyncDate: string | null;
    accounts: ZenMoneyAccount[];
    selectedAccountId: string;
  },
  repo: {
    reloadZenMoneyData(): Promise<{
      categoryCount: number;
      lastSyncDate: string;
      accounts: ZenMoneyAccount[];
      selectedAccountId: string;
    }>;
    saveDefaultAccount(accountId: string): Promise<void>;
  },
) {
  let categoryCount = $state(initial.categoryCount);
  let lastSyncDate = $state(initial.lastSyncDate);
  let accounts = $state(initial.accounts);
  let selectedAccountId = $state(initial.selectedAccountId);
  let savedAccountId = $state(initial.selectedAccountId);
  let syncing = $state(false);
  let savingAccount = $state(false);
  let error = $state<string | null>(null);
  let success = $state<string | null>(null);
  const hasMultipleAccounts = $derived(accounts.length > 1);
  const accountDirty = $derived(selectedAccountId !== savedAccountId);

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
    get hasMultipleAccounts() {
      return hasMultipleAccounts;
    },
    get accountDirty() {
      return accountDirty;
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
    selectAccount(accountId: string) {
      selectedAccountId = accountId;
    },
    async reloadCategories() {
      syncing = true;
      error = null;
      try {
        const result = await repo.reloadZenMoneyData();
        categoryCount = result.categoryCount;
        lastSyncDate = result.lastSyncDate;
        accounts = result.accounts;
        if (result.selectedAccountId) {
          selectedAccountId = result.selectedAccountId;
          savedAccountId = result.selectedAccountId;
        }
        success = 'Categories reloaded';
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause);
      } finally {
        syncing = false;
      }
    },
    async saveAccount() {
      savingAccount = true;
      error = null;
      try {
        await repo.saveDefaultAccount(selectedAccountId);
        savedAccountId = selectedAccountId;
        success = 'Saved';
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause);
      } finally {
        savingAccount = false;
      }
    },
  };
}
```

- [ ] **Step 4: Run the ZenMoney store tests to verify they pass**

Run: `pnpm exec vitest run src/lib/settings/zenmoney-connection.store.test.ts src/lib/settings/zenmoney-data.store.test.ts`

Expected: PASS for connected-state, manual-token save, account auto-select, and account save behavior.

- [ ] **Step 5: Commit**

```bash
git add \
  src/lib/settings/zenmoney-connection.store.svelte.ts \
  src/lib/settings/zenmoney-connection.store.test.ts \
  src/lib/settings/zenmoney-data.store.svelte.ts \
  src/lib/settings/zenmoney-data.store.test.ts
git commit -m "refactor: extract zenmoney settings stores"
```

## Task 4: Extract the backup and cleanup stores

**Files:**
- Create: `src/lib/settings/backup.store.svelte.ts`
- Create: `src/lib/settings/cleanup.store.svelte.ts`
- Test: `src/lib/settings/backup.store.test.ts`
- Test: `src/lib/settings/cleanup.store.test.ts`

- [ ] **Step 1: Write the failing backup and cleanup store tests**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createBackupStore } from './backup.store.svelte';
import { createCleanupStore } from './cleanup.store.svelte';

describe('createBackupStore', () => {
  const repo = {
    exportBackup: vi.fn(),
    importBackup: vi.fn(),
  };
  const refreshStats = vi.fn();

  beforeEach(() => {
    repo.exportBackup.mockReset();
    repo.importBackup.mockReset();
    refreshStats.mockReset();
  });

  it('reports import success and refreshes storage stats', async () => {
    repo.importBackup.mockResolvedValue({ imported: 3, skipped: 1 });
    const store = createBackupStore(repo, { refreshStats });

    await store.importFile(new File(['{}'], 'backup.rzm.gz'));

    expect(store.status).toBe('Imported 3 new, skipped 1 duplicate');
    expect(refreshStats).toHaveBeenCalledTimes(1);
  });
});

describe('createCleanupStore', () => {
  const repo = {
    getStorageStats: vi.fn(),
    exportBackupForPeriod: vi.fn(),
    deleteTransactionsByPeriod: vi.fn(),
    bulkDeleteReceiptImages: vi.fn(),
  };

  beforeEach(() => {
    repo.getStorageStats.mockReset();
    repo.exportBackupForPeriod.mockReset();
    repo.deleteTransactionsByPeriod.mockReset();
    repo.bulkDeleteReceiptImages.mockReset();
  });

  it('builds an all-years cleanup target from storage stats', async () => {
    repo.getStorageStats.mockResolvedValue({
      totalBytes: 300,
      byYear: [
        { year: 2024, bytes: 100, txCount: 2 },
        { year: 2025, bytes: 200, txCount: 3 },
      ],
    });

    const store = createCleanupStore(repo);
    await store.refreshStats();
    store.openCleanupModal();
    store.selectCleanupTarget('all');

    expect(store.cleanupConfirmTarget).toEqual({
      period: 'all',
      txCount: 5,
      bytes: 300,
    });
  });

  it('deletes transactions and images, then refreshes stats', async () => {
    repo.getStorageStats
      .mockResolvedValueOnce({
        totalBytes: 100,
        byYear: [{ year: 2026, bytes: 100, txCount: 2 }],
      })
      .mockResolvedValueOnce({
        totalBytes: 0,
        byYear: [],
      });
    repo.deleteTransactionsByPeriod.mockResolvedValue(['tx-1', 'tx-2']);

    const store = createCleanupStore(repo);
    await store.refreshStats();
    store.selectCleanupTarget(2026);
    await store.confirmCleanup({ withBackup: false });

    expect(repo.deleteTransactionsByPeriod).toHaveBeenCalledWith(2026);
    expect(repo.bulkDeleteReceiptImages).toHaveBeenCalledWith(['tx-1', 'tx-2']);
    expect(store.storageStats?.totalBytes).toBe(0);
  });
});
```

- [ ] **Step 2: Run the backup and cleanup store tests to verify they fail**

Run: `pnpm exec vitest run src/lib/settings/backup.store.test.ts src/lib/settings/cleanup.store.test.ts`

Expected: FAIL with missing module/export errors.

- [ ] **Step 3: Write the minimal backup and cleanup stores**

```ts
export function createBackupStore(
  repo: {
    exportBackup(): Promise<{ blob: Blob; count: number }>;
    importBackup(file: File): Promise<{ imported: number; skipped: number }>;
  },
  effects: { refreshStats(): Promise<void> },
) {
  let exporting = $state(false);
  let importing = $state(false);
  let status = $state<string | null>(null);
  let error = $state<string | null>(null);

  async function shareOrDownload(blob: Blob, filename: string) {
    const shareFile = new File([blob], filename, {
      type: 'application/gzip',
    });
    let shared = false;
    if (navigator.canShare?.({ files: [shareFile] })) {
      try {
        await navigator.share({
          files: [shareFile],
          title: 'ZenMoney Backup',
        });
        shared = true;
      } catch (shareError) {
        if (shareError instanceof Error && shareError.name === 'AbortError') return false;
      }
    }
    if (!shared) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    }
    return true;
  }

  return {
    get exporting() {
      return exporting;
    },
    get importing() {
      return importing;
    },
    get status() {
      return status;
    },
    get error() {
      return error;
    },
    async exportAll() {
      exporting = true;
      error = null;
      try {
        const { blob, count } = await repo.exportBackup();
        const date = new Date().toISOString().slice(0, 10);
        const completed = await shareOrDownload(blob, `rzm-backup-${date}.rzm.gz`);
        if (!completed) return;
        status = `Exported ${count} transaction${count === 1 ? '' : 's'}`;
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause);
      } finally {
        exporting = false;
      }
    },
    async importFile(file: File) {
      importing = true;
      error = null;
      try {
        const { imported, skipped } = await repo.importBackup(file);
        status = `Imported ${imported} new, skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}`;
        await effects.refreshStats();
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause);
      } finally {
        importing = false;
      }
    },
  };
}
```

```ts
import { formatBytes, type StorageStats } from '$lib/services/storage-stats';

export function createCleanupStore(repo: {
  getStorageStats(): Promise<StorageStats>;
  exportBackupForPeriod(period: number | 'all'): Promise<{ blob: Blob }>;
  deleteTransactionsByPeriod(period: number | 'all'): Promise<string[]>;
  bulkDeleteReceiptImages(ids: string[]): Promise<void>;
}, initialStats: StorageStats | null = null) {
  let storageStats = $state<StorageStats | null>(initialStats);
  let cleanupModalOpen = $state(false);
  let cleanupConfirmTarget = $state<{
    period: number | 'all';
    txCount: number;
    bytes: number;
  } | null>(null);
  let loadingStats = $state(false);
  let cleaning = $state(false);
  let status = $state<string | null>(null);
  let error = $state<string | null>(null);

  async function shareOrDownload(blob: Blob, filename: string) {
    const shareFile = new File([blob], filename, {
      type: 'application/gzip',
    });
    let shared = false;
    if (navigator.canShare?.({ files: [shareFile] })) {
      try {
        await navigator.share({
          files: [shareFile],
          title: 'ZenMoney Backup',
        });
        shared = true;
      } catch (shareError) {
        if (shareError instanceof Error && shareError.name === 'AbortError') return false;
      }
    }
    if (!shared) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    }
    return true;
  }

  return {
    get storageStats() {
      return storageStats;
    },
    get cleanupModalOpen() {
      return cleanupModalOpen;
    },
    get cleanupConfirmTarget() {
      return cleanupConfirmTarget;
    },
    get loadingStats() {
      return loadingStats;
    },
    get cleaning() {
      return cleaning;
    },
    get status() {
      return status;
    },
    get error() {
      return error;
    },
    async refreshStats() {
      loadingStats = true;
      storageStats = await repo.getStorageStats();
      loadingStats = false;
    },
    openCleanupModal() {
      cleanupModalOpen = true;
    },
    closeModals() {
      cleanupModalOpen = false;
      cleanupConfirmTarget = null;
    },
    selectCleanupTarget(period: number | 'all') {
      cleanupModalOpen = false;
      if (!storageStats) return;
      if (period === 'all') {
        cleanupConfirmTarget = {
          period: 'all',
          txCount: storageStats.byYear.reduce((sum, year) => sum + year.txCount, 0),
          bytes: storageStats.totalBytes,
        };
        return;
      }
      const year = storageStats.byYear.find((entry) => entry.year === period);
      if (!year) return;
      cleanupConfirmTarget = {
        period,
        txCount: year.txCount,
        bytes: year.bytes,
      };
    },
    async confirmCleanup({ withBackup }: { withBackup: boolean }) {
      if (!cleanupConfirmTarget) return;
      cleaning = true;
      error = null;
      try {
        if (withBackup) {
          const { blob } = await repo.exportBackupForPeriod(cleanupConfirmTarget.period);
          const date = new Date().toISOString().slice(0, 10);
          const filename =
            cleanupConfirmTarget.period === 'all'
              ? `rzm-backup-all-${date}.rzm.gz`
              : `rzm-backup-${cleanupConfirmTarget.period}.rzm.gz`;
          const completed = await shareOrDownload(blob, filename);
          if (!completed) return;
        }
        const deletedIds = await repo.deleteTransactionsByPeriod(cleanupConfirmTarget.period);
        await repo.bulkDeleteReceiptImages(deletedIds);
        await this.refreshStats();
        status = `Deleted ${cleanupConfirmTarget.txCount} transactions · freed ~${formatBytes(cleanupConfirmTarget.bytes)}`;
        cleanupConfirmTarget = null;
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause);
      } finally {
        cleaning = false;
      }
    },
  };
}
```

- [ ] **Step 4: Run the backup and cleanup store tests to verify they pass**

Run: `pnpm exec vitest run src/lib/settings/backup.store.test.ts src/lib/settings/cleanup.store.test.ts`

Expected: PASS for import refresh, cleanup-target selection, and delete flow.

- [ ] **Step 5: Commit**

```bash
git add \
  src/lib/settings/backup.store.svelte.ts \
  src/lib/settings/backup.store.test.ts \
  src/lib/settings/cleanup.store.svelte.ts \
  src/lib/settings/cleanup.store.test.ts
git commit -m "refactor: extract backup and cleanup stores"
```

## Task 5: Build the page store, section components, and route shell

**Files:**
- Create: `src/lib/settings/settings-page.store.svelte.ts`
- Create: `src/lib/components/settings/AiSettingsSection.svelte`
- Create: `src/lib/components/settings/ZenMoneyConnectionSection.svelte`
- Create: `src/lib/components/settings/ZenMoneyDataSection.svelte`
- Create: `src/lib/components/settings/BackupRestoreSection.svelte`
- Create: `src/lib/components/settings/StorageCleanupSection.svelte`
- Test: `src/lib/components/settings/settings-sections.test.ts`
- Modify: `src/routes/settings/+page.svelte`
- Modify: `src/routes/settings/version.test.ts`

- [ ] **Step 1: Write the failing composition and section tests**

```ts
import { describe, expect, it, vi } from 'vitest';
import { mount, unmount } from 'svelte';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ZenMoneyDataSection from './ZenMoneyDataSection.svelte';

describe('settings sections', () => {
  it('hides the default-account controls unless multiple accounts exist', () => {
    const target = document.createElement('div');
    const component = mount(ZenMoneyDataSection, {
      target,
      props: {
        store: {
          categoryCount: 1,
          lastSyncDate: '5/9/2026',
          accounts: [{ id: 'acc-1', title: 'Checking' }],
          selectedAccountId: 'acc-1',
          hasMultipleAccounts: false,
          accountDirty: false,
          syncing: false,
          savingAccount: false,
          error: null,
          success: null,
          reloadCategories: vi.fn(),
          selectAccount: vi.fn(),
          saveAccount: vi.fn(),
        },
      },
    });

    expect(target.textContent).not.toContain('Default Account');
    unmount(component);
  });
});

describe('settings route composition', () => {
  it('renders settings via extracted section components and page store', () => {
    const route = readFileSync(
      resolve(process.cwd(), 'src/routes/settings/+page.svelte'),
      'utf8',
    );

    expect(route).toContain('createSettingsPageStore');
    expect(route).toContain('AiSettingsSection');
    expect(route).toContain('ZenMoneyConnectionSection');
    expect(route).toContain('ZenMoneyDataSection');
    expect(route).toContain('BackupRestoreSection');
    expect(route).toContain('StorageCleanupSection');
    expect(route).not.toContain('handleReloadCategories');
    expect(route).not.toContain('handleCleanupConfirm');
    expect(route).not.toContain('fetch("https://openrouter.ai/api/v1/models")');
  });
});
```

- [ ] **Step 2: Run the composition and section tests to verify they fail**

Run: `pnpm exec vitest run src/lib/components/settings/settings-sections.test.ts src/routes/settings/version.test.ts`

Expected: FAIL with missing components/page store or legacy route content still present.

- [ ] **Step 3: Implement the page store, extracted sections, and route shell**

```ts
import { createSettingsRepository } from './settings.repository';
import { createAiSettingsStore } from './ai-settings.store.svelte';
import { createZenMoneyConnectionStore } from './zenmoney-connection.store.svelte';
import { createZenMoneyDataStore } from './zenmoney-data.store.svelte';
import { createBackupStore } from './backup.store.svelte';
import { createCleanupStore } from './cleanup.store.svelte';

export function createSettingsPageStore(input: { oauthEnabled: boolean }) {
  const repo = createSettingsRepository();
  let ready = $state(false);
  let loadError = $state<string | null>(null);
  let ai = $state<ReturnType<typeof createAiSettingsStore> | null>(null);
  let zenmoneyConnection = $state<ReturnType<typeof createZenMoneyConnectionStore> | null>(null);
  let zenmoneyData = $state<ReturnType<typeof createZenMoneyDataStore> | null>(null);
  let cleanup = $state<ReturnType<typeof createCleanupStore> | null>(null);
  let backup = $state<ReturnType<typeof createBackupStore> | null>(null);

  async function load() {
    try {
      const snapshot = await repo.loadPageSnapshot({ oauthEnabled: input.oauthEnabled });
      cleanup = createCleanupStore(repo, snapshot.storageStats);
      ai = createAiSettingsStore(snapshot.settings, repo);
      zenmoneyConnection = createZenMoneyConnectionStore(snapshot.settings, repo);
      zenmoneyData = createZenMoneyDataStore(
        {
          categoryCount: snapshot.categoryCount,
          lastSyncDate: snapshot.lastSyncDate,
          accounts: snapshot.accounts,
          selectedAccountId: snapshot.settings.zenmoneyAccountId,
        },
        repo,
      );
      backup = createBackupStore(repo, {
        refreshStats: () => cleanup?.refreshStats() ?? Promise.resolve(),
      });
      ready = true;
    } catch (cause) {
      loadError = cause instanceof Error ? cause.message : String(cause);
    }
  }

  return {
    get ready() {
      return ready;
    },
    get loadError() {
      return loadError;
    },
    get ai() {
      return ai;
    },
    get zenmoneyConnection() {
      return zenmoneyConnection;
    },
    get zenmoneyData() {
      return zenmoneyData;
    },
    get backup() {
      return backup;
    },
    get cleanup() {
      return cleanup;
    },
    load,
  };
}
```

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { env } from '$env/dynamic/public';
  import AppFeedback from '$lib/components/AppFeedback.svelte';
  import AiSettingsSection from '$lib/components/settings/AiSettingsSection.svelte';
  import ZenMoneyConnectionSection from '$lib/components/settings/ZenMoneyConnectionSection.svelte';
  import ZenMoneyDataSection from '$lib/components/settings/ZenMoneyDataSection.svelte';
  import BackupRestoreSection from '$lib/components/settings/BackupRestoreSection.svelte';
  import StorageCleanupSection from '$lib/components/settings/StorageCleanupSection.svelte';
  import { createSettingsPageStore } from '$lib/settings/settings-page.store.svelte';

  let { data }: { data: { appVersion: string } } = $props();
  const page = createSettingsPageStore({
    oauthEnabled: env.PUBLIC_ZENMONEY_OAUTH_ENABLED === 'true',
  });

  onMount(() => {
    page.load();
  });
</script>

<div class="page">
  <h1>Settings</h1>

  {#if page.loadError}
    <div class="alert error">{page.loadError}</div>
  {:else if !page.ready}
    <p class="hint">Loading settings…</p>
  {:else if page.ai && page.zenmoneyConnection && page.zenmoneyData && page.backup && page.cleanup}
    <AiSettingsSection store={page.ai} />
    <hr />
    <ZenMoneyConnectionSection
      store={page.zenmoneyConnection}
      oauthEnabled={env.PUBLIC_ZENMONEY_OAUTH_ENABLED === 'true'}
    />
    <hr />
    <ZenMoneyDataSection store={page.zenmoneyData} />
    <hr />
    <BackupRestoreSection store={page.backup} />
    <hr />
    <StorageCleanupSection store={page.cleanup} />
    <hr />
    <section class="footer-section">
      <AppFeedback appVersion={data.appVersion} />
    </section>
  {/if}
</div>
```

- [ ] **Step 4: Run the focused route/section tests, then full checks**

Run: `pnpm exec vitest run src/lib/settings/*.test.ts src/lib/components/settings/settings-sections.test.ts src/routes/settings/version.test.ts`

Expected: PASS for all new settings store tests and route/section smoke tests.

Run: `npm run check`

Expected: PASS with no Svelte or TypeScript errors.

Run: `npm run lint`

Expected: PASS with no oxlint findings.

- [ ] **Step 5: Commit**

```bash
git add \
  src/lib/settings \
  src/lib/components/settings \
  src/routes/settings/+page.svelte \
  src/routes/settings/version.test.ts
git commit -m "refactor: decompose settings page"
```

## Self-Review Notes

- Spec coverage: repository/store/page/component split is covered by Tasks 1-5; local feedback and route thinning are covered by Tasks 2-5; ZenMoney data plus default account coupling is covered in Task 3 and Task 5.
- Placeholder scan: no `TODO`, `TBD`, or “similar to previous task” placeholders remain.
- Type consistency: the plan uses `createAiSettingsStore`, `createZenMoneyConnectionStore`, `createZenMoneyDataStore`, `createBackupStore`, `createCleanupStore`, and `createSettingsPageStore` consistently throughout.
