<script lang="ts">
  import type { createBackupStore } from '$lib/settings/backup.store.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import Button from '$lib/components/ui/Button.svelte';

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
  <Alert type="error" message={store.error} />
  <Alert type="success" message={store.status} />

  <Button
    variant="secondary"
    onclick={store.exportAll}
    disabled={store.exporting || store.importing}
  >
    {store.exporting ? 'Exporting…' : 'Export backup'}
  </Button>
  <Button
    variant="secondary"
    onclick={() => fileInput?.click()}
    disabled={store.exporting || store.importing}
  >
    {store.importing ? 'Importing…' : 'Import backup'}
  </Button>
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
</style>
