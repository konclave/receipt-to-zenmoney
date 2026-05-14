# receipt-to-zenmoney Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a mobile-first PWA that photographs receipts, uses Claude AI to extract amount/merchant/category, and submits transactions to Zenmoney — with no backend; user stores their own API keys locally in the browser.

**Architecture:** Pure client-side SvelteKit app with `adapter-static` (SPA mode, static export). User provides their own Claude API key and Zenmoney token, stored AES-GCM encrypted in IndexedDB. All API calls go directly from the browser. Service worker provides offline shell.

**Tech Stack:** SvelteKit 2 + Svelte 5, TypeScript, Melt UI next-gen (`melt` package, headless WAI-ARIA primitives), Svelte scoped CSS + CSS custom properties, `vite-plugin-pwa`, `idb`, `@anthropic-ai/sdk`, Vitest + `fake-indexeddb`, `oxlint`, `oxfmt`, `pnpm`

---

## File Map

**Created by scaffolding:**
- `svelte.config.js` — replaced with adapter-static config
- `vite.config.ts` — extended with Vitest config and PWA plugin
- `tsconfig.json` — generated, unchanged
- `package.json` — generated, extended with scripts

**Created manually:**
- `src/app.css` — CSS custom properties + global reset
- `src/test/setup.ts` — fake-indexeddb auto-import for tests
- `.oxlintrc.json` — lint rules
- `src/lib/types/index.ts` — all shared TypeScript types
- `src/lib/db/index.ts` — idb `openDB` + schema + `_resetDb()` for test isolation
- `src/lib/db/settings.ts` — encrypted settings CRUD (`getSettings`, `saveSettings`)
- `src/lib/db/categories.ts` — categories cache CRUD (`getCategories`, `saveCategories`)
- `src/lib/db/transactions.ts` — transaction log CRUD (`getTransactions`, `saveTransaction`, `updateTransaction`)
- `src/lib/services/crypto.ts` — AES-GCM `encrypt` / `decrypt` with localStorage key
- `src/lib/services/zenmoney.ts` — `syncDiff`, `mapResponseToCategories`, `buildTransactionPayload`
- `src/lib/services/claude.ts` — `parseReceipt` via `@anthropic-ai/sdk`
- `src/lib/stores/capture.ts` — in-flight image store between Capture → Review screens
- `src/routes/+layout.ts` — `prerender = true`, `ssr = false`
- `src/routes/+layout.svelte` — bottom nav + first-launch redirect
- `src/routes/+page.svelte` — Capture screen (camera viewfinder + file picker)
- `src/routes/review/+page.svelte` — Review & edit parsed receipt, submit to Zenmoney
- `src/routes/history/+page.svelte` — Local transaction history list
- `src/routes/settings/+page.svelte` — API keys, token, category reload, account picker
- `src/lib/components/CategoryPicker.svelte` — Melt UI Select wrapper
- `src/lib/components/TransactionCard.svelte` — history list item
- `static/manifest.json` — PWA manifest
- `static/icons/icon-192.png` — 192×192 app icon
- `static/icons/icon-512.png` — 512×512 app icon

**Test files:**
- `src/lib/services/crypto.test.ts`
- `src/lib/db/settings.test.ts`
- `src/lib/db/categories.test.ts`
- `src/lib/db/transactions.test.ts`
- `src/lib/services/zenmoney.test.ts`
- `src/lib/services/claude.test.ts`

---

## Task 1: Project Scaffold

**Files:** `svelte.config.js`, `vite.config.ts`, `src/test/setup.ts`, `.oxlintrc.json`, `package.json`

- [ ] **Step 1: Initialize SvelteKit in the current directory**

```bash
pnpm create svelte@latest .
```

When prompted choose:
- Template: **Skeleton project**
- TypeScript: **Yes, using TypeScript syntax**
- Additional options: **Vitest** (space to select), nothing else

- [ ] **Step 2: Install all project dependencies**

```bash
pnpm add melt idb @anthropic-ai/sdk
pnpm add -D @sveltejs/adapter-static vite-plugin-pwa fake-indexeddb oxlint oxfmt
```

- [ ] **Step 3: Replace svelte.config.js**

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-static'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ fallback: 'index.html' })
  }
}
```

- [ ] **Step 4: Replace vite.config.ts**

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite'

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    globals: true
  }
})
```

- [ ] **Step 5: Create test setup file**

```typescript
// src/test/setup.ts
import 'fake-indexeddb/auto'
```

- [ ] **Step 6: Create oxlint config**

```json
{
  "rules": {
    "no-unused-vars": "warn",
    "no-console": "off"
  }
}
```
Save to `.oxlintrc.json`.

- [ ] **Step 7: Add lint/format scripts to package.json**

Open `package.json`, add to the `scripts` object:
```json
"lint": "oxlint src",
"format": "oxfmt src",
"format:check": "oxfmt --check src"
```

- [ ] **Step 8: Verify dev server starts**

```bash
pnpm dev
```

Expected: server at `http://localhost:5173`, no errors in terminal.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold SvelteKit project with adapter-static and Vitest"
```

---

## Task 2: TypeScript Types

**Files:** `src/lib/types/index.ts`

- [ ] **Step 1: Create types file**

```typescript
// src/lib/types/index.ts

export interface Category {
  id: string
  title: string
  parentId: string | null
  syncedAt: number
}

export interface Transaction {
  id: string
  zenmoneyId: string | null
  amount: number
  currency: string
  merchant: string
  categoryId: string
  date: string
  status: 'pending' | 'submitted' | 'failed'
  createdAt: number
}

export interface ParseResult {
  amount: number
  currency: string
  merchant: string
  categoryId: string
  date: string
  confidence: 'high' | 'medium' | 'low'
}

export interface Settings {
  claudeApiKey: string
  zenmoneyToken: string
  zenmoneyServerTimestamp: number
  zenmoneyAccountId: string
}

export interface ZenmoneyTag {
  id: string
  title: string
  parent: string | null
}

export interface ZenmoneyAccount {
  id: string
  title: string
}

