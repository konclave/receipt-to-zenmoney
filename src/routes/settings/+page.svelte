<!-- src/routes/settings/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'
  import { getSettings, saveSettings } from '$lib/db/settings'
  import { getCategories, saveCategories } from '$lib/db/categories'
  import { getAccounts, saveAccounts } from '$lib/db/accounts'
  import { saveInstruments } from '$lib/db/instruments'
  import { syncDiff, mapResponseToCategories } from '$lib/services/zenmoney'
  import { exportBackup, importBackup } from '$lib/services/backup'
  import type { ZenMoneyAccount } from '$lib/types'

  let { data }: { data: { appVersion: string } } = $props()

  let claudeApiKey = $state('')
  let zenmoneyToken = $state('')
  let categoryCount = $state(0)
  let lastSyncDate = $state<string | null>(null)
  let accounts = $state<ZenMoneyAccount[]>([])
  let selectedAccountId = $state('')
  let saving = $state(false)
  let syncing = $state(false)
  let error = $state<string | null>(null)
  let success = $state<string | null>(null)
  let savedClaudeApiKey = $state('')
  let savedZenmoneyToken = $state('')
  let savedAccountId = $state('')
  let backupStatus = $state<string | null>(null)
  let backupError = $state<string | null>(null)
  let exporting = $state(false)
  let importing = $state(false)
  let fileInput = $state<HTMLInputElement | undefined>(undefined)

  let claudeApiKeySaved = $derived(savedClaudeApiKey.length > 0)
  let zenmoneyTokenSaved = $derived(savedZenmoneyToken.length > 0)
  let settingsDirty = $derived(claudeApiKey !== savedClaudeApiKey || zenmoneyToken !== savedZenmoneyToken)
  let accountDirty = $derived(selectedAccountId !== savedAccountId)

  onMount(async () => {
    const s = await getSettings()
    claudeApiKey = s.claudeApiKey
    zenmoneyToken = s.zenmoneyToken
    selectedAccountId = s.zenmoneyAccountId
    savedClaudeApiKey = s.claudeApiKey
    savedZenmoneyToken = s.zenmoneyToken
    savedAccountId = s.zenmoneyAccountId
    const [cats, savedAccounts] = await Promise.all([getCategories(), getAccounts()])
    categoryCount = cats.length
    accounts = savedAccounts
    if (cats.length > 0) lastSyncDate = new Date(cats[0].syncedAt).toLocaleDateString()
  })

  async function handleSave() {
    saving = true
    error = null
    try {
      await saveSettings({ claudeApiKey, zenmoneyToken })
      if (selectedAccountId) await saveSettings({ zenmoneyAccountId: selectedAccountId })
      savedClaudeApiKey = claudeApiKey
      savedZenmoneyToken = zenmoneyToken
      savedAccountId = selectedAccountId
      success = 'Saved'
      setTimeout(() => (success = null), 2000)
    } catch (e) {
      error = String(e)
    } finally {
      saving = false
    }
  }

  async function handleReloadCategories() {
    syncing = true
    error = null
    try {
      const s = await getSettings()
      if (!s.zenmoneyToken) throw new Error('ZenMoney token is required')
      const response = await syncDiff(s.zenmoneyToken, 0)
      const cats = mapResponseToCategories(response)
      await Promise.all([saveCategories(cats), saveAccounts(response.account), saveInstruments(response.instrument)])
      const userId = response.user[0]?.id ?? 0
      await saveSettings({ zenmoneyServerTimestamp: response.serverTimestamp, zenmoneyUserId: userId })
      categoryCount = cats.length
      lastSyncDate = new Date().toLocaleDateString()
      accounts = response.account
      if (response.account.length === 1) {
        selectedAccountId = response.account[0].id
        savedAccountId = response.account[0].id
        await saveSettings({ zenmoneyAccountId: response.account[0].id })
      }
    } catch (e) {
      error = String(e)
    } finally {
      syncing = false
    }
  }

  async function handleExport() {
    exporting = true
    backupStatus = null
    backupError = null
    try {
      const { blob, count } = await exportBackup()
      const date = new Date().toISOString().slice(0, 10)
      const filename = `rzm-backup-${date}.rzm.gz`
      const shareFile = new File([blob], filename, { type: 'application/gzip' })
      if (navigator.canShare?.({ files: [shareFile] })) {
        await navigator.share({ files: [shareFile], title: 'ZenMoney Backup' })
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      }
      backupStatus = `Exported ${count} transaction${count !== 1 ? 's' : ''}`
    } catch (e) {
      if (e instanceof Error && e.name === 'AbortError') return
      backupError = String(e)
    } finally {
      exporting = false
    }
  }

  async function handleImport(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0]
    if (!file) return
    importing = true
    backupStatus = null
    backupError = null
    try {
      const { imported, skipped } = await importBackup(file)
      backupStatus = `Imported ${imported} new, skipped ${skipped} duplicate${skipped !== 1 ? 's' : ''}`
    } catch (e) {
      backupError = e instanceof Error ? e.message : String(e)
    } finally {
      importing = false
      ;(event.target as HTMLInputElement).value = ''
    }
  }
