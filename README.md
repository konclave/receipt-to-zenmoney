# Receipt to ZenMoney

A mobile-first PWA that photographs receipts, extracts transaction data using Claude AI, and imports it directly into [ZenMoney](https://zenmoney.ru).

No backend. No accounts. Your API keys stay on your device.

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

**Load categories**
After saving both keys, tap **Reload Categories**. This fetches your ZenMoney tags and saves them locally so the AI can pick the right one. If you have a single account it is selected automatically; if you have multiple, a picker appears — choose your default.

You only need to do this once. Tap **Reload Categories** again any time your ZenMoney tags change.

## Running locally (development)

```sh
pnpm install
pnpm dev
```

Open `http://localhost:5173` in your browser, or use your LAN IP (e.g. `http://192.168.x.x:5173`) to test on a phone.

## Building for production

```sh
pnpm build
```

The output is a static site in `build/`. Deploy it anywhere that can serve static files — Vercel, Netlify, GitHub Pages, or a home server.

Preview the production build locally:

```sh
pnpm preview
```

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

- [SvelteKit 2](https://kit.svelte.dev) + [Svelte 5](https://svelte.dev) — frontend framework, adapter-static SPA mode
- [Melt UI](https://melt-ui.com) — headless accessible component primitives
- [idb](https://github.com/jakearchibald/idb) — IndexedDB wrapper for local storage
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — AES-GCM encryption for stored API keys
- [@anthropic-ai/sdk](https://github.com/anthropic-ai/sdk-js) — Claude AI for receipt parsing
- [vite-plugin-pwa](https://vite-pwa-org.netlify.app) — service worker and PWA manifest
- [Vitest](https://vitest.dev) — unit testing
- [oxlint](https://oxc.rs/docs/guide/usage/linter) + [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) — linting and formatting