export interface ZenmoneySyncResponse {
  serverTimestamp: number
  tag: ZenmoneyTag[]
  account: ZenmoneyAccount[]
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm check
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/index.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: Crypto Service (TDD)

**Files:** `src/lib/services/crypto.test.ts`, `src/lib/services/crypto.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/services/crypto.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { encrypt, decrypt } from './crypto'

beforeEach(() => {
  localStorage.clear()
})

describe('encrypt', () => {
  it('returns a base64 string different from input', async () => {
    const result = await encrypt('my-api-key')
    expect(result).not.toBe('my-api-key')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('produces different ciphertext on each call due to random IV', async () => {
    const a = await encrypt('same-input')
    const b = await encrypt('same-input')
    expect(a).not.toBe(b)
  })
})

describe('decrypt', () => {
  it('reverses encrypt', async () => {
    const original = 'sk-ant-api03-secret-key'
    const decrypted = await decrypt(await encrypt(original))
    expect(decrypted).toBe(original)
  })

  it('works with empty string', async () => {
    expect(await decrypt(await encrypt(''))).toBe('')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test --run src/lib/services/crypto.test.ts
```

Expected: FAIL — `Cannot find module './crypto'`

- [ ] **Step 3: Implement crypto.ts**

```typescript
// src/lib/services/crypto.ts
const STORAGE_KEY = 'rzm_key'

async function getOrCreateKey(): Promise<CryptoKey> {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    const keyData = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0))
    return crypto.subtle.importKey('raw', keyData, 'AES-GCM', false, ['encrypt', 'decrypt'])
  }
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
    'decrypt'
  ])
  const exported = await crypto.subtle.exportKey('raw', key)
  localStorage.setItem(STORAGE_KEY, btoa(String.fromCharCode(...new Uint8Array(exported))))
  return key
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getOrCreateKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return btoa(String.fromCharCode(...combined))
}

export async function decrypt(ciphertext: string): Promise<string> {
  const key = await getOrCreateKey()
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(plaintext)
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
pnpm test --run src/lib/services/crypto.test.ts
```

Expected: PASS — 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/crypto.ts src/lib/services/crypto.test.ts
git commit -m "feat: add AES-GCM crypto service"
```

---

## Task 4: Database Layer (TDD)

**Files:** `src/lib/db/index.ts`, `src/lib/db/settings.ts`, `src/lib/db/categories.ts`, `src/lib/db/transactions.ts` and their test files.

- [ ] **Step 1: Create db/index.ts**

```typescript
// src/lib/db/index.ts
import { openDB, type IDBPDatabase } from 'idb'
import type { Category, Transaction } from '$lib/types'

interface AppDB {
  settings: { key: string; value: string | number }
  categories: { key: string; value: Category }
  transactions: {
    key: string
    value: Transaction
    indexes: { 'by-date': string }
  }
}

let _db: IDBPDatabase<AppDB> | null = null

export async function getDb(): Promise<IDBPDatabase<AppDB>> {
  if (!_db) {
    _db = await openDB<AppDB>('rzm', 1, {
      upgrade(db) {
        db.createObjectStore('settings')
        db.createObjectStore('categories', { keyPath: 'id' })
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' })
        txStore.createIndex('by-date', 'date')
      }
    })
  }
  return _db
}

export function _resetDb(): void {
  _db = null
}
```

- [ ] **Step 2: Write failing settings tests**

```typescript
// src/lib/db/settings.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { getSettings, saveSettings } from './settings'
import { _resetDb } from './index'

beforeEach(async () => {
  localStorage.clear()
  _resetDb()
  await new Promise<void>((resolve) => {
    const req = globalThis.indexedDB.deleteDatabase('rzm')
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
  })
})

describe('getSettings', () => {
  it('returns empty defaults when nothing is saved', async () => {
    const s = await getSettings()
    expect(s.claudeApiKey).toBe('')
    expect(s.zenmoneyToken).toBe('')
    expect(s.zenmoneyServerTimestamp).toBe(0)
    expect(s.zenmoneyAccountId).toBe('')
  })
})

describe('saveSettings', () => {
  it('saves and decrypts claudeApiKey', async () => {
    await saveSettings({ claudeApiKey: 'sk-test-123' })
    expect((await getSettings()).claudeApiKey).toBe('sk-test-123')
  })

  it('saves and decrypts zenmoneyToken', async () => {
    await saveSettings({ zenmoneyToken: 'zm-token-abc' })
    expect((await getSettings()).zenmoneyToken).toBe('zm-token-abc')
  })

  it('saves zenmoneyServerTimestamp as number', async () => {
    await saveSettings({ zenmoneyServerTimestamp: 1746441600 })
    expect((await getSettings()).zenmoneyServerTimestamp).toBe(1746441600)
  })

  it('partial save does not overwrite unrelated fields', async () => {
    await saveSettings({ claudeApiKey: 'key-a', zenmoneyToken: 'token-b' })
    await saveSettings({ claudeApiKey: 'key-updated' })
    const s = await getSettings()
    expect(s.claudeApiKey).toBe('key-updated')
    expect(s.zenmoneyToken).toBe('token-b')
  })
})
```

- [ ] **Step 3: Run to confirm failure**

```bash
pnpm test --run src/lib/db/settings.test.ts
```

Expected: FAIL — `Cannot find module './settings'`

- [ ] **Step 4: Implement db/settings.ts**

```typescript
// src/lib/db/settings.ts
import { getDb } from './index'
import { encrypt, decrypt } from '$lib/services/crypto'
import type { Settings } from '$lib/types'

export async function getSettings(): Promise<Settings> {
  const db = await getDb()
  const [apiKeyRaw, tokenRaw, ts, accountId] = await Promise.all([
    db.get('settings', 'claudeApiKey'),
    db.get('settings', 'zenmoneyToken'),
    db.get('settings', 'zenmoneyServerTimestamp'),
    db.get('settings', 'zenmoneyAccountId')
  ])
  return {
    claudeApiKey: apiKeyRaw ? await decrypt(apiKeyRaw as string) : '',
    zenmoneyToken: tokenRaw ? await decrypt(tokenRaw as string) : '',
    zenmoneyServerTimestamp: (ts as number) ?? 0,
    zenmoneyAccountId: (accountId as string) ?? ''
  }
}

export async function saveSettings(partial: Partial<Settings>): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('settings', 'readwrite')
  const puts: Promise<unknown>[] = []
  if (partial.claudeApiKey !== undefined)
    puts.push(encrypt(partial.claudeApiKey).then((v) => tx.store.put(v, 'claudeApiKey')))
  if (partial.zenmoneyToken !== undefined)
    puts.push(encrypt(partial.zenmoneyToken).then((v) => tx.store.put(v, 'zenmoneyToken')))
  if (partial.zenmoneyServerTimestamp !== undefined)
    puts.push(tx.store.put(partial.zenmoneyServerTimestamp, 'zenmoneyServerTimestamp'))
  if (partial.zenmoneyAccountId !== undefined)
    puts.push(tx.store.put(partial.zenmoneyAccountId, 'zenmoneyAccountId'))
  await Promise.all(puts)
  await tx.done
}
```

- [ ] **Step 5: Run settings tests to confirm pass**

```bash
pnpm test --run src/lib/db/settings.test.ts
```

Expected: PASS — 5 tests pass.

- [ ] **Step 6: Write failing categories tests**

```typescript
// src/lib/db/categories.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { getCategories, saveCategories } from './categories'
import { _resetDb } from './index'
import type { Category } from '$lib/types'

const CATS: Category[] = [
  { id: 'c1', title: 'Groceries', parentId: null, syncedAt: 1000 },
  { id: 'c2', title: 'Transport', parentId: null, syncedAt: 1000 },
  { id: 'c3', title: 'Bus', parentId: 'c2', syncedAt: 1000 }
]

beforeEach(async () => {
  _resetDb()
  await new Promise<void>((resolve) => {
    const req = globalThis.indexedDB.deleteDatabase('rzm')
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
  })
})

it('returns empty array initially', async () => {
  expect(await getCategories()).toEqual([])
})