</script>

<div class="page">
  <h1>Settings</h1>

  {#if error}<div class="alert error">{error}</div>{/if}
  {#if success}<div class="alert success">{success}</div>{/if}

  <section>
    <label for="claude-key">
      Claude API Key
      <span class="key-dot" class:set={claudeApiKeySaved} role="img" aria-label={claudeApiKeySaved ? 'saved' : 'not saved'}>●</span>
    </label>
    <input id="claude-key" type="password" bind:value={claudeApiKey}
      placeholder="sk-ant-api03-…" autocomplete="off" />
    <p class="hint">Get yours at console.anthropic.com</p>
  </section>

  <section>
    <label for="zm-token">
      ZenMoney Token
      <span class="key-dot" class:set={zenmoneyTokenSaved} role="img" aria-label={zenmoneyTokenSaved ? 'saved' : 'not saved'}>●</span>
    </label>
    <input id="zm-token" type="password" bind:value={zenmoneyToken}
      placeholder="Paste your ZenMoney token" autocomplete="off" />
    <p class="hint">Get yours at app.zenmoney.ru/consumer</p>
  </section>

  <button class="btn-primary" onclick={handleSave} disabled={saving || !settingsDirty}>
    {saving ? 'Saving…' : 'Save Settings'}
  </button>

  <hr />

  <section>
    <h2>Categories</h2>
    <p class="hint">
      {categoryCount} categories cached
      {lastSyncDate ? `· Last synced ${lastSyncDate}` : '· Not synced yet'}
    </p>
    <button class="btn-secondary" onclick={handleReloadCategories} disabled={syncing}>
      {syncing ? 'Loading…' : 'Reload Categories'}
    </button>
  </section>

  {#if accounts.length > 1}
    <section>
      <label for="account">Default Account</label>
      <select id="account" bind:value={selectedAccountId}>
        {#each accounts as acc}
          <option value={acc.id}>{acc.title}</option>
        {/each}
      </select>
      <button class="btn-primary" onclick={handleSave} disabled={saving || !accountDirty}>Save Account</button>
    </section>
  {/if}

  <hr />

  <section>
    <h2>Backup & Restore</h2>
    {#if backupError}<div class="alert error">{backupError}</div>{/if}
    {#if backupStatus}<div class="alert success">{backupStatus}</div>{/if}
    <button class="btn-secondary" onclick={handleExport} disabled={exporting || importing}>
      {exporting ? 'Exporting…' : 'Export backup'}
    </button>
    <button class="btn-secondary" onclick={() => fileInput?.click()} disabled={exporting || importing}>
      {importing ? 'Importing…' : 'Import backup'}
    </button>
    <input aria-hidden="true" bind:this={fileInput} type="file" accept=".rzm.gz" style="display:none" onchange={handleImport} />
  </section>

  <hr />

  <section>
    <p class="hint">App Version {data.appVersion}</p>
  </section>
</div>

<style>
  .page { padding: 20px 16px; display: flex; flex-direction: column; gap: 20px; padding-bottom: calc(var(--nav-height) + 20px); }
  h1 { font-size: 24px; font-weight: 700; }
  h2 { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
  section { display: flex; flex-direction: column; gap: 8px; }
  label { font-size: 13px; font-weight: 500; color: var(--color-text-muted); }
  .hint { font-size: 12px; color: var(--color-text-muted); }
  hr { border: none; border-top: 1px solid var(--color-border); }
  .btn-primary { background: var(--color-primary); color: white; border-radius: var(--radius-sm); padding: 14px; font-weight: 600; font-size: 15px; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary { background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 12px; font-weight: 500; }
  .alert { padding: 12px; border-radius: var(--radius-sm); font-size: 13px; }
  .alert.error { background: color-mix(in srgb, var(--color-error) 15%, transparent); border: 1px solid var(--color-error); color: var(--color-error); }
  .alert.success { background: color-mix(in srgb, var(--color-success) 15%, transparent); border: 1px solid var(--color-success); color: var(--color-success); }
  .key-dot { font-size: 10px; margin-left: 6px; vertical-align: middle; color: var(--color-text-muted); }
  .key-dot.set { color: var(--color-success); }
</style>
