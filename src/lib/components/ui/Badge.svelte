<script lang="ts">
  let { status }: { status: 'submitted' | 'pending' | 'failed' } = $props();
</script>

<span class="badge badge-{status}">{status}</span>

<style>
  .badge {
    font-size: 11px;
    padding: 2px 8px;
    border-radius: 99px;
    font-weight: 500;
  }
  .badge-submitted {
    background: color-mix(in srgb, var(--color-success) 20%, transparent);
    color: var(--color-success);
  }
  .badge-pending {
    background: color-mix(in srgb, var(--color-warning) 20%, transparent);
    color: var(--color-warning);
  }
  .badge-failed {
    background: color-mix(in srgb, var(--color-error) 20%, transparent);
    color: var(--color-error);
  }
</style>
