<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    type,
    message,
    children,
  }: {
    type: 'error' | 'success' | 'warning';
    message?: string;
    children?: Snippet;
  } = $props();
</script>

{#if message || children}
  <div class="alert {type}">
    {#if children}{@render children()}{:else}{message}{/if}
  </div>
{/if}

<style>
  .alert {
    padding: 12px;
    border-radius: var(--radius-sm);
    font-size: 13px;
    max-width: 100%;
    overflow-wrap: break-word;
    min-width: 0;
  }
  .alert.error {
    background: color-mix(in srgb, var(--color-error) 15%, transparent);
    border: 1px solid var(--color-error);
    color: var(--color-error);
  }
  .alert.success {
    background: color-mix(in srgb, var(--color-success) 15%, transparent);
    border: 1px solid var(--color-success);
    color: var(--color-success);
  }
  .alert.warning {
    background: color-mix(in srgb, var(--color-warning) 15%, transparent);
    border: 1px solid var(--color-warning);
    color: var(--color-warning);
  }
</style>
