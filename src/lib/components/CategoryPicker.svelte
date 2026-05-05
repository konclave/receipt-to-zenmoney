<!-- src/lib/components/CategoryPicker.svelte -->
<script lang="ts">
  import { Select } from 'melt/builders'
  import type { Category } from '$lib/types'

  let {
    categories,
    value = $bindable(''),
    placeholder = 'Select category'
  }: {
    categories: Category[]
    value?: string
    placeholder?: string
  } = $props()

  const select = new Select({
    value: () => value,
    onValueChange: (v: string | undefined) => {
      value = v ?? ''
    }
  })

  const label = $derived(categories.find((c) => c.id === value)?.title ?? placeholder)
</script>

<div class="picker">
  <button class="trigger" {...select.trigger}>
    {label}
    <span class="chevron" aria-hidden="true">▾</span>
  </button>

  <div class="menu" {...select.content}>
    {#if categories.length === 0}
      <div class="option disabled">No categories — reload in Settings</div>
    {/if}
    {#each categories as cat}
      <div class="option" class:selected={select.isSelected(cat.id)} {...select.getOption(cat.id, cat.title)}>
        {cat.title}
        {#if select.isSelected(cat.id)}<span class="check">✓</span>{/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .picker { position: relative; }

  .trigger {
    width: 100%;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 12px;
    text-align: left;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 15px;
  }

  .trigger:focus { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .chevron { color: var(--color-text-muted); font-size: 12px; }

  .menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    max-height: 260px;
    overflow-y: auto;
    z-index: 50;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  }

  .menu[data-state='closed'] { display: none; }

  .option {
    padding: 12px 16px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--color-border);
  }

  .option:last-child { border-bottom: none; }
  .option:hover { background: var(--color-surface-2); }
  .option.selected { color: var(--color-primary); }
  .option.disabled { color: var(--color-text-muted); cursor: default; font-style: italic; }
  .check { color: var(--color-primary); font-size: 13px; }
</style>
