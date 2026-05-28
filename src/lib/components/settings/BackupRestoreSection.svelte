<script lang="ts">
  import type { createBackupStore } from '$lib/settings/backup.store.svelte';

  let { store }: { store: ReturnType<typeof createBackupStore> } = $props();
  let fileInput = $state<HTMLInputElement | undefined>(undefined);

  async function handleImport(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    await store.importFile(file);
    input.value = '';
  }
</script>

<section>
  <h2>Backup & Restore</h2>
  {#if store.error}<div class="alert error">{store.error}</div>{/if}
  {#if store.status}<div class="alert success">{store.status}</div>{/if}

  <button
    class="btn-secondary"
    onclick={store.exportAll}
    disabled={store.exporting || store.importing}
  >
    {store.exporting ? 'Exporting…' : 'Export backup'}
  </button>
  <button
    class="btn-secondary"
    onclick={() => fileInput?.click()}
    disabled={store.exporting || store.importing}
  >
    {store.importing ? 'Importing…' : 'Import backup'}
  </button>
  <input
    aria-hidden="true"
    bind:this={fileInput}
    type="file"
    accept=".gz"
    style="display:none"
    onchange={handleImport}
  />
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
  .btn-secondary {
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 12px;
    font-weight: 500;
  }
  .btn-secondary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
