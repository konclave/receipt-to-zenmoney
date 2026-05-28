<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { get } from 'svelte/store';
  import { goto } from '$app/navigation';
  import { captureStore } from '$lib/stores/capture';
  import { parseReceipt, type AiConfig } from '$lib/services/claude';
  import { resolveReviewAccountId } from '$lib/services/review-account';
  import { runZenmoneyRequestWithStoredToken } from '$lib/services/zenmoney-client';
  import { syncDiff, buildTransactionPayload } from '$lib/services/zenmoney';
  import { getAccounts } from '$lib/db/accounts';
  import { getInstrumentByCurrency } from '$lib/db/instruments';
  import { getSettings, saveSettings } from '$lib/db/settings';
  import { getCategories } from '$lib/db/categories';
  import { saveTransaction, updateTransaction } from '$lib/db/transactions';
  import {
    getPendingCapture,
    clearPendingCapture,
  } from '$lib/db/pending-capture';
  import { saveReceiptImage } from '$lib/db/receipt-images';
  import type { Category, PendingCapture, ZenmoneyAccount } from '$lib/types';
  import Alert from '$lib/components/ui/Alert.svelte';
  import Button from '$lib/components/ui/Button.svelte';

  let capture = $state<PendingCapture | null>(get(captureStore));
  let categories = $state<Category[]>([]);
  let accounts = $state<ZenmoneyAccount[]>([]);
  let parsing = $state(true);
  let submitting = $state(false);
  let parseError = $state<string | null>(null);
  let submitError = $state<string | null>(null);
  let lowConfidence = $state(false);

  let amount = $state('');
  let merchant = $state('');
  let categoryId = $state('');
  let selectedAccountId = $state('');
  let date = $state(new Date().toISOString().slice(0, 10));
  let currency = $state('RUB');

  onMount(async () => {
    if (!capture) {
      const persisted = await getPendingCapture();
      if (persisted) {
        capture = persisted;
        captureStore.set(persisted);
      }
    }
    if (!capture) {
      goto('/');
      return;
    }

    const settings = await getSettings();
    [categories, accounts] = await Promise.all([
      getCategories(),
      getAccounts(),
    ]);
    selectedAccountId = resolveReviewAccountId(
      accounts,
      settings.zenmoneyAccountId,
    );

    try {
      const aiConfig: AiConfig =
        settings.aiProvider === 'openrouter'
          ? {
              provider: 'openrouter',
              apiKey: settings.openrouterApiKey,
              model: settings.openrouterModel,
            }
          : { provider: 'anthropic', apiKey: settings.claudeApiKey };
      if (!aiConfig.apiKey) throw new Error('AI API key not set in Settings');
      if (aiConfig.provider === 'openrouter' && !aiConfig.model.trim())
        throw new Error('OpenRouter model not set in Settings');
      const result = await parseReceipt(
        capture.imageBase64,
        categories,
        aiConfig,
      );
      amount = String(result.amount);
      merchant = result.merchant;
      categoryId = result.categoryId;
      date = result.date;
      currency = result.currency;
      lowConfidence = result.confidence === 'low';
    } catch (e) {
      parseError = `Parsing failed: ${e}. Fill in the fields manually.`;
    } finally {
      parsing = false;
    }
  });

  async function handleBack() {
    await clearPendingCapture();
    captureStore.set(null);
    goto('/');
  }

  async function handleSubmit() {
    submitting = true;
    submitError = null;
    const reviewAccountId = selectedAccountId;
    const txId = crypto.randomUUID();
    const tx = {
      id: txId,
      zenmoneyId: null,
      accountId: reviewAccountId,
      amount: parseFloat(amount) || 0,
      currency,
      merchant,
      categoryId,
      date,
      status: 'pending' as const,
      createdAt: Date.now(),
    };
    await saveTransaction(tx);

    // Persist the receipt image; non-fatal if it fails
    try {
      const blob = await (
        await fetch(`data:${capture!.mimeType};base64,${capture!.imageBase64}`)
      ).blob();
      await saveReceiptImage(txId, { blob, mimeType: capture!.mimeType });
      await updateTransaction(txId, { hasReceipt: true });
    } catch {
      // image save failed — transaction is still saved without hasReceipt
    }

    try {
      const settings = await getSettings();
      if (!reviewAccountId)
        throw new Error(
          'No Zenmoney account available — go to Settings and reload categories',
        );
      if (!settings.zenmoneyUserId)
        throw new Error(
          'No Zenmoney user ID — go to Settings and reload categories',
        );
      const instrument = await getInstrumentByCurrency(tx.currency);
      if (!instrument)
        throw new Error(
          `No Zenmoney instrument for currency ${tx.currency} — go to Settings and reload categories`,
        );
      const payload = buildTransactionPayload(
        tx,
        reviewAccountId,
        settings.zenmoneyUserId,
        instrument.id,
      );
      const diffResponse = await runZenmoneyRequestWithStoredToken((token) =>
        syncDiff(token, settings.zenmoneyServerTimestamp, [payload]),
      );
      await saveSettings({
        zenmoneyServerTimestamp: diffResponse.serverTimestamp,
      });
      await updateTransaction(txId, { status: 'submitted', zenmoneyId: txId });
    } catch (e) {
      await updateTransaction(txId, { status: 'failed' });
      submitError = String(e);
      submitting = false;
      return;
    }
    await clearPendingCapture();
    captureStore.set(null);
    goto('/history');
  }