it('stores and retrieves categories', async () => {
  await saveCategories(CATS)
  const result = await getCategories()
  expect(result).toHaveLength(3)
  expect(result.map((c) => c.id)).toContain('c1')
})

it('replaces old categories on re-save', async () => {
  await saveCategories(CATS)
  await saveCategories([{ id: 'new', title: 'New', parentId: null, syncedAt: 2000 }])
  const result = await getCategories()
  expect(result).toHaveLength(1)
  expect(result[0].id).toBe('new')
})
```

- [ ] **Step 7: Run to confirm failure**

```bash
pnpm test --run src/lib/db/categories.test.ts
```

Expected: FAIL — `Cannot find module './categories'`

- [ ] **Step 8: Implement db/categories.ts**

```typescript
// src/lib/db/categories.ts
import { getDb } from './index'
import type { Category } from '$lib/types'

export async function getCategories(): Promise<Category[]> {
  const db = await getDb()
  return db.getAll('categories')
}

export async function saveCategories(categories: Category[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('categories', 'readwrite')
  await tx.store.clear()
  await Promise.all(categories.map((c) => tx.store.put(c)))
  await tx.done
}
```

- [ ] **Step 9: Write failing transactions tests**

```typescript
// src/lib/db/transactions.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { getTransactions, saveTransaction, updateTransaction } from './transactions'
import { _resetDb } from './index'
import type { Transaction } from '$lib/types'

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: crypto.randomUUID(),
    zenmoneyId: null,
    amount: 100,
    currency: 'RUB',
    merchant: 'Test Store',
    categoryId: 'c1',
    date: '2026-05-01',
    status: 'pending',
    createdAt: Date.now(),
    ...overrides
  }
}

beforeEach(async () => {
  _resetDb()
  await new Promise<void>((resolve) => {
    const req = globalThis.indexedDB.deleteDatabase('rzm')
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
  })
})

it('returns empty array initially', async () => {
  expect(await getTransactions()).toEqual([])
})

it('returns newest date first', async () => {
  await saveTransaction(makeTx({ date: '2026-01-01' }))
  await saveTransaction(makeTx({ date: '2026-05-05' }))
  const result = await getTransactions()
  expect(result[0].date).toBe('2026-05-05')
  expect(result[1].date).toBe('2026-01-01')
})

it('saves and retrieves a transaction', async () => {
  const tx = makeTx({ id: 'tx-1', amount: 500 })
  await saveTransaction(tx)
  const result = await getTransactions()
  expect(result).toHaveLength(1)
  expect(result[0].amount).toBe(500)
})

it('updateTransaction changes status and zenmoneyId', async () => {
  const tx = makeTx({ id: 'tx-u' })
  await saveTransaction(tx)
  await updateTransaction('tx-u', { status: 'submitted', zenmoneyId: 'zm-123' })
  const result = await getTransactions()
  expect(result[0].status).toBe('submitted')
  expect(result[0].zenmoneyId).toBe('zm-123')
})

it('updateTransaction throws for unknown id', async () => {
  await expect(updateTransaction('missing', { status: 'failed' })).rejects.toThrow()
})
```

- [ ] **Step 10: Run to confirm failure**

```bash
pnpm test --run src/lib/db/transactions.test.ts
```

Expected: FAIL — `Cannot find module './transactions'`

- [ ] **Step 11: Implement db/transactions.ts**

```typescript
// src/lib/db/transactions.ts
import { getDb } from './index'
import type { Transaction } from '$lib/types'

export async function getTransactions(): Promise<Transaction[]> {
  const db = await getDb()
  const all = await db.getAllFromIndex('transactions', 'by-date')
  return all.reverse()
}

export async function saveTransaction(transaction: Transaction): Promise<void> {
  const db = await getDb()
  await db.put('transactions', transaction)
}

export async function updateTransaction(
  id: string,
  updates: Partial<Transaction>
): Promise<void> {
  const db = await getDb()
  const existing = await db.get('transactions', id)
  if (!existing) throw new Error(`Transaction ${id} not found`)
  await db.put('transactions', { ...existing, ...updates })
}
```

- [ ] **Step 12: Run all DB tests**

```bash
pnpm test --run src/lib/db
```

Expected: PASS — all 13 tests across settings, categories, and transactions pass.

- [ ] **Step 13: Commit**

```bash
git add src/lib/db/
git commit -m "feat: add IndexedDB layer for settings, categories, and transactions"
```

---

## Task 5: Zenmoney Service (TDD)

**Files:** `src/lib/services/zenmoney.test.ts`, `src/lib/services/zenmoney.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/services/zenmoney.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncDiff, mapResponseToCategories, buildTransactionPayload } from './zenmoney'
import type { ZenmoneySyncResponse, Transaction } from '$lib/types'

const MOCK_RESPONSE: ZenmoneySyncResponse = {
  serverTimestamp: 1746441600,
  tag: [
    { id: 'tag-1', title: 'Groceries', parent: null },
    { id: 'tag-2', title: 'Transport', parent: null },
    { id: 'tag-3', title: 'Bus', parent: 'tag-2' }
  ],
  account: [{ id: 'acc-1', title: 'Cash' }]
}

beforeEach(() => vi.restoreAllMocks())

describe('syncDiff', () => {
  it('POSTs to /v8/diff with Bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_RESPONSE)
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncDiff('my-token', 0)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.zenmoney.ru/v8/diff')
    expect(options.method).toBe('POST')
    expect(options.headers['Authorization']).toBe('Bearer my-token')
  })

  it('includes serverTimestamp in request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_RESPONSE)
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncDiff('token', 12345)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.serverTimestamp).toBe(12345)
  })

  it('throws on non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' })
    )
    await expect(syncDiff('bad', 0)).rejects.toThrow('401')
  })

  it('returns the parsed JSON response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_RESPONSE)
    }))
    const result = await syncDiff('token', 0)
    expect(result.serverTimestamp).toBe(1746441600)
    expect(result.tag).toHaveLength(3)
  })
})

describe('mapResponseToCategories', () => {
  it('maps ZM tags to Category objects', () => {
    const result = mapResponseToCategories(MOCK_RESPONSE)
    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({ id: 'tag-1', title: 'Groceries', parentId: null })
    expect(result[2]).toMatchObject({ id: 'tag-3', parentId: 'tag-2' })
  })

  it('sets syncedAt to approximately now', () => {
    const before = Date.now()
    const result = mapResponseToCategories(MOCK_RESPONSE)
    expect(result[0].syncedAt).toBeGreaterThanOrEqual(before)
    expect(result[0].syncedAt).toBeLessThanOrEqual(Date.now())
  })
})

