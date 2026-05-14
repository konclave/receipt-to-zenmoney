<script lang="ts">
  import type { createZenmoneyDataStore } from "$lib/settings/zenmoney-data.store.svelte";

  let { store }: { store: ReturnType<typeof createZenmoneyDataStore> } =
    $props();
</script>

<section>
  <h2>Zenmoney Data</h2>
  {#if store.error}<div class="alert error">{store.error}</div>{/if}
  {#if store.success}<div class="alert success">{store.success}</div>{/if}

  <label for="reload-categories">
    Categories
    <span class="hint">
      ({store.categoryCount} cached
      {store.lastSyncDate
        ? `· Last synced ${store.lastSyncDate}`
        : "· Not synced yet"})
    </span>
  </label>
  <button
    id="reload-categories"
    class="btn-secondary"
    onclick={store.reloadCategories}
    disabled={store.syncing}
  >
    {store.syncing ? "Loading…" : "Reload Categories"}
  </button>

  {#if store.hasMultipleAccounts}
    <label for="account">Default Account</label>
    <select
      id="account"
      value={store.selectedAccountId}
      onchange={(event) => {
        store.selectAccount(event.currentTarget.value);
      }}
    >
      {#each store.accounts as account}
        <option value={account.id}>{account.title}</option>
      {/each}
    </select>
    <button
      class="btn-primary"
      onclick={store.saveAccount}
      disabled={store.savingAccount || !store.accountDirty}
    >
      {store.savingAccount ? "Saving…" : "Save Account"}
    </button>
  {/if}
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
  label {
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-muted);
  }
  .hint {
    font-size: 12px;
    color: var(--color-text-muted);
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
  .btn-secondary {
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 12px;
    font-weight: 500;
  }
</style>