</script>

<div class="page">
  <div class="header">
    <button class="back" onclick={handleBack}>← Back</button>
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
    <Alert type="warning" message={parseError} />
    <Alert
      type="warning"
      message={lowConfidence
        ? 'Low confidence — please double-check values.'
        : undefined}
    />
    <Alert
      type="warning"
      message={accounts.length === 0
        ? 'No accounts loaded — go to Settings and tap Reload Categories before submitting.'
        : undefined}
    />
    <Alert type="error" message={submitError} />

    <form
      class="form"
      onsubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <div class="field">
        <label for="amount">Amount ({currency})</label>
        <input
          id="amount"
          type="number"
          step="0.01"
          bind:value={amount}
          required
        />
      </div>
      <div class="field">
        <label for="merchant">Merchant</label>
        <input id="merchant" type="text" bind:value={merchant} required />
      </div>
      <div class="field">
        <label for="category">Category</label>
        <select id="category" bind:value={categoryId}>
          <option value="" disabled>Select category</option>
          {#each categories as cat}
            <option value={cat.id}>{cat.title}</option>
          {/each}
        </select>
      </div>
      {#if accounts.length > 1}
        <div class="field">
          <label for="account">Account</label>
          <select id="account" bind:value={selectedAccountId}>
            {#each accounts as account}
              <option value={account.id}>{account.title}</option>
            {/each}
          </select>
        </div>
      {/if}
      <div class="field">
        <label for="date">Date</label>
        <input id="date" type="date" bind:value={date} required />
      </div>
      <Button
        type="submit"
        disabled={submitting}
        style="padding: 16px; font-size: 16px; margin-top: 8px;"
      >
        {submitting ? 'Submitting…' : 'Submit to Zenmoney'}
      </Button>
    </form>
  {/if}
</div>

<style>
  .page {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-bottom: calc(var(--nav-height) + 16px);
  }
  .header {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .back {
    color: var(--color-primary);
    font-size: 15px;
  }
  h1 {
    font-size: 20px;
    font-weight: 700;
  }
  .thumbnail {
    width: 100%;
    max-height: 160px;
    object-fit: cover;
    border-radius: var(--radius-md);
    border: 1px solid var(--color-border);
  }
  .parsing {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 48px 0;
    color: var(--color-text-muted);
  }
  .spinner {
    width: 36px;
    height: 36px;
    border: 3px solid var(--color-border);
    border-top-color: var(--color-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  select {
    appearance: none;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 12px;
    font-size: 15px;
    color: var(--color-text);
  }
</style>