describe('buildTransactionPayload', () => {
  it('builds correct Zenmoney transaction object', () => {
    const tx: Transaction = {
      id: 'local-uuid',
      zenmoneyId: null,
      amount: 1250,
      currency: 'RUB',
      merchant: 'Magnit',
      categoryId: 'tag-1',
      date: '2026-05-05',
      status: 'pending',
      createdAt: 1000
    }
    const payload = buildTransactionPayload(tx, 'acc-1')
    expect(payload).toMatchObject({
      id: 'local-uuid',
      date: '2026-05-05',
      income: 0,
      outcome: 1250,
      outcomeAccount: 'acc-1',
      tag: ['tag-1'],
      comment: 'Magnit',
      deleted: false
    })
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test --run src/lib/services/zenmoney.test.ts
```

Expected: FAIL — `Cannot find module './zenmoney'`

- [ ] **Step 3: Implement zenmoney.ts**

```typescript
// src/lib/services/zenmoney.ts
import type { Category, Transaction, ZenmoneySyncResponse } from '$lib/types'

const BASE_URL = 'https://api.zenmoney.ru'

export async function syncDiff(
  token: string,
  serverTimestamp: number,
  transactions: object[] = []
): Promise<ZenmoneySyncResponse> {
  const response = await fetch(`${BASE_URL}/v8/diff`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      currentClientTimestamp: Math.floor(Date.now() / 1000),
      serverTimestamp,
      transaction: transactions
    })
  })
  if (!response.ok) {
    throw new Error(`Zenmoney API error: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

export function mapResponseToCategories(response: ZenmoneySyncResponse): Category[] {
  const now = Date.now()
  return response.tag.map((tag) => ({
    id: tag.id,
    title: tag.title,
    parentId: tag.parent,
    syncedAt: now
  }))
}

export function buildTransactionPayload(tx: Transaction, accountId: string): object {
  return {
    id: tx.id,
    date: tx.date,
    income: 0,
    incomeAccount: accountId,
    outcome: tx.amount,
    outcomeAccount: accountId,
    tag: tx.categoryId ? [tx.categoryId] : [],
    comment: tx.merchant,
    deleted: false
  }
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
pnpm test --run src/lib/services/zenmoney.test.ts
```

Expected: PASS — 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/zenmoney.ts src/lib/services/zenmoney.test.ts
git commit -m "feat: add Zenmoney sync API service"
```

---

## Task 6: Claude Service (TDD)

**Files:** `src/lib/services/claude.test.ts`, `src/lib/services/claude.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/services/claude.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Category } from '$lib/types'

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn()
}))

import Anthropic from '@anthropic-ai/sdk'
import { parseReceipt } from './claude'

const CATEGORIES: Category[] = [
  { id: 'c1', title: 'Groceries', parentId: null, syncedAt: 1000 },
  { id: 'c2', title: 'Transport', parentId: null, syncedAt: 1000 }
]

const PARSE_RESULT = {
  amount: 1250,
  currency: 'RUB',
  merchant: 'Magnit',
  categoryId: 'c1',
  date: '2026-05-05',
  confidence: 'high'
}

function mockAnthropic(responseText: string) {
  const createMock = vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: responseText }]
  })
  vi.mocked(Anthropic).mockImplementation(
    () => ({ messages: { create: createMock } }) as unknown as InstanceType<typeof Anthropic>
  )
  return createMock
}

beforeEach(() => vi.mocked(Anthropic).mockClear())

describe('parseReceipt', () => {
  it('calls claude-sonnet-4-6 with image and category list', async () => {
    const createMock = mockAnthropic(JSON.stringify(PARSE_RESULT))
    await parseReceipt('base64img', CATEGORIES, 'sk-test')

    const call = createMock.mock.calls[0][0]
    expect(call.model).toBe('claude-sonnet-4-6')
    expect(call.messages[0].content[0].type).toBe('image')
    expect(call.messages[0].content[0].source.data).toBe('base64img')
    expect(call.messages[0].content[1].text).toContain('c1: Groceries')
    expect(call.messages[0].content[1].text).toContain('c2: Transport')
  })

  it('returns parsed JSON from Claude response', async () => {
    mockAnthropic(JSON.stringify(PARSE_RESULT))
    const result = await parseReceipt('img', CATEGORIES, 'sk-test')
    expect(result.amount).toBe(1250)
    expect(result.merchant).toBe('Magnit')
    expect(result.confidence).toBe('high')
  })

  it('throws when Claude returns invalid JSON', async () => {
    mockAnthropic('not json at all')
    await expect(parseReceipt('img', CATEGORIES, 'key')).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
pnpm test --run src/lib/services/claude.test.ts
```

Expected: FAIL — `Cannot find module './claude'`

- [ ] **Step 3: Implement claude.ts**

```typescript
// src/lib/services/claude.ts
import Anthropic from '@anthropic-ai/sdk'
import type { Category, ParseResult } from '$lib/types'

export async function parseReceipt(
  imageBase64: string,
  categories: Category[],
  apiKey: string
): Promise<ParseResult> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  const categoryList = categories.map((c) => `${c.id}: ${c.title}`).join('\n')
  const today = new Date().toISOString().slice(0, 10)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 }
          },
          {
            type: 'text',
            text: `Extract from this receipt:
- total amount paid (number only, no currency symbol)
- currency code (ISO 4217, e.g. RUB)
- merchant/store name
- best matching category ID from this list:
${categoryList}
- transaction date (ISO 8601, use today ${today} if not visible)

Respond ONLY with valid JSON, no markdown:
{"amount":number,"currency":"string","merchant":"string","categoryId":"string","date":"string","confidence":"high"|"medium"|"low"}`
          }
        ]
      }
    ]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return JSON.parse(text) as ParseResult
}
```

- [ ] **Step 4: Run to confirm pass**

```bash
pnpm test --run src/lib/services/claude.test.ts
```

Expected: PASS — 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/claude.ts src/lib/services/claude.test.ts
git commit -m "feat: add Claude receipt parsing service"
```

---

## Task 7: Capture Store & Global Styles

**Files:** `src/lib/stores/capture.ts`, `src/app.css`

- [ ] **Step 1: Create the capture store**

```typescript
// src/lib/stores/capture.ts
import { writable } from 'svelte/store'

export interface CaptureData {
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
}

export const captureStore = writable<CaptureData | null>(null)
```

- [ ] **Step 2: Write global CSS**

```css
/* src/app.css */
:root {
  --color-bg: #0f1117;
  --color-surface: #1a1d27;
  --color-surface-2: #252836;
  --color-border: #2e3248;
  --color-text: #e8eaf0;
  --color-text-muted: #8b8fa8;
  --color-primary: #6c63ff;
  --color-success: #4caf88;
  --color-warning: #f59e0b;
  --color-error: #ef4444;
  --nav-height: 64px;
  --radius-sm: 8px;
  --radius-md: 12px;
  --font: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  height: 100%;
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font);
  font-size: 16px;
  -webkit-font-smoothing: antialiased;
}

button { cursor: pointer; border: none; background: none; font: inherit; color: inherit; }

input, select, textarea {
  font: inherit;
  color: inherit;
  background: var(--color-surface-2);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  padding: 12px;
  width: 100%;
}

input:focus, select:focus {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/stores/capture.ts src/app.css
git commit -m "feat: add capture store and global CSS design tokens"
```

---

## Task 8: App Layout & Navigation

**Files:** `src/routes/+layout.ts`, `src/routes/+layout.svelte`

