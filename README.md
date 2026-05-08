# Receipt to ZenMoney

A mobile-first PWA that photographs receipts, extracts transaction data using Claude AI, and imports it directly into [ZenMoney](https://zenmoney.ru).

The app always supports a manual ZenMoney personal token. It can also expose a ZenMoney OAuth flow backed by a minimal Vercel auth broker when the deployer enables it.

## How it works

1. Open the app on your phone and tap **Capture**
2. Take a photo of a receipt (or pick one from your gallery)
3. Claude AI extracts the amount, merchant name, and best-matching category
4. Review and correct the parsed values if needed
5. Tap **Submit to ZenMoney** — the transaction is saved

## First-time setup

The app will redirect you to **Settings** on first launch.

**Claude API key**
Get yours at [console.anthropic.com](https://console.anthropic.com). The key is used locally — it never leaves your device.

**ZenMoney token**
Get yours at [app.zenmoney.ru/consumer](https://app.zenmoney.ru/consumer/). Paste it into the ZenMoney Token field.

**ZenMoney OAuth (optional)**
If the deployer enables `PUBLIC_ZENMONEY_OAUTH_ENABLED=true`, Settings also shows a ZenMoney OAuth connect flow. The browser stores only the short-lived ZenMoney `access_token`; the Vercel backend keeps the `client_secret` and refresh token server-side.

**Load categories**
After saving both keys, tap **Reload Categories**. This fetches your ZenMoney tags and saves them locally so the AI can pick the right one. If you have a single account it is selected automatically; if you have multiple, a picker appears — choose your default.

You only need to do this once. Tap **Reload Categories** again any time your ZenMoney tags change.

## Running locally (development)

```sh
pnpm install
pnpm dev
```

Open `http://localhost:5173` in your browser, or use your LAN IP (e.g. `http://192.168.x.x:5173`) to test on a phone.

For manual-token mode, no ZenMoney server env vars are required.

To test OAuth locally, copy `.env.example` and set:

```sh
ZENMONEY_CLIENT_ID=
ZENMONEY_CLIENT_SECRET=
ZENMONEY_REDIRECT_URI=http://localhost:5173/api/zenmoney/oauth/callback
ZENMONEY_TOKEN_ENCRYPTION_KEY=
PUBLIC_ZENMONEY_OAUTH_ENABLED=true
```

Do not use the old `PUBLIC_ZENMONEY_CLIENT_ID`, `PUBLIC_ZENMONEY_CLIENT_SECRET`, or `PUBLIC_ZENMONEY_REDIRECT_URI` names. The server routes read the private `ZENMONEY_*` variables above.

If you change `.env`, restart `pnpm dev` so SvelteKit reloads the environment.

## Building for production

```sh
pnpm build
```

The app now uses `@sveltejs/adapter-vercel`. Production deployment should target Vercel so the OAuth broker routes and KV-backed session store are available.

Preview the production build locally:

```sh
pnpm preview
```

## Key storage and security

Your Claude API key, manual ZenMoney token, and cached ZenMoney OAuth access token are encrypted with AES-GCM-256 before being written to IndexedDB. The encryption key is generated once, stored as a non-extractable `CryptoKey` object in a separate IndexedDB store, and never serialised to a string. It cannot be read back by JavaScript — only used for encrypt/decrypt operations within the same browser origin.

When OAuth is enabled, the ZenMoney `client_secret` and refresh token are never stored in browser-accessible app state. They stay in the Vercel broker session.

This protects your credentials from casual inspection (DevTools, browser backups, exported storage). It does not protect against malicious code running on the same origin, which is an inherent limitation of any client-side secret store. For a personal single-user tool this is the appropriate trade-off.

## Installing as a PWA

After opening the production build in a mobile browser, use the browser menu to **Add to Home Screen**. The app then opens in standalone mode (no browser chrome) and works like a native app.

## Development commands

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm preview` | Preview production build |
| `pnpm test:unit` | Run unit tests |
| `pnpm check` | TypeScript type check |
| `pnpm lint` | Lint with oxlint |
| `pnpm format` | Format with oxfmt |

## Tech stack

- [SvelteKit 2](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev) — frontend framework with Vercel server routes
- [Melt UI](https://melt-ui.com) — headless accessible component primitives
- [idb](https://github.com/jakearchibald/idb) — IndexedDB wrapper for local storage
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — AES-GCM encryption for stored API keys
- [@anthropic-ai/sdk](https://github.com/anthropic-ai/sdk-js) — Claude AI for receipt parsing
- [@vercel/kv](https://vercel.com/docs/storage/vercel-kv) — broker session storage for ZenMoney OAuth
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app) — service worker and PWA manifest
- [Vitest](https://vitest.dev) — unit testing
- [oxlint](https://oxc.rs/docs/guide/usage/linter) + [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) — linting and formatting
