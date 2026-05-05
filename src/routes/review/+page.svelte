<!-- src/routes/review/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { goto } from '$app/navigation'
  import { captureStore } from '$lib/stores/capture'
  import { parseReceipt } from '$lib/services/claude'
  import { syncDiff, buildTransactionPayload } from '$lib/services/zenmoney'
  import { getSettings } from '$lib/db/settings'
  import { getCategories } from '$lib/db/categories'
  import { saveTransaction, updateTransaction } from '$lib/db/transactions'
  import CategoryPicker from '$lib/components/CategoryPicker.svelte'
  import type { Category } from '$lib/types'

  let capture = get(captureStore)
  let categories = $state<Category[]>([])
  let parsing = $state(true)
  let submitting = $state(false)
  let parseError = $state<string | null>(null)
  let submitError = $state<string | null>(null)
  let lowConfidence = $state(false)

  let amount = $state('')
  let merchant = $state('')
  let categoryId = $state('')
  let date = $state(new Date().toISOString().slice(0, 10))
  let currency = $state('RUB')

  onMount(async () => {
    if (!capture) { goto('/'); return }
    categories = await getCategories()
    try {
      const settings = await getSettings()
      if (!settings.claudeApiKey) throw new Error('Claude API key not set in Settings')
      const result = await parseReceipt(capture.imageBase64, categories, settings.claudeApiKey)
      amount = String(result.amount)
      merchant = result.merchant
      categoryId = result.categoryId
      date = result.date
      currency = result.currency
      lowConfidence = result.confidence === 'low'
    } catch (e) {
      parseError = `Parsing failed: ${e}. Fill in the fields manually.`
    } finally {
      parsing = false
    }
  })

  async function handleSubmit() {
    submitting = true
    submitError = null
    const txId = crypto.randomUUID()
    const tx = {
      id: txId,
      zenmoneyId: null,
      amount: parseFloat(amount) || 0,
      currency,
      merchant,
      categoryId,
      date,
      status: 'pending' as const,
      createdAt: Date.now()
    }
    await saveTransaction(tx)
    try {
      const settings = await getSettings()
      if (!settings.zenmoneyToken) throw new Error('ZenMoney token not set')
      if (!settings.zenmoneyAccountId)
        throw new Error('No default account set — go to Settings → Reload Categories')
      const payload = buildTransactionPayload(tx, settings.zenmoneyAccountId)
      await syncDiff(settings.zenmoneyToken, settings.zenmoneyServerTimestamp, [payload])
      await updateTransaction(txId, { status: 'submitted', zenmoneyId: txId })
    } catch (e) {
      await updateTransaction(txId, { status: 'failed' })
      submitError = String(e)
      submitting = false
      return
    }
    captureStore.set(null)
    goto('/history')
  }
</script>

<div class="page">
  <div class="header">
    <button class="back" onclick={() => goto('/')}>← Back</button>
    <h1>Review</h1>
  </div>

  {#if capture}
    <img
      src={`data:${capture.mimeType};base64,${capture.imageBase64}`}
      alt="Receipt"
      class="thumbnail"
    />
  {/if}

  {#if parsing}
    <div class="parsing">
      <div class="spinner"></div>
      <p>Parsing receipt…</p>
    </div>
  {:else}
    {#if parseError}<div class="alert warning">{parseError}</div>{/if}
    {#if lowConfidence}<div class="alert warning">Low confidence — please double-check values.</div>{/if}
    {#if submitError}<div class="alert error">{submitError}</div>{/if}

    <form class="form" onsubmit={(e) => { e.preventDefault(); handleSubmit() }}>
      <div class="field">
        <label for="amount">Amount ({currency})</label>
        <input id="amount" type="number" step="0.01" bind:value={amount} required />
      </div>
      <div class="field">
        <label for="merchant">Merchant</label>
        <input id="merchant" type="text" bind:value={merchant} required />
      </div>
      <div class="field">
        <span class="label">Category</span>
        <CategoryPicker {categories} bind:value={categoryId} />
      </div>
      <div class="field">
        <label for="date">Date</label>
        <input id="date" type="date" bind:value={date} required />
      </div>
      <button type="submit" class="btn-primary" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Submit to ZenMoney'}
      </button>
    </form>
  {/if}
</div>

<style>
  .page { padding: 16px; display: flex; flex-direction: column; gap: 16px; padding-bottom: calc(var(--nav-height) + 16px); }
  .header { display: flex; align-items: center; gap: 12px; }
  .back { color: var(--color-primary); font-size: 15px; }
  h1 { font-size: 20px; font-weight: 700; }
  .thumbnail { width: 100%; max-height: 160px; object-fit: cover; border-radius: var(--radius-md); border: 1px solid var(--color-border); }
  .parsing { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 48px 0; color: var(--color-text-muted); }
  .spinner { width: 36px; height: 36px; border: 3px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .form { display: flex; flex-direction: column; gap: 16px; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  label, .label { font-size: 13px; font-weight: 500; color: var(--color-text-muted); }
  .btn-primary { background: var(--color-primary); color: white; border-radius: var(--radius-sm); padding: 16px; font-weight: 600; font-size: 16px; margin-top: 8px; }
  .btn-primary:disabled { opacity: 0.5; }
  .alert { padding: 12px; border-radius: var(--radius-sm); font-size: 13px; }
  .alert.warning { background: color-mix(in srgb, var(--color-warning) 15%, transparent); border: 1px solid var(--color-warning); color: var(--color-warning); }
  .alert.error { background: color-mix(in srgb, var(--color-error) 15%, transparent); border: 1px solid var(--color-error); color: var(--color-error); }
</style>
