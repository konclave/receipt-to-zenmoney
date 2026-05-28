<script lang="ts">
  import { onMount } from 'svelte';
  import type { createAiSettingsStore } from '$lib/settings/ai-settings.store.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let { store }: { store: ReturnType<typeof createAiSettingsStore> } = $props();

  onMount(() => {
    void store.loadModels();
  });
</script>

<section>
  <h2>AI Provider</h2>
  <Alert type="error" message={store.error} />
  <Alert type="success" message={store.success} />

  <div class="provider-tabs">
    <button
      type="button"
      class="provider-tab"
      class:active={store.provider === 'anthropic'}
      onclick={() => store.setProvider('anthropic')}>Anthropic</button
    >
    <button
      type="button"
      class="provider-tab"
      class:active={store.provider === 'openrouter'}
      onclick={() => store.setProvider('openrouter')}>OpenRouter</button
    >
  </div>

  {#if store.provider === 'anthropic'}
    <label for="claude-key">
      API Key
      <span
        class="key-dot"
        class:set={store.claudeApiKeySaved}
        role="img"
        aria-label={store.claudeApiKeySaved ? 'saved' : 'not saved'}>●</span
      >
    </label>
    <input
      id="claude-key"
      type="password"
      bind:value={store.claudeApiKey}
      placeholder="sk-ant-api03-…"
      autocomplete="off"
    />
    <p class="hint">Get yours at console.anthropic.com</p>
  {:else}
    <label for="or-key">
      API Key
      <span
        class="key-dot"
        class:set={store.openrouterApiKeySaved}
        role="img"
        aria-label={store.openrouterApiKeySaved ? 'saved' : 'not saved'}>●</span
      >
    </label>
    <input
      id="or-key"
      type="password"
      bind:value={store.openrouterApiKey}
      placeholder="sk-or-…"
      autocomplete="off"
    />
    <label for="or-model">Model</label>
    {#if store.modelsLoading}
      <p class="hint">Loading models…</p>
    {:else if store.modelsFailed || store.models.length === 0}
      <input
        id="or-model"
        type="text"
        bind:value={store.openrouterModel}
        placeholder="anthropic/claude-sonnet-4.6"
        autocomplete="off"
      />
      <p class="hint">Browse vision-capable models at openrouter.ai/models</p>
    {:else}
      <select id="or-model" bind:value={store.openrouterModel}>
        {#each store.models as model}
          <option value={model.id}>{model.name || model.id}</option>
        {/each}
      </select>
      <p class="hint">{store.models.length} vision-capable models available</p>
    {/if}
  {/if}

  <Button onclick={store.save} disabled={store.saving || !store.dirty}>
    {store.saving ? 'Saving…' : 'Save AI Settings'}
  </Button>
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  h2 {
    font-size: 16px;
    font-weight: 600;
    margin-bottom: 4px;
  }
  .provider-tabs {
    display: flex;
    gap: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  .provider-tab {
    flex: 1;
    padding: 10px;
    font-size: 13px;
    font-weight: 500;
    background: var(--color-surface-2);
    border: none;
    cursor: pointer;
    color: var(--color-text-muted);
  }
  .provider-tab.active {
    background: var(--color-primary);
    color: white;
  }
  .key-dot {
    font-size: 10px;
    margin-left: 6px;
    vertical-align: middle;
    color: var(--color-text-muted);
  }
  .key-dot.set {
    color: var(--color-success);
  }
</style>
