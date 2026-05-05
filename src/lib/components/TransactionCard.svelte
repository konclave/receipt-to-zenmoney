<script lang="ts">
  import type { Transaction, Category } from '$lib/types'

  let { transaction, categories }: { transaction: Transaction; categories: Category[] } = $props()

  const category = $derived(categories.find((c) => c.id === transaction.categoryId))
  const formattedAmount = $derived(
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: transaction.currency }).format(
      transaction.amount
    )
  )
  const formattedDate = $derived(
    new Date(transaction.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  )
</script>

<div class="card">
  <div class="row">
    <div class="left">
      <span class="merchant">{transaction.merchant || 'Unknown'}</span>
      <span class="meta">{category?.title ?? 'Uncategorized'} · {formattedDate}</span>
    </div>
    <div class="right">
      <span class="amount">−{formattedAmount}</span>
      <span class="badge badge-{transaction.status}">{transaction.status}</span>
    </div>
  </div>
</div>

<style>
  .card { padding: 14px 16px; border-bottom: 1px solid var(--color-border); }
  .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .left { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .merchant { font-size: 15px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .meta { font-size: 12px; color: var(--color-text-muted); }
  .right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
  .amount { font-size: 15px; font-weight: 600; }
  .badge { font-size: 11px; padding: 2px 8px; border-radius: 99px; font-weight: 500; }
  .badge-submitted { background: color-mix(in srgb, var(--color-success) 20%, transparent); color: var(--color-success); }
  .badge-pending { background: color-mix(in srgb, var(--color-warning) 20%, transparent); color: var(--color-warning); }
  .badge-failed { background: color-mix(in srgb, var(--color-error) 20%, transparent); color: var(--color-error); }
</style>
