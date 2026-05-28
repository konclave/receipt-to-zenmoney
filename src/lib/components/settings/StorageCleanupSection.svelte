<script lang="ts">
  import CleanupConfirmModal from '$lib/components/CleanupConfirmModal.svelte';
  import CleanupModal from '$lib/components/CleanupModal.svelte';
  import { formatBytes } from '$lib/services/storage-stats';
  import type { createCleanupStore } from '$lib/settings/cleanup.store.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let { store }: { store: ReturnType<typeof createCleanupStore> } = $props();

  const totalTransactions = $derived(
    store.storageStats?.byYear.reduce((sum, year) => sum + year.txCount, 0) ??
      0,
  );
</script>

<section>
  <h2>Storage</h2>
  <Alert type="error" message={store.error} />
  <Alert type="success" message={store.status} />

  <div class="storage-stats">
    <span class="hint">Storage used</span>
    <span class="storage-size">
      {store.storageStats ? formatBytes(store.storageStats.totalBytes) : '—'}
    </span>
    {#if store.storageStats}
      <span class="hint">
        {store.storageStats.byYear.length}
        {store.storageStats.byYear.length === 1 ? 'year' : 'years'} · {totalTransactions}
        transactions
      </span>
    {:else if store.loadingStats}
      <span class="hint">Loading storage usage…</span>
    {/if}
    <Button
      variant="danger"
      onclick={store.openCleanupModal}
      disabled={!store.storageStats ||
        store.storageStats.byYear.length === 0 ||
        store.cleaning}
    >
      {store.cleaning ? 'Cleaning…' : 'Clean Up…'}
    </Button>
  </div>
</section>

{#if store.cleanupModalOpen && store.storageStats}
  <CleanupModal
    stats={store.storageStats}
    onselect={store.selectCleanupTarget}
    onclose={store.closeModals}
  />
{/if}

{#if store.cleanupConfirmTarget}
  <CleanupConfirmModal
    period={store.cleanupConfirmTarget.period}
    txCount={store.cleanupConfirmTarget.txCount}
    bytes={store.cleanupConfirmTarget.bytes}
    onconfirm={store.confirmCleanup}
    onclose={store.closeModals}
  />
{/if}

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
  .storage-stats {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-top: 4px;
  }
  .storage-size {
    font-size: 22px;
    font-weight: 700;
  }
</style>
