<!-- src/routes/settings/+page.svelte -->
<script lang="ts">
  import { onMount } from "svelte";
  import { env } from "$env/dynamic/public";
  import AppFeedback from "$lib/components/AppFeedback.svelte";
  import AiSettingsSection from "$lib/components/settings/AiSettingsSection.svelte";
  import BackupRestoreSection from "$lib/components/settings/BackupRestoreSection.svelte";
  import StorageCleanupSection from "$lib/components/settings/StorageCleanupSection.svelte";
  import ZenmoneyConnectionSection from "$lib/components/settings/ZenMoneyConnectionSection.svelte";
  import ZenmoneyDataSection from "$lib/components/settings/ZenMoneyDataSection.svelte";
  import { createSettingsPageStore } from "$lib/settings/settings-page.store.svelte";

  const oauthEnabled = env.PUBLIC_ZENMONEY_OAUTH_ENABLED === "true";
  const page = createSettingsPageStore({ oauthEnabled });

  let { data }: { data: { appVersion: string } } = $props();

  onMount(() => {
    void page.load();
  });
</script>

<div class="page">
  <h1>Settings</h1>

  {#if page.loadError}
    <div class="alert error">{page.loadError}</div>
    <button class="btn-secondary" onclick={page.load}>Retry</button>
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
  .hint {
    font-size: 12px;
    color: var(--color-text-muted);
  }
  hr {
    border: none;
    border-top: 1px solid var(--color-border);
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
  .btn-secondary {
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 12px;
    font-weight: 500;
  }
  .footer-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
</style>
