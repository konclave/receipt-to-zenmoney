import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSettingsRepository } from './settings.repository';
import { getSettings, saveSettings } from '$lib/db/settings';
import { getCategories, saveCategories } from '$lib/db/categories';
import { getAccounts, saveAccounts } from '$lib/db/accounts';
import { saveInstruments } from '$lib/db/instruments';
import { getStorageStats } from '$lib/services/storage-stats';
import { syncDiff, mapResponseToCategories } from '$lib/services/zenmoney';
import { runZenMoneyRequestWithStoredToken } from '$lib/services/zenmoney-client';
import { clearZenMoneyAccessToken } from '$lib/services/zenmoney-access';
import { exportBackup, importBackup, exportBackupForPeriod } from '$lib/services/backup';
import { deleteTransactionsByPeriod } from '$lib/db/transactions';
import { bulkDeleteReceiptImages } from '$lib/db/receipt-images';

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

vi.mock('$lib/services/storage-stats', () => ({
  getStorageStats: vi.fn(),
}));

vi.mock('$lib/services/zenmoney', () => ({
  syncDiff: vi.fn(),
  mapResponseToCategories: vi.fn(),
}));

vi.mock('$lib/services/zenmoney-client', () => ({
  runZenMoneyRequestWithStoredToken: vi.fn(),
}));

vi.mock('$lib/services/zenmoney-access', () => ({
  clearZenMoneyAccessToken: vi.fn(),
}));

vi.mock('$lib/services/backup', () => ({
  exportBackup: vi.fn(),
  importBackup: vi.fn(),
  exportBackupForPeriod: vi.fn(),
}));

vi.mock('$lib/db/transactions', () => ({
  deleteTransactionsByPeriod: vi.fn(),
}));

