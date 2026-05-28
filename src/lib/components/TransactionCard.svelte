<script lang="ts">
  import type { Transaction, Category, ReceiptImage } from '$lib/types';
  import Badge from '$lib/components/ui/Badge.svelte';

  let {
    transaction,
    categories,
    receiptImage,
    onRetry,
  }: {
    transaction: Transaction;
    categories: Category[];
    receiptImage?: ReceiptImage;
    onRetry?: (tx: Transaction) => Promise<void>;
  } = $props();

  const category = $derived(
    categories.find((c) => c.id === transaction.categoryId),
  );
  const formattedAmount = $derived(
    new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: transaction.currency,
    }).format(transaction.amount),
  );
  const formattedDate = $derived(
    new Date(transaction.date).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
    }),
  );

  let retrying = $state(false);
  let retryError = $state<string | null>(null);

  let thumbnailUrl = $state<string | null>(null);
  $effect(() => {
    if (!receiptImage) return;
    const url = URL.createObjectURL(receiptImage.blob);
    thumbnailUrl = url;
    return () => URL.revokeObjectURL(url);
  });

  async function handleRetry() {
    if (!onRetry) return;
    retrying = true;
    retryError = null;
    try {
      await onRetry(transaction);
    } catch (e) {
      retryError = e instanceof Error ? e.message : String(e);
    } finally {
      retrying = false;
    }
  }
</script>

<div class="card">
  <div class="row">
    <div class="left">
      <span class="merchant">{transaction.merchant || 'Unknown'}</span>
      <span class="meta"
        >{category?.title ?? 'Uncategorized'} · {formattedDate}</span
      >
    </div>
    <div class="right">
      <span class="amount">−{formattedAmount}</span>
      <Badge status={transaction.status} />
    </div>
  </div>
  {#if thumbnailUrl}
    <div class="thumbnail-row">
      <a href="/receipt/{transaction.id}">
        <img src={thumbnailUrl} alt="Receipt" class="thumbnail" />
      </a>
    </div>
  {/if}
  {#if transaction.status === 'failed' && onRetry}
    <div class="retry-row">
      {#if retryError}<span class="retry-error">{retryError}</span>{/if}
      <button class="btn-retry" onclick={handleRetry} disabled={retrying}>
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  {/if}
</div>

<style>
  .card {
    padding: 14px 16px;
    border-bottom: 1px solid var(--color-border);
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 8px;
  }
  .left {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .merchant {
    font-size: 15px;
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .meta {
    font-size: 12px;
    color: var(--color-text-muted);
  }
  .right {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    flex-shrink: 0;
  }
  .amount {
    font-size: 15px;
    font-weight: 600;
  }
  .thumbnail-row {
    margin-top: 8px;
  }
  .thumbnail {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: var(--radius-sm);
    border: 1px solid var(--color-border);
    display: block;
  }
  .retry-row {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 8px;
    margin-top: 8px;
  }
  .retry-error {
    font-size: 11px;
    color: var(--color-error);
    flex: 1;
  }
  .btn-retry {
    font-size: 12px;
    font-weight: 600;
    color: var(--color-primary);
    padding: 4px 12px;
    border: 1px solid var(--color-primary);
    border-radius: var(--radius-sm);
  }
  .btn-retry:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>
