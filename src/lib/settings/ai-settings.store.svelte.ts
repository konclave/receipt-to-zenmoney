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

  const dirty = $derived.by(
    () =>
      provider !== saved.aiProvider ||
      claudeApiKey !== saved.claudeApiKey ||
      openrouterApiKey !== saved.openrouterApiKey ||
      openrouterModel !== saved.openrouterModel,
  );

  async function loadModels() {
    modelsLoading = true;
    modelsFailed = false;
    error = null;

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
