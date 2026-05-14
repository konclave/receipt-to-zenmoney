import { createAiSettingsStore } from './ai-settings.store.svelte';
import { createBackupStore } from './backup.store.svelte';
import { createCleanupStore } from './cleanup.store.svelte';
import { createSettingsRepository } from './settings.repository';
import { createZenmoneyConnectionStore } from './zenmoney-connection.store.svelte';
import { createZenmoneyDataStore } from './zenmoney-data.store.svelte';

type AiStore = ReturnType<typeof createAiSettingsStore>;
type ZenmoneyConnectionStore = ReturnType<typeof createZenmoneyConnectionStore>;
type ZenmoneyDataStore = ReturnType<typeof createZenmoneyDataStore>;
type BackupStore = ReturnType<typeof createBackupStore>;
type CleanupStore = ReturnType<typeof createCleanupStore>;

function toErrorMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export function createSettingsPageStore(input: { oauthEnabled: boolean }) {
  const repo = createSettingsRepository();

  let ready = $state(false);
  let loadError = $state<string | null>(null);
  let ai = $state<AiStore | null>(null);
  let zenmoneyConnection = $state<ZenmoneyConnectionStore | null>(null);
  let zenmoneyData = $state<ZenmoneyDataStore | null>(null);
  let backup = $state<BackupStore | null>(null);
  let cleanup = $state<CleanupStore | null>(null);

  async function load() {
    ready = false;
    loadError = null;

    try {
      const snapshot = await repo.loadPageSnapshot({
        oauthEnabled: input.oauthEnabled,
      });

      const cleanupStore = createCleanupStore(repo, snapshot.storageStats);

      cleanup = cleanupStore;
      ai = createAiSettingsStore(
        {
          aiProvider: snapshot.settings.aiProvider,
          claudeApiKey: snapshot.settings.claudeApiKey,
          openrouterApiKey: snapshot.settings.openrouterApiKey,
          openrouterModel: snapshot.settings.openrouterModel,
        },
        repo,
      );
      zenmoneyConnection = createZenmoneyConnectionStore(
        {
          zenmoneyToken: snapshot.settings.zenmoneyToken,
          zenmoneyAccessToken: snapshot.settings.zenmoneyAccessToken,
        },
        repo,
      );
      zenmoneyData = createZenmoneyDataStore(
        {
          categoryCount: snapshot.categoryCount,
          lastSyncDate: snapshot.lastSyncDate,
          accounts: snapshot.accounts,
          selectedAccountId: snapshot.settings.zenmoneyAccountId,
        },
        repo,
      );
      backup = createBackupStore(repo, {
        refreshStats: () => cleanupStore.refreshStats(),
      });
      ready = true;
    } catch (cause) {
      loadError = toErrorMessage(cause);
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