- [ ] **Step 1: Create layout.ts (disable SSR, enable prerender)**

```typescript
// src/routes/+layout.ts
export const prerender = true
export const ssr = false
```

- [ ] **Step 2: Create root layout with bottom nav and first-launch redirect**

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { page } from '$app/stores'
  import { getSettings } from '$lib/db/settings'
  import '../app.css'

  let { children } = $props()

  const navItems = [
    { href: '/', label: 'Capture', icon: '📷' },
    { href: '/history', label: 'History', icon: '📋' },
    { href: '/settings', label: 'Settings', icon: '⚙️' }
  ]

  onMount(async () => {
    const settings = await getSettings()
    if ((!settings.claudeApiKey || !settings.zenmoneyToken) && $page.url.pathname !== '/settings') {
      goto('/settings')
    }
  })
</script>

<div class="app">
  <main class="content">
    {@render children()}
  </main>
  <nav class="bottom-nav">
    {#each navItems as item}
      <a
        href={item.href}
        class="nav-item"
        class:active={$page.url.pathname === item.href}
        aria-label={item.label}
      >
        <span class="icon">{item.icon}</span>
        <span class="label">{item.label}</span>
      </a>
    {/each}
  </nav>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    max-width: 480px;
    margin: 0 auto;
  }
  .content {
    flex: 1;
    overflow-y: auto;
  }
  .bottom-nav {
    position: fixed;
    bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    max-width: 480px;
    height: var(--nav-height);
    display: flex;
    background: var(--color-surface);
    border-top: 1px solid var(--color-border);
    z-index: 100;
  }
  .nav-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    text-decoration: none;
    color: var(--color-text-muted);
    font-size: 11px;
    transition: color 0.15s;
  }
  .nav-item.active { color: var(--color-primary); }
  .icon { font-size: 22px; line-height: 1; }
</style>
```

- [ ] **Step 3: Verify layout in browser**

```bash
pnpm dev
```

Open http://localhost:5173. Expected: dark background, 3-tab bottom nav, redirects to /settings when no keys are saved.

- [ ] **Step 4: Commit**

```bash
git add src/routes/+layout.ts src/routes/+layout.svelte
git commit -m "feat: add app layout with bottom nav and first-launch redirect"
```

---

## Task 9: Settings Screen

**Files:** `src/routes/settings/+page.svelte`

- [ ] **Step 1: Create the settings page**

```svelte
<!-- src/routes/settings/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'
  import { getSettings, saveSettings } from '$lib/db/settings'
  import { getCategories, saveCategories } from '$lib/db/categories'
  import { syncDiff, mapResponseToCategories } from '$lib/services/zenmoney'
  import type { ZenmoneyAccount } from '$lib/types'

  let claudeApiKey = $state('')
  let zenmoneyToken = $state('')
  let categoryCount = $state(0)
  let lastSyncDate = $state<string | null>(null)
  let accounts = $state<ZenmoneyAccount[]>([])
  let selectedAccountId = $state('')
  let saving = $state(false)
  let syncing = $state(false)
  let error = $state<string | null>(null)
  let success = $state<string | null>(null)

  onMount(async () => {
    const s = await getSettings()
    claudeApiKey = s.claudeApiKey
    zenmoneyToken = s.zenmoneyToken
    selectedAccountId = s.zenmoneyAccountId
    const cats = await getCategories()
    categoryCount = cats.length
    if (cats.length > 0) lastSyncDate = new Date(cats[0].syncedAt).toLocaleDateString()
  })

  async function handleSave() {
    saving = true
    error = null
    try {
      await saveSettings({ claudeApiKey, zenmoneyToken })
      if (selectedAccountId) await saveSettings({ zenmoneyAccountId: selectedAccountId })
      success = 'Saved'
      setTimeout(() => (success = null), 2000)
    } catch (e) {
      error = String(e)
    } finally {
      saving = false
    }
  }

  async function handleReloadCategories() {
    syncing = true
    error = null
    try {
      const s = await getSettings()
      if (!s.zenmoneyToken) throw new Error('Zenmoney token is required')
      const response = await syncDiff(s.zenmoneyToken, 0)
      const cats = mapResponseToCategories(response)
      await saveCategories(cats)
      await saveSettings({ zenmoneyServerTimestamp: response.serverTimestamp })
      categoryCount = cats.length
      lastSyncDate = new Date().toLocaleDateString()
      accounts = response.account
      if (response.account.length === 1) {
        selectedAccountId = response.account[0].id
        await saveSettings({ zenmoneyAccountId: response.account[0].id })
      }
    } catch (e) {
      error = String(e)
    } finally {
      syncing = false
    }
  }
</script>

