<script lang="ts">
  import AppFeedback from '$lib/components/AppFeedback.svelte';

  let { data }: { data: { appVersion: string } } = $props();
</script>

<div class="page">
  <a href="/" class="app-header">
    <div class="app-icon">🧾</div>
    <div class="app-title">
      <h1>Receipt to ZenMoney</h1>
      <p class="tagline">Photograph receipts, track expenses</p>
    </div>
  </a>

  <section>
    <h2>What does it do?</h2>
    <p>
      Receipt to ZenMoney turns a photo of any receipt into a ZenMoney expense
      — automatically. No typing, no manual category picking.
    </p>
    <p>
      Open the app, take a picture, and the transaction appears in your
      ZenMoney account. That's it.
    </p>
  </section>

  <section>
    <h2>Privacy & your data</h2>
    <ul class="facts">
      <li>
        <span class="fact-icon">📱</span>
        <div>
          <strong>Installs like a native app</strong>
          <span>Add it to your home screen — no App Store needed. Works offline between syncs.</span>
        </div>
      </li>
      <li>
        <span class="fact-icon">🔒</span>
        <div>
          <strong>Everything stays on your device</strong>
          <span>Transactions, receipts, and settings are stored locally. Nothing is uploaded to any server.</span>
        </div>
      </li>
      <li>
        <span class="fact-icon">👁️</span>
        <div>
          <strong>AI only sees the photo</strong>
          <span>The AI model receives only the receipt image — no account details, no history, no personal data.</span>
        </div>
      </li>
      <li>
        <span class="fact-icon">🔗</span>
        <div>
          <strong>No middleman</strong>
          <span>The app has no backend of its own. It talks directly to ZenMoney using your credentials.</span>
        </div>
      </li>
    </ul>
  </section>

  <section>
    <h2>How it works</h2>
    <ol class="steps">
      <li>
        <span class="step-icon">📷</span>
        <div>
          <strong>Photograph</strong>
          <span>Point your camera at a receipt</span>
        </div>
      </li>
      <li>
        <span class="step-icon">🤖</span>
        <div>
          <strong>Auto-read</strong>
          <span>AI reads the amount, store name, and date</span>
        </div>
      </li>
      <li>
        <span class="step-icon">✅</span>
        <div>
          <strong>Synced</strong>
          <span>The expense lands in ZenMoney instantly</span>
        </div>
      </li>
    </ol>
  </section>

  <footer>
    <AppFeedback appVersion={data.appVersion} />
  </footer>
</div>

<style>
  .page {
    padding: 20px 16px;
    display: flex;
    flex-direction: column;
    gap: 28px;
    padding-bottom: calc(var(--nav-height) + 20px);
  }

  .app-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 24px 0 8px;
    text-align: center;
    text-decoration: none;
    color: inherit;
  }
  .app-icon {
    font-size: 56px;
    line-height: 1;
  }
  h1 {
    font-size: 22px;
    font-weight: 700;
    margin: 0;
  }
  .tagline {
    font-size: 14px;
    color: var(--color-text-muted);
    margin: 0;
  }

  section {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  h2 {
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
    margin: 0;
  }
  p {
    font-size: 15px;
    line-height: 1.6;
    color: var(--color-text);
    margin: 0;
  }

  .steps,
  .facts {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md, 12px);
    overflow: hidden;
  }
  .steps li,
  .facts li {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 16px;
    background: var(--color-surface-2);
  }
  .steps li + li,
  .facts li + li {
    border-top: 1px solid var(--color-border);
  }
  .step-icon,
  .fact-icon {
    font-size: 22px;
    flex-shrink: 0;
    width: 32px;
    text-align: center;
  }
  .steps div,
  .facts div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .steps strong,
  .facts strong {
    font-size: 15px;
    font-weight: 600;
  }
  .steps span,
  .facts span {
    font-size: 13px;
    color: var(--color-text-muted);
  }

  footer {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 16px;
    border-top: 1px solid var(--color-border);
  }

  @media (min-width: 640px) {
    .page {
      max-width: 600px;
      margin: 0 auto;
      padding: 40px 24px 80px;
      gap: 40px;
    }

    .app-header {
      flex-direction: row;
      align-items: center;
      justify-content: flex-start;
      padding: 0;
      gap: 14px;
      text-align: left;
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 32px;
    }
    .app-header:hover .app-icon {
      transform: scale(1.08);
    }
    .app-icon {
      font-size: 40px;
      transition: transform 0.15s;
    }
    h1 {
      font-size: 22px;
    }
    .tagline {
      font-size: 14px;
    }

    h2 {
      font-size: 26px;
      text-transform: none;
      letter-spacing: 0;
      color: var(--color-text);
      font-weight: 700;
    }
    p {
      font-size: 18px;
    }

    .steps strong,
    .facts strong {
      font-size: 16px;
    }
    .steps span,
    .facts span {
      font-size: 14px;
    }

    footer {
      display: none;
    }
  }
</style>
