<script lang="ts">
  let { data }: { data: { appVersion: string } } = $props()
</script>

<div class="page">
  <header class="app-header">
    <div class="app-icon">🧾</div>
    <h1>Receipt to ZenMoney</h1>
    <p class="tagline">Photograph receipts, track expenses</p>
  </header>

  <section>
    <h2>What does it do?</h2>
    <p>
      Receipt to ZenMoney turns a photo of any receipt into a ZenMoney expense — automatically.
      No typing, no manual category picking.
    </p>
    <p>
      Open the app, take a picture, and the transaction appears in your ZenMoney account.
      That's it.
    </p>
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
    <p class="version">Version {data.appVersion}</p>
    <a
      href="https://github.com/konclave/receipt-to-zenmoney/issues"
      target="_blank"
      rel="noopener noreferrer"
      class="bug-link"
    >Found a bug? Report it on GitHub ↗</a>
  </footer>
</div>

<style>
  .page { padding: 20px 16px; display: flex; flex-direction: column; gap: 28px; padding-bottom: calc(var(--nav-height) + 20px); }

  .app-header { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 24px 0 8px; text-align: center; }
  .app-icon { font-size: 56px; line-height: 1; }
  h1 { font-size: 22px; font-weight: 700; margin: 0; }
  .tagline { font-size: 14px; color: var(--color-text-muted); margin: 0; }

  section { display: flex; flex-direction: column; gap: 10px; }
  h2 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--color-text-muted); margin: 0; }
  p { font-size: 15px; line-height: 1.6; color: var(--color-text); margin: 0; }

  .steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0; border: 1px solid var(--color-border); border-radius: var(--radius-md, 12px); overflow: hidden; }
  .steps li { display: flex; align-items: center; gap: 14px; padding: 14px 16px; background: var(--color-surface-2); }
  .steps li + li { border-top: 1px solid var(--color-border); }
  .step-icon { font-size: 22px; flex-shrink: 0; width: 32px; text-align: center; }
  .steps div { display: flex; flex-direction: column; gap: 2px; }
  .steps strong { font-size: 15px; font-weight: 600; }
  .steps span { font-size: 13px; color: var(--color-text-muted); }

  footer { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; border-top: 1px solid var(--color-border); }
  .version { font-size: 12px; color: var(--color-text-muted); margin: 0; }
  .bug-link { font-size: 13px; color: var(--color-primary); text-decoration: none; font-weight: 500; }
  .bug-link:hover { text-decoration: underline; }
</style>
