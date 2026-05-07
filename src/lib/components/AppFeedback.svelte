<script lang="ts">
    let { appVersion }: { appVersion: string } = $props();
</script>

<div class="version-row">
    <span class="version">Version {appVersion}</span>
    <a
        href="https://github.com/konclave/receipt-to-zenmoney/issues"
        target="_blank"
        rel="noopener noreferrer"
        class="bug-link">Report a bug ↗</a
    >
</div>

<style>
    .version {
        font-size: 12px;
        color: var(--color-text-muted);
        margin: 0;
    }
    .version-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    .bug-link {
        font-size: 13px;
        color: var(--color-primary);
        text-decoration: none;
        font-weight: 500;
    }
    .bug-link:hover {
        text-decoration: underline;
    }
</style>
