<script lang="ts">
  import { onMount } from "svelte";
  import { goto } from "$app/navigation";
  import { getZenmoneyAccessToken } from "$lib/services/zenmoney-access";

  let status = $state<"loading" | "error">("loading");
  let errorMessage = $state("");

  onMount(async () => {
    try {
      await getZenmoneyAccessToken(true);
      goto("/settings?zenmoneyConnected=1");
    } catch (e) {
      status = "error";
      errorMessage = e instanceof Error ? e.message : "Authentication failed.";
    }
  });
</script>

<div class="page">
  {#if status === "loading"}
    <p class="message">Connecting to Zenmoney…</p>
  {:else}
    <p class="message error">{errorMessage}</p>
    <a href="/settings" class="back">Back to Settings</a>
  {/if}
</div>

<style>
  .page {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    height: 100dvh;
    padding: 24px;
    text-align: center;
  }
  .message {
    font-size: 15px;
    color: var(--color-text);
    margin: 0;
  }
  .error {
    color: var(--color-error, #e57373);
  }
  .back {
    font-size: 14px;
    color: var(--color-primary);
    text-decoration: none;
    font-weight: 500;
  }
  .back:hover {
    text-decoration: underline;
  }
</style>
