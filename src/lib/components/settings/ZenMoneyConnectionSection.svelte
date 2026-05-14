<script lang="ts">
  import type { createZenmoneyConnectionStore } from "$lib/settings/zenmoney-connection.store.svelte";

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
  {#if store.error}<div class="alert error">{store.error}</div>{/if}
  {#if store.success}<div class="alert success">{store.success}</div>{/if}

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
          {store.disconnecting ? "Disconnecting…" : "Disconnect"}
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

  <button
    class="btn-primary"
    onclick={store.saveManualToken}
    disabled={store.saving || !store.dirty}
  >
    {store.saving ? "Saving…" : "Save Settings"}
  </button>
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
  .hint {
    font-size: 12px;
    color: var(--color-text-muted);
  }
  .hint.divider {
    text-align: center;
  }
  .alert {
    padding: 12px;
    border-radius: var(--radius-sm);
    font-size: 13px;
  }
  .alert.error {
    background: color-mix(in srgb, var(--color-error) 15%, transparent);
    border: 1px solid var(--color-error);
    color: var(--color-error);
  }
  .alert.success {
    background: color-mix(in srgb, var(--color-success) 15%, transparent);
    border: 1px solid var(--color-success);
    color: var(--color-success);
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
  .btn-primary {
    background: var(--color-primary);
    color: white;
    border-radius: var(--radius-sm);
    padding: 14px;
    font-weight: 600;
    font-size: 15px;
  }
  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