<div class="page">
  <h1>Settings</h1>

  {#if error}<div class="alert error">{error}</div>{/if}
  {#if success}<div class="alert success">{success}</div>{/if}

  <section>
    <label for="claude-key">Claude API Key</label>
    <input id="claude-key" type="password" bind:value={claudeApiKey}
      placeholder="sk-ant-api03-…" autocomplete="off" />
    <p class="hint">Get yours at console.anthropic.com</p>
  </section>

  <section>
    <label for="zm-token">Zenmoney Token</label>
    <input id="zm-token" type="password" bind:value={zenmoneyToken}
      placeholder="Paste your Zenmoney token" autocomplete="off" />
    <p class="hint">Get yours at app.zenmoney.ru/consumer</p>
  </section>

  <button class="btn-primary" onclick={handleSave} disabled={saving}>
    {saving ? 'Saving…' : 'Save Settings'}
  </button>

  <hr />

  <section>
    <h2>Categories</h2>
    <p class="hint">
      {categoryCount} categories cached
      {lastSyncDate ? `· Last synced ${lastSyncDate}` : '· Not synced yet'}
    </p>
    <button class="btn-secondary" onclick={handleReloadCategories} disabled={syncing}>
      {syncing ? 'Loading…' : 'Reload Categories'}
    </button>
  </section>

  {#if accounts.length > 1}
    <section>
      <label for="account">Default Account</label>
      <select id="account" bind:value={selectedAccountId}>
        {#each accounts as acc}
          <option value={acc.id}>{acc.title}</option>
        {/each}
      </select>
      <button class="btn-primary" onclick={handleSave}>Save Account</button>
    </section>
  {/if}
</div>

<style>
  .page { padding: 20px 16px; display: flex; flex-direction: column; gap: 20px; padding-bottom: calc(var(--nav-height) + 20px); }
  h1 { font-size: 24px; font-weight: 700; }
  h2 { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
  section { display: flex; flex-direction: column; gap: 8px; }
  label { font-size: 13px; font-weight: 500; color: var(--color-text-muted); }
  .hint { font-size: 12px; color: var(--color-text-muted); }
  hr { border: none; border-top: 1px solid var(--color-border); }
  .btn-primary { background: var(--color-primary); color: white; border-radius: var(--radius-sm); padding: 14px; font-weight: 600; font-size: 15px; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-secondary { background: var(--color-surface-2); border: 1px solid var(--color-border); border-radius: var(--radius-sm); padding: 12px; font-weight: 500; }
  .alert { padding: 12px; border-radius: var(--radius-sm); font-size: 13px; }
  .alert.error { background: color-mix(in srgb, var(--color-error) 15%, transparent); border: 1px solid var(--color-error); color: var(--color-error); }
  .alert.success { background: color-mix(in srgb, var(--color-success) 15%, transparent); border: 1px solid var(--color-success); color: var(--color-success); }
</style>
```

- [ ] **Step 2: Verify settings screen**

```bash
pnpm dev
```

Open http://localhost:5173/settings. Expected: two masked key inputs, Save button, Reload Categories button, category count, no console errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/settings/
git commit -m "feat: add settings screen with key management and category sync"
```

---

## Task 10: Capture Screen

**Files:** `src/routes/+page.svelte`

- [ ] **Step 1: Implement the capture screen**

```svelte
<!-- src/routes/+page.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import { captureStore } from '$lib/stores/capture'

  let videoEl = $state<HTMLVideoElement | null>(null)
  let canvasEl = $state<HTMLCanvasElement | null>(null)
  let stream = $state<MediaStream | null>(null)
  let cameraError = $state<string | null>(null)
  let useFileInput = $state(false)

  onMount(async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false
      })
      if (videoEl) videoEl.srcObject = stream
    } catch {
      cameraError = 'Camera not available — use the file picker below.'
      useFileInput = true
    }
  })

  onDestroy(() => stream?.getTracks().forEach((t) => t.stop()))

  function captureFromVideo() {
    if (!videoEl || !canvasEl) return
    canvasEl.width = videoEl.videoWidth
    canvasEl.height = videoEl.videoHeight
    canvasEl.getContext('2d')!.drawImage(videoEl, 0, 0)
    const imageBase64 = canvasEl.toDataURL('image/jpeg', 0.9).split(',')[1]
    captureStore.set({ imageBase64, mimeType: 'image/jpeg' })
    stream?.getTracks().forEach((t) => t.stop())
    goto('/review')
  }

  function handleFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      captureStore.set({
        imageBase64: dataUrl.split(',')[1],
        mimeType: file.type as 'image/jpeg' | 'image/png' | 'image/webp'
      })
      goto('/review')
    }
    reader.readAsDataURL(file)
  }
</script>

<div class="capture-page">
  {#if !useFileInput}
    <div class="viewfinder">
      <video bind:this={videoEl} autoplay playsinline muted class="video"></video>
    </div>
  {/if}

  {#if cameraError}
    <p class="camera-error">{cameraError}</p>
  {/if}

  {#if !useFileInput}
    <div class="controls">
      <button class="capture-btn" onclick={captureFromVideo} aria-label="Take photo">
        <span class="shutter"></span>
      </button>
    </div>
  {/if}

  <div class="file-area" class:prominent={useFileInput}>
    <label for="receipt-file" class="file-label">
      {useFileInput ? '📁 Choose a receipt photo' : 'or upload from gallery'}
    </label>
    <input id="receipt-file" type="file" accept="image/*"
      capture="environment" onchange={handleFileChange} class="file-input" />
  </div>

  <canvas bind:this={canvasEl} style="display:none"></canvas>
</div>

<style>
  .capture-page { display: flex; flex-direction: column; height: calc(100dvh - var(--nav-height)); background: #000; }
  .viewfinder { flex: 1; overflow: hidden; }
  .video { width: 100%; height: 100%; object-fit: cover; }
  .controls { display: flex; justify-content: center; padding: 24px; background: rgba(0,0,0,0.6); }
  .capture-btn { width: 72px; height: 72px; border-radius: 50%; border: 4px solid white; background: transparent; display: flex; align-items: center; justify-content: center; }
  .shutter { width: 56px; height: 56px; border-radius: 50%; background: white; display: block; transition: transform 0.1s; }
  .capture-btn:active .shutter { transform: scale(0.9); }
  .file-area { padding: 12px 16px; text-align: center; background: rgba(0,0,0,0.6); }
  .file-area.prominent { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--color-bg); gap: 16px; }
  .file-label { display: block; color: rgba(255,255,255,0.7); font-size: 13px; cursor: pointer; }
  .prominent .file-label { color: var(--color-primary); font-size: 18px; font-weight: 500; }
  .file-input { display: none; }
  .camera-error { color: rgba(255,255,255,0.7); font-size: 13px; padding: 8px 16px; text-align: center; background: rgba(0,0,0,0.6); }
</style>
```

- [ ] **Step 2: Test in browser**

```bash
pnpm dev
```

Open http://localhost:5173. Expected: camera viewfinder fills screen, circular shutter button, "or upload from gallery" text. Tap/click the shutter — should navigate to /review (may show parsing spinner).

- [ ] **Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: add capture screen with camera and file picker"
```

---

## Task 11: CategoryPicker Component

**Files:** `src/lib/components/CategoryPicker.svelte`

The Melt UI Select builder API (from melt/builders):
- `new Select({ value: () => value, onValueChange: (v) => { value = v ?? '' } })`
- `{...select.trigger}` — spread on the trigger button
- `{...select.content}` — spread on the dropdown container (visibility managed via `data-state` attr)
- `select.getOption(optionValue, optionLabel)` — spread on each option element
- `select.isSelected(optionValue)` — boolean for checked state
- `select.valueAsString` — current value as string

- [ ] **Step 1: Create CategoryPicker.svelte**

```svelte
<!-- src/lib/components/CategoryPicker.svelte -->
<script lang="ts">
  import { Select } from 'melt/builders'
  import type { Category } from '$lib/types'

  let {
    categories,
    value = $bindable(''),
    placeholder = 'Select category'
  }: {
    categories: Category[]
    value?: string
    placeholder?: string
  } = $props()

  const select = new Select({
    value: () => value,
    onValueChange: (v: string | null) => {
      value = v ?? ''
    }
  })

  const label = $derived(categories.find((c) => c.id === value)?.title ?? placeholder)
</script>

<div class="picker">
  <button class="trigger" {...select.trigger}>
    {label}
    <span class="chevron" aria-hidden="true">▾</span>
  </button>

  <div class="menu" {...select.content}>
    {#if categories.length === 0}
      <div class="option disabled">No categories — reload in Settings</div>
    {/if}
    {#each categories as cat}
      <div class="option" class:selected={select.isSelected(cat.id)} {...select.getOption(cat.id, cat.title)}>
        {cat.title}
        {#if select.isSelected(cat.id)}<span class="check">✓</span>{/if}
      </div>
    {/each}
  </div>
</div>

<style>
  .picker { position: relative; }

  .trigger {
    width: 100%;
    background: var(--color-surface-2);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    padding: 12px;
    text-align: left;
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 15px;
  }

  .trigger:focus { outline: 2px solid var(--color-primary); outline-offset: 2px; }
  .chevron { color: var(--color-text-muted); font-size: 12px; }

  .menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    max-height: 260px;
    overflow-y: auto;
    z-index: 50;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  }

  .menu[data-state='closed'] { display: none; }

  .option {
    padding: 12px 16px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--color-border);
  }

  .option:last-child { border-bottom: none; }
  .option:hover { background: var(--color-surface-2); }
  .option.selected { color: var(--color-primary); }
  .option.disabled { color: var(--color-text-muted); cursor: default; font-style: italic; }
  .check { color: var(--color-primary); font-size: 13px; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/CategoryPicker.svelte
git commit -m "feat: add CategoryPicker component using Melt UI Select"
```

---

## Task 12: Review Screen

**Files:** `src/routes/review/+page.svelte`

- [ ] **Step 1: Create the review page**

```svelte
<!-- src/routes/review/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'
  import { goto } from '$app/navigation'
  import { captureStore } from '$lib/stores/capture'
  import { parseReceipt } from '$lib/services/claude'
  import { syncDiff, buildTransactionPayload } from '$lib/services/zenmoney'
  import { getSettings } from '$lib/db/settings'
  import { getCategories } from '$lib/db/categories'
  import { saveTransaction, updateTransaction } from '$lib/db/transactions'
  import CategoryPicker from '$lib/components/CategoryPicker.svelte'
  import type { Category } from '$lib/types'

  let capture = $captureStore
  let categories = $state<Category[]>([])
  let parsing = $state(true)
  let submitting = $state(false)
  let parseError = $state<string | null>(null)
  let submitError = $state<string | null>(null)
  let lowConfidence = $state(false)

  let amount = $state('')
  let merchant = $state('')
  let categoryId = $state('')
  let date = $state(new Date().toISOString().slice(0, 10))
  let currency = $state('RUB')

  onMount(async () => {
    if (!capture) { goto('/'); return }
    categories = await getCategories()
    try {
      const settings = await getSettings()
      if (!settings.claudeApiKey) throw new Error('Claude API key not set in Settings')
      const result = await parseReceipt(capture.imageBase64, categories, settings.claudeApiKey)
      amount = String(result.amount)
      merchant = result.merchant
      categoryId = result.categoryId
      date = result.date
      currency = result.currency
      lowConfidence = result.confidence === 'low'
    } catch (e) {
      parseError = `Parsing failed: ${e}. Fill in the fields manually.`
    } finally {
      parsing = false
    }
  })

  async function handleSubmit() {
    submitting = true
    submitError = null
    const txId = crypto.randomUUID()
    const tx = {
      id: txId,
      zenmoneyId: null,
      amount: parseFloat(amount) || 0,
      currency,
      merchant,
      categoryId,
      date,
      status: 'pending' as const,
      createdAt: Date.now()
    }
    await saveTransaction(tx)
    try {
      const settings = await getSettings()
      if (!settings.zenmoneyToken) throw new Error('Zenmoney token not set')
      if (!settings.zenmoneyAccountId)
        throw new Error('No default account set — go to Settings → Reload Categories')
      const payload = buildTransactionPayload(tx, settings.zenmoneyAccountId)
      await syncDiff(settings.zenmoneyToken, settings.zenmoneyServerTimestamp, [payload])
      await updateTransaction(txId, { status: 'submitted', zenmoneyId: txId })
    } catch (e) {
      await updateTransaction(txId, { status: 'failed' })
      submitError = String(e)
      submitting = false
      return
    }
    captureStore.set(null)
    goto('/history')
  }
</script>

<div class="page">
  <div class="header">
    <button class="back" onclick={() => goto('/')}>← Back</button>
    <h1>Review</h1>
  </div>

  {#if capture}
    <img
      src={`data:${capture.mimeType};base64,${capture.imageBase64}`}
      alt="Receipt"
      class="thumbnail"
    />
  {/if}

  {#if parsing}
    <div class="parsing">
      <div class="spinner"></div>
      <p>Parsing receipt…</p>
    </div>
  {:else}
    {#if parseError}<div class="alert warning">{parseError}</div>{/if}
    {#if lowConfidence}<div class="alert warning">Low confidence — please double-check values.</div>{/if}
    {#if submitError}<div class="alert error">{submitError}</div>{/if}

    <form class="form" onsubmit={(e) => { e.preventDefault(); handleSubmit() }}>
      <div class="field">
        <label for="amount">Amount ({currency})</label>
        <input id="amount" type="number" step="0.01" bind:value={amount} required />
      </div>
      <div class="field">
        <label for="merchant">Merchant</label>
        <input id="merchant" type="text" bind:value={merchant} required />
      </div>
      <div class="field">
        <label>Category</label>
        <CategoryPicker {categories} bind:value={categoryId} />
      </div>
      <div class="field">
        <label for="date">Date</label>
        <input id="date" type="date" bind:value={date} required />
      </div>
      <button type="submit" class="btn-primary" disabled={submitting}>
        {submitting ? 'Submitting…' : 'Submit to Zenmoney'}
      </button>
    </form>
  {/if}
</div>

<style>
  .page { padding: 16px; display: flex; flex-direction: column; gap: 16px; padding-bottom: calc(var(--nav-height) + 16px); }
  .header { display: flex; align-items: center; gap: 12px; }
  .back { color: var(--color-primary); font-size: 15px; }
  h1 { font-size: 20px; font-weight: 700; }
  .thumbnail { width: 100%; max-height: 160px; object-fit: cover; border-radius: var(--radius-md); border: 1px solid var(--color-border); }
  .parsing { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 48px 0; color: var(--color-text-muted); }
  .spinner { width: 36px; height: 36px; border: 3px solid var(--color-border); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .form { display: flex; flex-direction: column; gap: 16px; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  label { font-size: 13px; font-weight: 500; color: var(--color-text-muted); }
  .btn-primary { background: var(--color-primary); color: white; border-radius: var(--radius-sm); padding: 16px; font-weight: 600; font-size: 16px; margin-top: 8px; }
  .btn-primary:disabled { opacity: 0.5; }
  .alert { padding: 12px; border-radius: var(--radius-sm); font-size: 13px; }
  .alert.warning { background: color-mix(in srgb, var(--color-warning) 15%, transparent); border: 1px solid var(--color-warning); color: var(--color-warning); }
  .alert.error { background: color-mix(in srgb, var(--color-error) 15%, transparent); border: 1px solid var(--color-error); color: var(--color-error); }
</style>
```

- [ ] **Step 2: End-to-end test of the capture → review flow**

```bash
pnpm dev
```

1. Go to /settings, enter valid Claude API key + Zenmoney token, click "Reload Categories"
2. Go to / (Capture), take a photo or upload a receipt image
3. Verify Review screen shows: thumbnail, parsing spinner, then pre-filled form
4. Check the category picker opens and shows categories
5. Click "Submit to Zenmoney" — should navigate to /history

- [ ] **Step 3: Commit**

```bash
git add src/routes/review/
git commit -m "feat: add review screen with Claude parsing and Zenmoney submission"
```

---

## Task 13: TransactionCard & History Screen

**Files:** `src/lib/components/TransactionCard.svelte`, `src/routes/history/+page.svelte`

- [ ] **Step 1: Create TransactionCard.svelte**

```svelte
<!-- src/lib/components/TransactionCard.svelte -->
<script lang="ts">
  import type { Transaction, Category } from '$lib/types'

  let { transaction, categories }: { transaction: Transaction; categories: Category[] } = $props()

  const category = $derived(categories.find((c) => c.id === transaction.categoryId))
  const formattedAmount = $derived(
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: transaction.currency }).format(
      transaction.amount
    )
  )
  const formattedDate = $derived(
    new Date(transaction.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  )
</script>

<div class="card">
  <div class="row">
    <div class="left">
      <span class="merchant">{transaction.merchant || 'Unknown'}</span>
      <span class="meta">{category?.title ?? 'Uncategorized'} · {formattedDate}</span>
    </div>
    <div class="right">
      <span class="amount">−{formattedAmount}</span>
      <span class="badge badge-{transaction.status}">{transaction.status}</span>
    </div>
  </div>
</div>

<style>
  .card { padding: 14px 16px; border-bottom: 1px solid var(--color-border); }
  .row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
  .left { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
  .merchant { font-size: 15px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .meta { font-size: 12px; color: var(--color-text-muted); }
  .right { display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; }
  .amount { font-size: 15px; font-weight: 600; }
  .badge { font-size: 11px; padding: 2px 8px; border-radius: 99px; font-weight: 500; }
  .badge-submitted { background: color-mix(in srgb, var(--color-success) 20%, transparent); color: var(--color-success); }
  .badge-pending { background: color-mix(in srgb, var(--color-warning) 20%, transparent); color: var(--color-warning); }
  .badge-failed { background: color-mix(in srgb, var(--color-error) 20%, transparent); color: var(--color-error); }
</style>
```

- [ ] **Step 2: Create history screen**

```svelte
<!-- src/routes/history/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'
  import { getTransactions } from '$lib/db/transactions'
  import { getCategories } from '$lib/db/categories'
  import TransactionCard from '$lib/components/TransactionCard.svelte'
  import type { Transaction, Category } from '$lib/types'

  let transactions = $state<Transaction[]>([])
  let categories = $state<Category[]>([])
  let loading = $state(true)

  onMount(async () => {
    ;[transactions, categories] = await Promise.all([getTransactions(), getCategories()])
    loading = false
  })
</script>

<div class="page">
  <h1>History</h1>
  {#if loading}
    <div class="empty">Loading…</div>
  {:else if transactions.length === 0}
    <div class="empty">
      <p>No transactions yet.</p>
      <p>Capture a receipt to get started.</p>
    </div>
  {:else}
    <div class="list">
      {#each transactions as tx (tx.id)}
        <TransactionCard transaction={tx} {categories} />
      {/each}
    </div>
  {/if}
</div>

<style>
  .page { padding-top: 20px; padding-bottom: var(--nav-height); }
  h1 { font-size: 24px; font-weight: 700; padding: 0 16px 16px; }
  .list { border-top: 1px solid var(--color-border); }
  .empty { padding: 48px 16px; text-align: center; color: var(--color-text-muted); display: flex; flex-direction: column; gap: 8px; }
</style>
```

- [ ] **Step 3: Verify history screen**

```bash
pnpm dev
```

Navigate to /history. Expected: empty state when no transactions, or list of TransactionCards with merchant, amount, category, date, and status badge.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/TransactionCard.svelte src/routes/history/
git commit -m "feat: add history screen with transaction list"
```

---

## Task 14: PWA Configuration

**Files:** `vite.config.ts`, `static/manifest.json`, `static/icons/icon-192.png`, `static/icons/icon-512.png`

- [ ] **Step 1: Create placeholder icons**

```bash
mkdir -p static/icons
python3 -c "
import struct, zlib

def make_png(size, r, g, b):
    def chunk(t, d):
        import zlib as _z
        c = _z.crc32(t + d) & 0xffffffff
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', c)
    raw = b''.join(bytes([0, r, g, b]) * size for _ in range(size))
    data = b'\x89PNG\r\n\x1a\n'
    data += chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0))
    data += chunk(b'IDAT', zlib.compress(raw))
    data += chunk(b'IEND', b'')
    return data

with open('static/icons/icon-192.png', 'wb') as f:
    f.write(make_png(192, 108, 99, 255))
with open('static/icons/icon-512.png', 'wb') as f:
    f.write(make_png(512, 108, 99, 255))
print('Icons created')
"
```

Expected output: `Icons created` and two PNG files in `static/icons/`.

- [ ] **Step 2: Create static/manifest.json**

```json
{
  "name": "Receipt to Zenmoney",
  "short_name": "ReceiptZM",
  "description": "Photograph receipts and import transactions into Zenmoney",
  "theme_color": "#6c63ff",
  "background_color": "#0f1117",
  "display": "standalone",
  "orientation": "portrait",
  "start_url": "/",
  "scope": "/",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ]
}
```

- [ ] **Step 3: Add VitePWA plugin to vite.config.ts**

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import { sveltekit } from '@sveltejs/kit/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    sveltekit(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Receipt to Zenmoney',
        short_name: 'ReceiptZM',
        description: 'Photograph receipts and import transactions into Zenmoney',
        theme_color: '#6c63ff',
        background_color: '#0f1117',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,webp,woff2}'],
        navigateFallback: '/index.html'
      }
    })
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    globals: true
  }
})
```

- [ ] **Step 4: Build and verify PWA**

```bash
pnpm build && pnpm preview
```

Open http://localhost:4173. Check:
- DevTools → Application → Service Workers: registered service worker present
- DevTools → Application → Manifest: shows app name, icons, standalone display
- Browser address bar or menu should offer "Install app" / "Add to Home Screen"

- [ ] **Step 5: Test CORS for Zenmoney API**

In the running preview app, go to Settings, enter your Zenmoney token, click "Reload Categories". Check DevTools → Network.

- If **200 OK**: Zenmoney CORS works — categories load. Done.
- If **CORS error**: document in a new GitHub issue. Workaround: deploy a Cloudflare Worker as a thin proxy (out of scope for this plan; create a separate task).

- [ ] **Step 6: Run the full test suite**

```bash
pnpm test --run
```

Expected: all tests pass.

- [ ] **Step 7: Final commit**

```bash
git add vite.config.ts static/
git commit -m "feat: add PWA configuration with service worker and app manifest"
```

---

## Verification Checklist

After all tasks complete, run through this end-to-end flow:

1. **Setup:** `pnpm dev` → open on mobile browser via LAN IP (e.g. http://192.168.x.x:5173)
2. **First launch:** redirects to Settings → enter Claude API key + Zenmoney token → Save → Reload Categories → `N categories cached`
3. **Capture:** tap Capture tab → camera opens → take receipt photo
4. **Parse:** Review screen shows thumbnail → spinner → form pre-filled with amount, merchant, category
5. **Submit:** confirm values → Submit to Zenmoney → navigates to History, entry appears with `submitted` badge
6. **Verify in Zenmoney:** open Zenmoney app → transaction appears
7. **Offline:** disable network → History still shows locally; Capture still works → re-enable → pending transaction retries on next submit
8. **PWA install:** `pnpm build && pnpm preview` → browser offers install → installs → opens without browser chrome
