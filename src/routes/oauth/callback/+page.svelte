<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { getSettings, saveSettings } from '$lib/db/settings'
  import { exchangeCodeForToken } from '$lib/services/zenmoney-auth'

  let status = $state<'loading' | 'error'>('loading')
  let errorMessage = $state('')

  onMount(async () => {
    const code = $page.url.searchParams.get('code')
    const returnedState = $page.url.searchParams.get('state')
    const savedState = sessionStorage.getItem('zm_oauth_state')
    sessionStorage.removeItem('zm_oauth_state')

    if (!code || !returnedState || returnedState !== savedState) {
      status = 'error'
      errorMessage = 'Invalid or missing OAuth state. Please try connecting again.'
      return
    }

    try {
      const token = await exchangeCodeForToken(code)
      const existing = await getSettings()
      await saveSettings({ ...existing, zenmoneyToken: token })
      goto('/settings')
    } catch (e) {
      status = 'error'
      errorMessage = e instanceof Error ? e.message : 'Authentication failed.'
    }
  })
</script>

<div class="page">
  {#if status === 'loading'}
    <p class="message">Connecting to ZenMoney…</p>
  {:else}
    <p class="message error">{errorMessage}</p>
    <a href="/settings" class="back">Back to Settings</a>
  {/if}
</div>

<style>
  .page { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 16px; height: 100dvh; padding: 24px; text-align: center; }
  .message { font-size: 15px; color: var(--color-text); margin: 0; }
  .error { color: var(--color-error, #e57373); }
  .back { font-size: 14px; color: var(--color-primary); text-decoration: none; font-weight: 500; }
  .back:hover { text-decoration: underline; }
</style>
