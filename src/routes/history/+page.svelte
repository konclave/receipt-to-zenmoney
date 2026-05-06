<script lang="ts">
  import { onMount } from 'svelte'
  import { getTransactions, updateTransaction } from '$lib/db/transactions'
  import { getCategories } from '$lib/db/categories'
  import { getSettings, saveSettings } from '$lib/db/settings'
  import { syncDiff, buildTransactionPayload } from '$lib/services/zenmoney'
  import TransactionCard from '$lib/components/TransactionCard.svelte'
  import type { Transaction, Category } from '$lib/types'

  let transactions = $state<Transaction[]>([])
  let categories = $state<Category[]>([])
  let loading = $state(true)

  onMount(async () => {
    ;[transactions, categories] = await Promise.all([getTransactions(), getCategories()])
    loading = false
  })

  async function retryTransaction(tx: Transaction): Promise<void> {
    const settings = await getSettings()
    if (!settings.zenmoneyToken) throw new Error('ZenMoney token not set')
    if (!settings.zenmoneyAccountId)
      throw new Error('No default account set — go to Settings → Reload Categories')

    await updateTransaction(tx.id, { status: 'pending' })
    transactions = await getTransactions()

    try {
      const payload = buildTransactionPayload(tx, settings.zenmoneyAccountId)
      const diffResponse = await syncDiff(
        settings.zenmoneyToken,
        settings.zenmoneyServerTimestamp,
        [payload]
      )
      await saveSettings({ zenmoneyServerTimestamp: diffResponse.serverTimestamp })
      // ZenMoney accepts the client-supplied UUID as the canonical ID, so tx.id is the correct zenmoneyId
      await updateTransaction(tx.id, { status: 'submitted', zenmoneyId: tx.id })
    } catch (e) {
      await updateTransaction(tx.id, { status: 'failed' })
      throw e
    } finally {
      transactions = await getTransactions()
    }
  }
</script>

<div class="page">
  <h1>History</h1>
  {#if loading}
    <div class="empty">Loading…</div>
  {:else if transactions.length === 0}
    <div class="empty">
      <p>No transactions yet.</p>
      <p>Capture a receipt to get started.</p>
    </div>
  {:else}
    <div class="list">
      {#each transactions as tx (tx.id)}
        <TransactionCard transaction={tx} {categories} onRetry={tx.status === 'failed' ? retryTransaction : undefined} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .page { padding-top: 20px; padding-bottom: var(--nav-height); }
  h1 { font-size: 24px; font-weight: 700; padding: 0 16px 16px; }
  .list { border-top: 1px solid var(--color-border); }
  .empty { padding: 48px 16px; text-align: center; color: var(--color-text-muted); display: flex; flex-direction: column; gap: 8px; }
</style>
