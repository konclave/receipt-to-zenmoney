<script lang="ts">
  import type { StorageStats } from '$lib/services/storage-stats'
  import { formatBytes } from '$lib/services/storage-stats'

  let { stats, onselect, onclose }: {
    stats: StorageStats
    onselect: (period: number | 'all') => void
    onclose: () => void
  } = $props()

  const totalTxCount = $derived(stats.byYear.reduce((s, y) => s + y.txCount, 0))
</script>

<div class="overlay" role="presentation" onclick={onclose}>
  <div
    class="modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="cleanup-title"
    onclick={(e) => e.stopPropagation()}
  >
    <div class="modal-header">
      <h2 id="cleanup-title">Clean Up Data</h2>
      <p class="subtitle">Select a period to delete</p>
    </div>
    <div class="modal-body">
      {#each stats.byYear as yearStat}
        <div class="year-row">
          <div class="year-info">
            <span class="year">{yearStat.year}</span>
            <span class="meta">{yearStat.txCount} transactions · {formatBytes(yearStat.bytes)}</span>
          </div>
          <button class="btn-delete" onclick={() => onselect(yearStat.year)}>Delete</button>
        </div>
      {/each}
      <div class="year-row all-row">
        <div class="year-info">
          <span class="year-all">All years</span>
          <span class="meta">{totalTxCount} transactions · {formatBytes(stats.totalBytes)}</span>
        </div>
        <button class="btn-delete-all" onclick={() => onselect('all')}>Delete all</button>
      </div>
    </div>
    <div class="modal-footer">
      <button class="btn-cancel" onclick={onclose}>Cancel</button>
    </div>
  </div>
</div>

<style>
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: flex-end; z-index: 100; }
  .modal { background: var(--color-surface); border-radius: 16px 16px 0 0; width: 100%; max-height: 80vh; overflow-y: auto; }
  .modal-header { padding: 20px 16px 12px; border-bottom: 1px solid var(--color-border); }
  h2 { font-size: 18px; font-weight: 700; margin: 0; }
  .subtitle { font-size: 13px; color: var(--color-text-muted); margin: 4px 0 0; }
  .modal-body { display: flex; flex-direction: column; }
  .year-row { display: flex; align-items: center; padding: 14px 16px; border-bottom: 1px solid var(--color-border); gap: 12px; }
  .all-row { background: var(--color-surface-2); }
  .year-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .year { font-weight: 600; font-size: 15px; }
  .year-all { font-weight: 600; font-size: 15px; color: var(--color-error, #d93025); }
  .meta { font-size: 12px; color: var(--color-text-muted); }
  .btn-delete { background: color-mix(in srgb, var(--color-error, #d93025) 15%, transparent); color: var(--color-error, #d93025); border: none; border-radius: var(--radius-sm); padding: 6px 12px; font-size: 13px; font-weight: 500; cursor: pointer; }
  .btn-delete-all { background: var(--color-error, #d93025); color: #fff; border: none; border-radius: var(--radius-sm); padding: 6px 12px; font-size: 13px; font-weight: 500; cursor: pointer; }
  .modal-footer { padding: 12px 16px; }
  .btn-cancel { width: 100%; background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 12px; font-weight: 500; font-size: 15px; cursor: pointer; }
</style>
