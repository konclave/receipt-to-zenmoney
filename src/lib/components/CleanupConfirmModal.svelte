<script lang="ts">
  import { formatBytes } from '$lib/services/storage-stats'

  let { period, txCount, bytes, onconfirm, onclose }: {
    period: number | 'all'
    txCount: number
    bytes: number
    onconfirm: (opts: { withBackup: boolean }) => void
    onclose: () => void
  } = $props()

  let confirmingDelete = $state(false)

  const title = $derived(period === 'all' ? 'Delete all data?' : `Delete ${period} data?`)
  const backupFilename = $derived(
    period === 'all'
      ? `rzm-backup-all-${new Date().toISOString().slice(0, 10)}.rzm.gz`
      : `rzm-backup-${period}.rzm.gz`,
  )
</script>

<div
  class="overlay"
  role="presentation"
  tabindex="-1"
  onclick={onclose}
  onkeydown={(event) => {
    if (event.key === 'Escape') onclose()
  }}
>
  <div
    class="modal"
    role="dialog"
    aria-modal="true"
    aria-labelledby="confirm-title"
    tabindex="-1"
    onclick={(e) => e.stopPropagation()}
    onkeydown={(e) => e.stopPropagation()}
  >
    <div class="modal-header">
      <h2 id="confirm-title">{title}</h2>
      <p class="subtitle">{txCount} transactions · {formatBytes(bytes)}</p>
    </div>
    <div class="modal-body">
      {#if !confirmingDelete}
        <p class="description">Download a backup of this period before deleting? The file can be reimported later.</p>
        <button class="btn-primary" onclick={() => onconfirm({ withBackup: true })}>
          <span>Download backup & delete</span>
          <span class="btn-hint">Saves {backupFilename} first</span>
        </button>
        <button class="btn-delete-secondary" onclick={() => { confirmingDelete = true }}>
          Delete without backup
        </button>
      {:else}
        <p class="description warning">Are you sure? This cannot be undone.</p>
        <button class="btn-delete-confirm" onclick={() => onconfirm({ withBackup: false })}>
          Yes, delete permanently
        </button>
        <button class="btn-back" onclick={() => { confirmingDelete = false }}>Go back</button>
      {/if}
      <button class="btn-cancel" onclick={onclose}>Cancel</button>
    </div>
  </div>
</div>

<style>
  .overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: flex-end; z-index: 100; }
  .modal { background: var(--color-surface); border-radius: 16px 16px 0 0; width: 100%; }
  .modal-header { padding: 20px 16px 12px; border-bottom: 1px solid var(--color-border); }
  h2 { font-size: 18px; font-weight: 700; margin: 0; }
  .subtitle { font-size: 13px; color: var(--color-text-muted); margin: 4px 0 0; }
  .modal-body { padding: 16px; display: flex; flex-direction: column; gap: 10px; }
  .description { font-size: 14px; color: var(--color-text-muted); line-height: 1.5; margin: 0; }
  .description.warning { color: var(--color-error, #d93025); font-weight: 500; }
  .btn-primary { background: var(--color-primary); color: #fff; border: none; border-radius: var(--radius-sm); padding: 14px 16px; font-size: 15px; font-weight: 600; cursor: pointer; display: flex; flex-direction: column; gap: 3px; width: 100%; text-align: left; }
  .btn-hint { font-size: 11px; font-weight: 400; opacity: 0.8; }
  .btn-delete-secondary { background: color-mix(in srgb, var(--color-error, #d93025) 12%, transparent); color: var(--color-error, #d93025); border: 1px solid color-mix(in srgb, var(--color-error, #d93025) 30%, transparent); border-radius: var(--radius-sm); padding: 14px; font-size: 15px; font-weight: 500; cursor: pointer; }
  .btn-delete-confirm { background: var(--color-error, #d93025); color: #fff; border: none; border-radius: var(--radius-sm); padding: 14px; font-size: 15px; font-weight: 600; cursor: pointer; }
  .btn-back { background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 12px; font-size: 15px; font-weight: 500; cursor: pointer; }
  .btn-cancel { background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 12px; font-size: 15px; font-weight: 500; cursor: pointer; }
</style>