vi.mock('$lib/db/receipt-images', () => ({
  bulkDeleteReceiptImages: vi.fn(),
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe('createSettingsRepository', () => {
  it('loads a page snapshot from settings, categories, accounts, and storage stats', async () => {
    vi.mocked(getSettings).mockResolvedValue({
      claudeApiKey: 'claude',
      zenmoneyToken: 'manual',
      zenmoneyAccessToken: 'oauth',
      zenmoneyAccessTokenExpiresAt: 123,
      zenmoneyServerTimestamp: 456,
      zenmoneyAccountId: 'acc-saved',
      zenmoneyUserId: 42,
      aiProvider: 'openrouter',
      openrouterApiKey: 'or-key',
      openrouterModel: 'openai/gpt-4o',
    });
    vi.mocked(getCategories).mockResolvedValue([
      { id: 'cat-1', title: 'Groceries', parentId: null, syncedAt: 1746441600000 },
      { id: 'cat-2', title: 'Transport', parentId: null, syncedAt: 1746528000000 },
    ]);
    vi.mocked(getAccounts).mockResolvedValue([
      { id: 'acc-b', title: 'Beta' },
      { id: 'acc-a', title: 'Alpha' },
    ]);
    vi.mocked(getStorageStats).mockResolvedValue({
      totalBytes: 98765,
      byYear: [{ year: 2026, txCount: 2, bytes: 98765 }],
    });

    const repo = createSettingsRepository();
    const snapshot = await repo.loadPageSnapshot({ oauthEnabled: true });

    expect(snapshot.oauthEnabled).toBe(true);
    expect(snapshot.settings.zenmoneyToken).toBe('manual');
    expect(snapshot.categoryCount).toBe(2);
    expect(snapshot.lastSyncDate).toBe(new Date(1746441600000).toLocaleDateString());
    expect(snapshot.accounts.map((account) => account.title)).toEqual(['Alpha', 'Beta']);
    expect(snapshot.storageStats?.totalBytes).toBe(98765);
  });

  it('treats storage stats failures as null', async () => {
    vi.mocked(getSettings).mockResolvedValue({
      claudeApiKey: '',
      zenmoneyToken: '',
      zenmoneyAccessToken: '',
      zenmoneyAccessTokenExpiresAt: 0,
      zenmoneyServerTimestamp: 0,
      zenmoneyAccountId: '',
      zenmoneyUserId: 0,
      aiProvider: 'anthropic',
      openrouterApiKey: '',
      openrouterModel: 'anthropic/claude-sonnet-4.6',
    });
    vi.mocked(getCategories).mockResolvedValue([]);
    vi.mocked(getAccounts).mockResolvedValue([]);
    vi.mocked(getStorageStats).mockRejectedValue(new Error('boom'));

    const repo = createSettingsRepository();
    const snapshot = await repo.loadPageSnapshot({ oauthEnabled: false });

    expect(snapshot.storageStats).toBeNull();
  });

  it('reloads ZenMoney data and auto-selects the only account', async () => {
    const response = {
      serverTimestamp: 1746441600,
      user: [{ id: 77 }],
      instrument: [{ id: 1, shortTitle: 'USD' }],
      tag: [
        { id: 'cat-1', title: 'Groceries', parent: null },
        { id: 'cat-2', title: 'Transport', parent: 'cat-1' },
      ],
      account: [{ id: 'acc-1', title: 'Main account' }],
    };
    const mappedCategories = [
      { id: 'cat-1', title: 'Groceries', parentId: null, syncedAt: 1746441600000 },
      { id: 'cat-2', title: 'Transport', parentId: 'cat-1', syncedAt: 1746441600000 },
    ];

    vi.mocked(runZenMoneyRequestWithStoredToken).mockImplementation(async (request) =>
      request('stored-token'),
    );
    vi.mocked(syncDiff).mockResolvedValue(response);
    vi.mocked(mapResponseToCategories).mockReturnValue(mappedCategories);

    const expectedLastSyncDate = new Date().toLocaleDateString();
    const repo = createSettingsRepository();
    const result = await repo.reloadZenMoneyData();

    expect(runZenMoneyRequestWithStoredToken).toHaveBeenCalledTimes(1);
    expect(syncDiff).toHaveBeenCalledWith('stored-token', 0);
    expect(mapResponseToCategories).toHaveBeenCalledWith(response);
    expect(saveCategories).toHaveBeenCalledWith(mappedCategories);
    expect(saveAccounts).toHaveBeenCalledWith(response.account);
    expect(saveInstruments).toHaveBeenCalledWith(response.instrument);
    expect(saveSettings).toHaveBeenCalledWith({
      zenmoneyServerTimestamp: 1746441600,
      zenmoneyUserId: 77,
      zenmoneyAccountId: 'acc-1',
    });
    expect(result.selectedAccountId).toBe('acc-1');
    expect(result.categoryCount).toBe(2);
    expect(result.lastSyncDate).toBe(expectedLastSyncDate);
    expect(result.accounts).toEqual(response.account);
  });

  it('returns a non-null lastSyncDate when reload maps zero categories', async () => {
    const response = {
      serverTimestamp: 1746441600,
      user: [{ id: 77 }],
      instrument: [{ id: 1, shortTitle: 'USD' }],
      tag: [],
      account: [{ id: 'acc-1', title: 'Main account' }],
    };

    vi.mocked(runZenMoneyRequestWithStoredToken).mockImplementation(async (request) =>
      request('stored-token'),
    );
    vi.mocked(syncDiff).mockResolvedValue(response);
    vi.mocked(mapResponseToCategories).mockReturnValue([]);

    const repo = createSettingsRepository();
    const result = await repo.reloadZenMoneyData();

    expect(result.categoryCount).toBe(0);
    expect(result.lastSyncDate).not.toBeNull();
  });

  it('fetches image-capable OpenRouter models in sorted order', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            data: [
              {
                id: 'z-model',
                name: 'Z Model',
                pricing: { prompt: '0', completion: '0' },
                architecture: { input_modalities: ['image', 'text'] },
              },
              {
                id: 'a-model',
                name: 'A Model',
                pricing: { prompt: '1', completion: '1' },
                architecture: { modality: 'image-text' },
              },
              {
                id: 'text-only',
                name: 'Text Only',
                architecture: { input_modalities: ['text'] },
              },
            ],
          }),
      }),
    );

    const repo = createSettingsRepository();
    await expect(repo.fetchOpenRouterModels()).resolves.toEqual([
      { id: 'a-model', name: 'A Model' },
      { id: 'z-model', name: '🆓 Z Model' },
    ]);
  });

  it('throws when OpenRouter returns a non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
      }),
    );

    const repo = createSettingsRepository();
    await expect(repo.fetchOpenRouterModels()).rejects.toThrow(
      'OpenRouter API error: 503 Service Unavailable',
    );
  });

  it('disconnects ZenMoney even if logout fetch fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'));
    vi.stubGlobal('fetch', fetchMock);

    const repo = createSettingsRepository();
    await expect(repo.disconnectZenMoney()).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenCalledWith('/api/zenmoney/logout', {
      method: 'POST',
      credentials: 'include',
    });
    expect(clearZenMoneyAccessToken).toHaveBeenCalledTimes(1);
    expect(saveSettings).toHaveBeenCalledWith({ zenmoneyToken: '' });
  });

  it('re-exposes backup and cleanup primitives', () => {
    const repo = createSettingsRepository();

    expect(repo.exportBackup).toBe(exportBackup);
    expect(repo.importBackup).toBe(importBackup);
    expect(repo.exportBackupForPeriod).toBe(exportBackupForPeriod);
    expect(repo.deleteTransactionsByPeriod).toBe(deleteTransactionsByPeriod);
    expect(repo.bulkDeleteReceiptImages).toBe(bulkDeleteReceiptImages);
  });
});
