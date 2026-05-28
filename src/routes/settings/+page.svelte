<!-- src/routes/settings/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { env } from '$env/dynamic/public';
  import AppFeedback from '$lib/components/AppFeedback.svelte';
  import AiSettingsSection from '$lib/components/settings/AiSettingsSection.svelte';
  import BackupRestoreSection from '$lib/components/settings/BackupRestoreSection.svelte';
  import StorageCleanupSection from '$lib/components/settings/StorageCleanupSection.svelte';
  import ZenmoneyConnectionSection from '$lib/components/settings/ZenMoneyConnectionSection.svelte';
  import ZenmoneyDataSection from '$lib/components/settings/ZenMoneyDataSection.svelte';
  import { createSettingsPageStore } from '$lib/settings/settings-page.store.svelte';
  import Alert from '$lib/components/ui/Alert.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  const oauthEnabled = env.PUBLIC_ZENMONEY_OAUTH_ENABLED === 'true';
  const page = createSettingsPageStore({ oauthEnabled });

  let { data }: { data: { appVersion: string } } = $props();

  onMount(() => {
    void page.load();
  });
</script>

<div class="page">
  <h1>Settings</h1>

  {#if page.loadError}
    <Alert type="error" message={page.loadError} />
    <Button variant="secondary" onclick={page.load}>Retry</Button>
  {:else if !page.ready}
    <p class="hint">Loading settings…</p>
  {:else if page.ai && page.zenmoneyConnection && page.zenmoneyData && page.backup && page.cleanup}
    <AiSettingsSection store={page.ai} />
    <hr />
    <ZenmoneyConnectionSection {oauthEnabled} store={page.zenmoneyConnection} />
    <hr />
    <ZenmoneyDataSection store={page.zenmoneyData} />
    <hr />
    <BackupRestoreSection store={page.backup} />
    <hr />
    <StorageCleanupSection store={page.cleanup} />
    <hr />
  {/if}

  <section class="footer-section">
    <AppFeedback appVersion={data.appVersion} />
  </section>
</div>

<style>
  .page {
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding-bottom: calc(var(--nav-height) + 20px);
  }
  h1 {
    font-size: 24px;
    font-weight: 700;
  }
  hr {
    border: none;
    border-top: 1px solid var(--color-border);
  }
  .footer-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
