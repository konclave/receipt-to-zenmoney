# receipt-to-zenmoney — Design Spec

## Context

Building a mobile-first PWA from scratch that lets the user photograph a receipt, parse it with Claude AI to extract transaction amount, merchant name, and category, then submit the transaction to Zenmoney. It is a personal tool (single user), so there is no backend — the user stores their own API keys locally in the browser. Zenmoney is the source of truth for transaction data; the app keeps a local cache for offline access.

---

## Architecture

**Pure client-side PWA.** No server. No hosted infrastructure.

- User enters their Claude API key and Zenmoney token once in Settings
- Keys are encrypted in IndexedDB via Web Crypto AES-GCM
- All API calls (Claude + Zenmoney) are made directly from the browser
- Zenmoney CORS support is an unknown — test early; if blocked, add a minimal Cloudflare Worker proxy as a fallback
- SvelteKit with `adapter-static` produces a static build deployable to any host (Vercel, Netlify, home server, GitHub Pages)

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | SvelteKit 2 + Svelte 5 (adapter-static) |
| Language | TypeScript |
| UI primitives | Melt UI next-gen (headless, WAI-ARIA accessible) |
| Styling | Svelte scoped CSS + CSS custom properties (no Tailwind) |
| PWA | vite-plugin-pwa (Workbox) |
| Storage | IndexedDB via `idb` |
| AI | `@anthropic-ai/sdk` (browser mode), model: `claude-sonnet-4-6` |
| Linting | oxlint (latest) |
| Formatting | oxfmt (latest) |
| Package manager | pnpm |

---

## Screens & Flow

```
[First launch] → Settings (no keys) → enter Claude key + Zenmoney token → Load categories
[Normal use]   → Capture → (Claude parse ~2-3s) → Review & Edit → Submit → History
[Settings]     → manually reload categories at any time
```

### 1. Capture screen (`/`)
- Opens device camera via `MediaDevices.getUserMedia`
- Full-screen viewfinder with a capture button
- Also allows selecting a photo from the gallery (`<input type="file" accept="image/*" capture="environment">` as fallback)
- On capture: converts frame to base64, writes to a Svelte module store (`$captureStore`), navigates to `/review`

### 2. Review screen (`/review`)
- Shows a thumbnail of the captured receipt
- Displays Claude-parsed fields (editable):
  - **Amount** — number input
  - **Merchant** — text input
  - **Category** — dropdown (Melt UI Select) populated from IndexedDB categories
  - **Date** — date input (defaults to today)
- Low-confidence parse shows a warning badge
- If parse fails entirely, fields are blank — user fills manually
- "Submit to Zenmoney" button → saves to local history, POSTs to Zenmoney sync API
- On success: navigates to History screen
- On failure: inline error, transaction stays in `pending` status

### 3. History screen (`/history`)
- List of locally cached submitted transactions (newest first)
- Each entry: merchant, amount, category, date, status badge (submitted / failed)
- Pull-to-refresh syncs with Zenmoney (updates `zenmoneyId` on pending items)

### 4. Settings screen (`/settings`)
- Claude API key input (masked, stored encrypted)
- Zenmoney token input (masked, stored encrypted)
- "Reload categories" button — triggers Zenmoney diff sync, updates IndexedDB
- Shows count of cached categories and last sync timestamp
- On first launch with no keys, app redirects here automatically

---

## Data Model (IndexedDB via `idb`)

### `settings` store
```ts
{
  claudeApiKey: string             // AES-GCM encrypted
  zenmoneyToken: string            // AES-GCM encrypted
  zenmoneyServerTimestamp: number  // last known sync timestamp
  zenmoneyAccountId: string        // selected Zenmoney account for transactions
}
```

### `categories` store
```ts
{
  id: string             // Zenmoney tag ID
  title: string
  parentId: string | null
  syncedAt: number       // unix timestamp
}
```

### `transactions` store
```ts
{
  id: string             // local UUID (crypto.randomUUID())
  zenmoneyId: string | null  // set after successful Zenmoney submission
  amount: number
  currency: string       // ISO 4217
  merchant: string
  categoryId: string
  date: string           // ISO 8601
  status: 'pending' | 'submitted' | 'failed'
  createdAt: number
}
```

**Key encryption:** Encryption key derived from `crypto.randomUUID()` stored in `localStorage` (device-local). Keys are AES-GCM encrypted before writing to IndexedDB. This is not high-security but adequate for a personal tool — the raw key is never stored in plain text.

---

## Receipt Parsing (Claude API)

```ts
// src/lib/services/claude.ts
import Anthropic from '@anthropic-ai/sdk'

export async function parseReceipt(
  imageBase64: string,
  categories: Category[],
  apiKey: string
): Promise<ParseResult> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })

  const categoryList = categories
    .map(c => `${c.id}: ${c.title}`)
    .join('\n')

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
        { type: 'text', text: `Extract from this receipt:
- total amount paid (number only, no currency symbol)
- currency code (ISO 4217, e.g. RUB)
- merchant/store name
- best matching category ID from this list:
${categoryList}
- transaction date (ISO 8601, use today ${new Date().toISOString().slice(0,10)} if not visible)

Respond ONLY with valid JSON, no markdown:
{"amount":number,"currency":"string","merchant":"string","categoryId":"string","date":"string","confidence":"high"|"medium"|"low"}` }
      ]
    }]
  })

  return JSON.parse(response.content[0].text)
}
```

---

## Zenmoney Integration

**Auth:** Bearer token (user pastes from https://app.zenmoney.ru/consumer/).
**Endpoint:** `POST https://api.zenmoney.ru/v8/diff`

### Fetch categories (on Settings → "Reload categories")
```ts
POST /v8/diff
Body: { currentClientTimestamp: Date.now(), serverTimestamp: 0 }
Headers: { Authorization: `Bearer ${token}` }
→ response.tag[]  →  write to IndexedDB categories store
→ save response.serverTimestamp to settings store
```

### Submit transaction
```ts
POST /v8/diff
Body: {
  currentClientTimestamp: Date.now(),
  serverTimestamp: <saved from last sync>,
  transaction: [{
    id: <uuid>,
    date: <ISO date>,
    income: 0,
    outcome: amount,
    outcomeAccount: <user's default account id>,  // TBD: fetch from diff on first sync
    tag: [categoryId],
    merchant: merchant,
    comment: ''
  }]
}
→ on success: update local transaction status to 'submitted', save zenmoneyId
→ save new serverTimestamp
```

**Account selection:** On first "Reload categories", the sync response includes `account[]`. If there is only one account, save its ID to `settings.zenmoneyAccountId` automatically. If there are multiple, show a picker in Settings ("Default account") and save the user's choice. The account picker is part of the Settings screen — only shown after a successful sync.

---

## Project Structure

```
receipt-to-zenmoney/
├── src/
│   ├── app.html                        # HTML shell
│   ├── app.css                         # CSS custom properties / global reset
│   ├── routes/
│   │   ├── +layout.svelte              # Root layout: bottom nav bar
│   │   ├── +page.svelte                # Capture screen (/)
│   │   ├── review/
│   │   │   └── +page.svelte            # Review & edit parsed result
│   │   ├── history/
│   │   │   └── +page.svelte            # Local transaction log
│   │   └── settings/
│   │       └── +page.svelte            # Keys, token, category reload
│   └── lib/
│       ├── stores/
│       │   └── capture.ts              # $captureStore — in-flight image base64 between Capture → Review
│       ├── components/
│       │   ├── CategoryPicker.svelte   # Melt UI Select wrapper
│       │   └── TransactionCard.svelte  # History list item
│       ├── services/
│       │   ├── claude.ts               # parseReceipt()
│       │   ├── zenmoney.ts             # fetchCategories(), submitTransaction()
│       │   └── crypto.ts               # encrypt(), decrypt() via Web Crypto
│       ├── db/
│       │   ├── index.ts                # idb openDB() setup
│       │   ├── settings.ts             # getSettings(), saveSettings()
│       │   ├── categories.ts           # getCategories(), saveCategories()
│       │   └── transactions.ts         # getTransactions(), saveTransaction(), updateTransaction()
│       └── types/
│           └── index.ts                # Category, Transaction, ParseResult, Settings
├── static/
│   ├── manifest.json                   # PWA manifest (name, icons, display: standalone)
│   └── icons/                          # 192x192, 512x512 PNG icons
├── svelte.config.js                    # adapter-static
├── vite.config.ts                      # vite-plugin-pwa config
├── tsconfig.json
├── .oxlintrc.json
└── package.json
```

---

## Verification Plan

1. **Setup check** — `pnpm dev` starts dev server; app loads on mobile browser (via LAN IP)
2. **Settings** — enter Claude API key + Zenmoney token → save → "Reload categories" → categories count > 0
3. **Capture** — tap camera button → viewfinder opens → photo taken → navigates to Review
4. **Parsing** — Review screen shows parsed amount, merchant, and a matching category; low-confidence items flagged
5. **Submit** — confirm Review → transaction appears in Zenmoney app + in local History with status "submitted"
6. **Offline** — disable network → app shell loads from service worker → History readable → Capture available → Submit queues as "pending" → re-enable network → transaction submits
7. **Category reload** — Settings → "Reload categories" → cache updates with latest Zenmoney tags
8. **PWA install** — browser prompts "Add to Home Screen" → installs → opens in standalone mode (no browser chrome)
9. **CORS test** — verify Zenmoney API calls succeed from browser; if blocked, document Cloudflare Worker fallback
