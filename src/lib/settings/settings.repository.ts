import { getSettings, saveSettings } from '$lib/db/settings';
import { getCategories, saveCategories } from '$lib/db/categories';
import { getAccounts, saveAccounts } from '$lib/db/accounts';
import { saveInstruments } from '$lib/db/instruments';
import { clearZenMoneyAccessToken } from '$lib/services/zenmoney-access';
import { runZenMoneyRequestWithStoredToken } from '$lib/services/zenmoney-client';
import { syncDiff, mapResponseToCategories } from '$lib/services/zenmoney';
import { exportBackup, importBackup, exportBackupForPeriod } from '$lib/services/backup';
import { getStorageStats } from '$lib/services/storage-stats';
import { deleteTransactionsByPeriod } from '$lib/db/transactions';
import { bulkDeleteReceiptImages } from '$lib/db/receipt-images';
import type { Settings, ZenMoneyAccount } from '$lib/types';
import type { StorageStats } from '$lib/services/storage-stats';

export type AiSettingsInput = Pick<
  Settings,
  'aiProvider' | 'claudeApiKey' | 'openrouterApiKey' | 'openrouterModel'
>;

export interface LoadPageSnapshotInput {
  oauthEnabled: boolean;
}

export interface LoadPageSnapshotResult {
  oauthEnabled: boolean;
  settings: Settings;
  categoryCount: number;
  lastSyncDate: string | null;
  accounts: ZenMoneyAccount[];
  storageStats: StorageStats | null;
}

export interface ReloadZenMoneyDataResult {
  categoryCount: number;
  lastSyncDate: string | null;
  accounts: ZenMoneyAccount[];
  selectedAccountId: string;
}

export interface SettingsRepository {
  loadPageSnapshot(input: LoadPageSnapshotInput): Promise<LoadPageSnapshotResult>;
  fetchOpenRouterModels(): Promise<Array<{ id: string; name: string }>>;
  saveAiSettings(input: AiSettingsInput): Promise<void>;
  saveManualZenMoneyToken(token: string): Promise<void>;
  disconnectZenMoney(): Promise<void>;
  reloadZenMoneyData(): Promise<ReloadZenMoneyDataResult>;
  saveDefaultAccount(accountId: string): Promise<void>;
  exportBackup: typeof exportBackup;
  importBackup: typeof importBackup;
  exportBackupForPeriod: typeof exportBackupForPeriod;
  getStorageStats: typeof getStorageStats;
  deleteTransactionsByPeriod: typeof deleteTransactionsByPeriod;
  bulkDeleteReceiptImages: typeof bulkDeleteReceiptImages;
  clearZenMoneyAccessToken: typeof clearZenMoneyAccessToken;
}

interface OpenRouterModel {
  id: string;
  name: string;
  pricing?: { prompt?: string; completion?: string };
  architecture?: {
    modality?: string;
    input_modalities?: string[];
  };
}

interface OpenRouterModelsResponse {
  data: OpenRouterModel[];
}

function sortAccounts(accounts: ZenMoneyAccount[]): ZenMoneyAccount[] {
  return [...accounts].sort((left, right) => left.title.localeCompare(right.title));
}

function toDateStringOrNull(timestamp: number | undefined): string | null {
  if (!timestamp) return null;
  return new Date(timestamp).toLocaleDateString();
}

function isImageCapableModel(model: OpenRouterModel): boolean {
  return (
    model.architecture?.input_modalities?.includes('image') === true ||
    model.architecture?.modality?.includes('image') === true
  );
}

function formatOpenRouterModelName(model: OpenRouterModel): string {
  const free = model.pricing?.prompt === '0' && model.pricing?.completion === '0';
  return `${free ? '🆓 ' : ''}${model.name || model.id}`;
}

async function loadPageSnapshot({
  oauthEnabled,
}: LoadPageSnapshotInput): Promise<LoadPageSnapshotResult> {
  const [settings, categories, accounts, storageStats] = await Promise.all([
    getSettings(),
    getCategories(),
    getAccounts(),
    getStorageStats().catch(() => null),
  ]);

  return {
    oauthEnabled,
    settings,
    categoryCount: categories.length,
    lastSyncDate: toDateStringOrNull(categories[0]?.syncedAt),
    accounts: sortAccounts(accounts),
    storageStats,
  };
}

async function fetchOpenRouterModels(): Promise<Array<{ id: string; name: string }>> {
  const response = await fetch('https://openrouter.ai/api/v1/models');
  if (!response.ok) {
    throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
  }

  const json = (await response.json()) as OpenRouterModelsResponse;
  return json.data
    .filter(isImageCapableModel)
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((model) => ({
      id: model.id,
      name: formatOpenRouterModelName(model),
    }));
}

async function saveAiSettings(input: AiSettingsInput): Promise<void> {
  await saveSettings(input);
}

async function saveManualZenMoneyToken(token: string): Promise<void> {
  await saveSettings({ zenmoneyToken: token });
}

async function disconnectZenMoney(): Promise<void> {
  await fetch('/api/zenmoney/logout', {
    method: 'POST',
    credentials: 'include',
  }).catch(() => {});
  await clearZenMoneyAccessToken();
  await saveSettings({ zenmoneyToken: '' });
}

async function reloadZenMoneyData(): Promise<ReloadZenMoneyDataResult> {
  const lastSyncDate = new Date().toLocaleDateString();
  const response = await runZenMoneyRequestWithStoredToken((token) => syncDiff(token, 0));
  const categories = mapResponseToCategories(response);
  const accounts = sortAccounts(response.account);
  const selectedAccountId = accounts.length === 1 ? accounts[0].id : '';

  await Promise.all([
    saveCategories(categories),
    saveAccounts(accounts),
    saveInstruments(response.instrument),
  ]);

  await saveSettings({
    zenmoneyServerTimestamp: response.serverTimestamp,
    zenmoneyUserId: response.user[0]?.id ?? 0,
    ...(selectedAccountId ? { zenmoneyAccountId: selectedAccountId } : {}),
  });

  return {
    categoryCount: categories.length,
    lastSyncDate,
    accounts,
    selectedAccountId,
  };
}

async function saveDefaultAccount(accountId: string): Promise<void> {
  await saveSettings({ zenmoneyAccountId: accountId });
}

export function createSettingsRepository(): SettingsRepository {
  const repository: SettingsRepository = {
    loadPageSnapshot,
    fetchOpenRouterModels,
    saveAiSettings,
    saveManualZenMoneyToken,
    disconnectZenMoney,
    reloadZenMoneyData,
    saveDefaultAccount,
    exportBackup,
    importBackup,
    exportBackupForPeriod,
    getStorageStats,
    deleteTransactionsByPeriod,
    bulkDeleteReceiptImages,
    clearZenMoneyAccessToken,
  };
  return repository;
}
