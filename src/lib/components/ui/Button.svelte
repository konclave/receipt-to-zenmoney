<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';

  let {
    variant = 'primary',
    children,
    ...rest
  }: {
    variant?: 'primary' | 'secondary' | 'danger';
    children: Snippet;
  } & HTMLButtonAttributes = $props();
</script>

<button class="btn btn-{variant}" {...rest}>
  {@render children()}
</button>

<style>
  .btn {
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn-primary {
    background: var(--color-primary);
    color: white;
    border: none;
    padding: 14px;
    font-weight: 600;
    font-size: 15px;
  }
  .btn-secondary {
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    padding: 12px;
    font-weight: 500;
  }
  .btn-danger {
    background: color-mix(in srgb, var(--color-error) 12%, transparent);
    color: var(--color-error);
    border: 1px solid color-mix(in srgb, var(--color-error) 30%, transparent);
    padding: 12px;
    font-weight: 500;
    font-size: 15px;
  }
</style>
