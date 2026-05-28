<script lang="ts">
  import type { createZenmoneyConnectionStore } from '$lib/settings/zenmoney-connection.store.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let {
    oauthEnabled,
    store,
  }: {
    oauthEnabled: boolean;
    store: ReturnType<typeof createZenmoneyConnectionStore>;
  } = $props();
</script>

<section>
  <h2>Zenmoney Connection</h2>
  <Alert type="error" message={store.error} />
  <Alert type="success" message={store.success} />

  {#if oauthEnabled}
    {#if store.connected}
      <div class="connected-row">
        <span class="connected-badge">✓ Connected</span>
        <button
          type="button"
          class="btn-disconnect"
          onclick={store.disconnect}
          disabled={store.disconnecting}
        >
          {store.disconnecting ? 'Disconnecting…' : 'Disconnect'}
        </button>
      </div>
    {:else}
      <button type="button" class="btn-oauth" onclick={store.startOAuthFlow}>
        Connect with Zenmoney
      </button>
      <p class="hint divider">— or paste a token manually —</p>
      <input
        id="zm-token"
        type="password"
        bind:value={store.manualToken}
        placeholder="Paste your Zenmoney token"
        autocomplete="off"
      />
    {/if}
  {/if}

  <Button
    onclick={store.saveManualToken}
    disabled={store.saving || !store.dirty}
  >
    {store.saving ? 'Saving…' : 'Save Settings'}
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
  .hint.divider {
    text-align: center;
  }
  .connected-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 14px;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
  }
  .connected-badge {
    font-size: 14px;
    font-weight: 600;
    color: var(--color-success);
  }
  .btn-disconnect {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-error, #d93025);
    background: none;
    border: none;
    cursor: pointer;
    padding: 0;
  }
  .btn-disconnect:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn-oauth {
    width: 100%;
    background: var(--color-primary);
    color: white;
    border-radius: var(--radius-sm);
    padding: 13px;
    font-weight: 600;
    font-size: 15px;
    cursor: pointer;
    border: none;
  }
  .btn-oauth:hover {
    opacity: 0.9;
  }
</style>
