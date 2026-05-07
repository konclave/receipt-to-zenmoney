<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { page } from '$app/stores'
  import { goto } from '$app/navigation'
  import { get } from 'svelte/store'
  import { getTransaction } from '$lib/db/transactions'
  import { getReceiptImage } from '$lib/db/receipt-images'
  import { getCategories } from '$lib/db/categories'
  import type { Transaction, Category, ReceiptImage } from '$lib/types'

  const txId = get(page).params.id

  let transaction = $state<Transaction | null>(null)
  let receiptImage = $state<ReceiptImage | null>(null)
  let categories = $state<Category[]>([])
  let imageUrl = $state<string | null>(null)
  let loading = $state(true)

  onMount(async () => {
    ;[transaction, receiptImage, categories] = await Promise.all([
      getTransaction(txId),
      getReceiptImage(txId),
      getCategories(),
    ])
    if (!transaction) { loading = false; goto('/history'); return }
    if (receiptImage) imageUrl = URL.createObjectURL(receiptImage.blob)
    loading = false
  })

  onDestroy(() => {
    if (imageUrl) URL.revokeObjectURL(imageUrl)
  })

  const category = $derived(
    transaction ? categories.find((c) => c.id === transaction!.categoryId) : undefined
  )
  const formattedAmount = $derived(
    transaction
      ? new Intl.NumberFormat('ru-RU', { style: 'currency', currency: transaction.currency }).format(
          transaction.amount
        )
      : ''
  )
  const formattedDate = $derived(
    transaction
      ? new Date(transaction.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })
      : ''
  )
</script>

<div class="page">
  <div class="header">
    <a href="/history" class="back">← Back</a>
    <h1>Receipt</h1>
  </div>

  {#if loading}
    <div class="loading">Loading…</div>
  {:else}
    {#if imageUrl}
      <img src={imageUrl} alt="Receipt" class="receipt-img" />
    {:else}
      <div class="no-image">No receipt image available</div>
    {/if}

    {#if transaction}
      <div class="summary">
        <div class="summary-row">
          <span class="label">Merchant</span>
          <span>{transaction.merchant || 'Unknown'}</span>
        </div>
        <div class="summary-row">
          <span class="label">Amount</span>
          <span>−{formattedAmount}</span>
        </div>
        <div class="summary-row">
          <span class="label">Category</span>
          <span>{category?.title ?? 'Uncategorized'}</span>
        </div>
        <div class="summary-row">
          <span class="label">Date</span>
          <span>{formattedDate}</span>
        </div>
        <div class="summary-row">
          <span class="label">Status</span>
          <span class="badge badge-{transaction.status}">{transaction.status}</span>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .page { padding: 16px; display: flex; flex-direction: column; gap: 16px; padding-bottom: calc(var(--nav-height) + 16px); }
  .header { display: flex; align-items: center; gap: 12px; }
  .back { color: var(--color-primary); font-size: 15px; }
  h1 { font-size: 20px; font-weight: 700; }
  .loading { padding: 48px 16px; text-align: center; color: var(--color-text-muted); }
  .receipt-img { width: 100%; border-radius: var(--radius-md); border: 1px solid var(--color-border); object-fit: contain; }
  .no-image { padding: 48px 16px; text-align: center; color: var(--color-text-muted); border: 1px dashed var(--color-border); border-radius: var(--radius-md); }
  .summary { display: flex; flex-direction: column; gap: 0; border: 1px solid var(--color-border); border-radius: var(--radius-md); overflow: hidden; }
  .summary-row { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--color-border); font-size: 14px; }
  .summary-row:last-child { border-bottom: none; }
  .label { color: var(--color-text-muted); font-size: 13px; }
  .badge { font-size: 11px; padding: 2px 8px; border-radius: 99px; font-weight: 500; }
  .badge-submitted { background: color-mix(in srgb, var(--color-success) 20%, transparent); color: var(--color-success); }
  .badge-pending { background: color-mix(in srgb, var(--color-warning) 20%, transparent); color: var(--color-warning); }
  .badge-failed { background: color-mix(in srgb, var(--color-error) 20%, transparent); color: var(--color-error); }
</style>
