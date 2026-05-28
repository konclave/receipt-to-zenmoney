<script lang="ts">
  import type { createZenmoneyDataStore } from '$lib/settings/zenmoney-data.store.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let { store }: { store: ReturnType<typeof createZenmoneyDataStore> } =
    $props();
</script>

<section>
  <h2>Zenmoney Data</h2>
  <Alert type="error" message={store.error} />
  <Alert type="success" message={store.success} />

  <label for="reload-categories">
    Categories
    <span class="hint">
      ({store.categoryCount} cached
      {store.lastSyncDate
        ? `· Last synced ${store.lastSyncDate}`
        : '· Not synced yet'})
    </span>
  </label>
  <Button
    id="reload-categories"
    variant="secondary"
    onclick={store.reloadCategories}
    disabled={store.syncing}
  >
    {store.syncing ? 'Loading…' : 'Reload Categories'}
  </Button>

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
    <Button
      onclick={store.saveAccount}
      disabled={store.savingAccount || !store.accountDirty}
    >
      {store.savingAccount ? 'Saving…' : 'Save Account'}
    </Button>
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
</style>
