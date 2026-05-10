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
