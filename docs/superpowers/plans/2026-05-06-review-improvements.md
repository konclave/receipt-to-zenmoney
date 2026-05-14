# Review Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix five issues found in the post-implementation review: tooling warnings, image compression before sending to Claude, Claude output validation, capture persistence across PWA restarts, and retry support for failed transactions — plus add a key-presence indicator to the Settings screen.

**Architecture:** All changes are self-contained to existing files except the new `pending-capture` DB store, which requires a schema migration (IDB version 1 → 2). No new dependencies. The retry flow reuses the existing `syncDiff` / `buildTransactionPayload` path already used by the review screen.

**Tech Stack:** SvelteKit 2 + Svelte 5, `idb`, Web Crypto API, Vitest, `oxlint`. Test runner: `pnpm test:unit -- --run`.

---

## File Map

**Modified:**
- `package.json` — add `@types/node` devDependency
- `src/lib/types/index.ts` — add `PendingCapture` type
- `src/lib/stores/capture.ts` — alias `CaptureData` to `PendingCapture`
- `src/lib/db/index.ts` — add `pending-capture` store, bump DB version 1 → 2
- `src/lib/db/transactions.test.ts` — remove unused `describe` import
- `src/lib/db/categories.test.ts` — remove unused `describe` import
- `src/lib/services/claude.ts` — add output validation after `JSON.parse`
- `src/lib/services/claude.test.ts` — add validation test cases
- `src/routes/+page.svelte` — add `compressToJpeg` helper, apply to both capture paths, persist to IDB
- `src/routes/review/+page.svelte` — load persisted capture from IDB on mount, clear on submit and back
- `src/routes/history/+page.svelte` — add `retryTransaction` handler, pass to card
- `src/lib/components/TransactionCard.svelte` — add retry button for failed status
- `src/routes/settings/+page.svelte` — add key-presence dot indicator

**Created:**
- `src/lib/db/pending-capture.ts` — `savePendingCapture`, `getPendingCapture`, `clearPendingCapture`
- `src/lib/db/pending-capture.test.ts` — TDD tests for the above

---

## Task 1: Tooling Cleanup

**Files:**
- Modify: `src/lib/db/categories.test.ts`
- Modify: `src/lib/db/transactions.test.ts`
- Modify: `package.json`

- [ ] **Step 1: Remove unused `describe` import from categories test**

In `src/lib/db/categories.test.ts`, change line 1 from:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
```
to:
```typescript
import { it, expect, beforeEach } from 'vitest'
```

- [ ] **Step 2: Remove unused `describe` import from transactions test**

In `src/lib/db/transactions.test.ts`, change line 1 from:
```typescript
import { describe, it, expect, beforeEach } from 'vitest'
```
to:
```typescript
import { it, expect, beforeEach } from 'vitest'
```

- [ ] **Step 3: Install `@types/node` to silence the tsconfig warning**

```bash
pnpm add -D @types/node
```

- [ ] **Step 4: Verify no warnings**

```bash
pnpm check
```

Expected: `0 ERRORS 0 WARNINGS` (the `@types/node` warning is gone).

- [ ] **Step 5: Verify lint passes**

```bash
pnpm lint
```

Expected: 0 errors, 0 warnings.

- [ ] **Step 6: Run tests**

```bash
pnpm test:unit -- --run
```

Expected: 27 tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/lib/db/categories.test.ts src/lib/db/transactions.test.ts package.json pnpm-lock.yaml
git commit -m "chore: remove unused describe imports and fix node types warning"
```

---

## Task 2: Image Compression on Capture

Receipt photos from a phone camera can exceed 8 MB. This task resizes them to a max 1280 px long edge and re-encodes as JPEG at 0.85 quality before storing, which reduces them to ~200–400 KB with no visible quality loss for OCR. After compression the MIME type is always `image/jpeg`, which also closes the MIME type mismatch with the Claude API.

**Files:**
- Modify: `src/routes/+page.svelte`

No unit test — the Canvas API is not available in jsdom. Manual verification in the browser is the acceptance test.

- [ ] **Step 1: Replace `src/routes/+page.svelte` with the compressed version**

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

  async function compressToJpeg(base64: string, mimeType: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const MAX = 1280
        let { width, height } = img
        if (width > MAX || height > MAX) {
          if (width > height) {
            height = Math.round((height * MAX) / width)
            width = MAX
          } else {
            width = Math.round((width * MAX) / height)
            height = MAX
          }
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.85).split(',')[1])
      }
      img.onerror = reject
      img.src = `data:${mimeType};base64,${base64}`
    })
  }

  async function captureFromVideo() {
    if (!videoEl || !canvasEl) return
    canvasEl.width = videoEl.videoWidth
    canvasEl.height = videoEl.videoHeight
    canvasEl.getContext('2d')!.drawImage(videoEl, 0, 0)
    const rawBase64 = canvasEl.toDataURL('image/jpeg', 1).split(',')[1]
    stream?.getTracks().forEach((t) => t.stop())
    const imageBase64 = await compressToJpeg(rawBase64, 'image/jpeg')
    captureStore.set({ imageBase64, mimeType: 'image/jpeg' })
    goto('/review')
  }

  async function handleFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      const imageBase64 = await compressToJpeg(dataUrl.split(',')[1], file.type)
      captureStore.set({ imageBase64, mimeType: 'image/jpeg' })
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
      onchange={handleFileChange} class="file-input" />
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

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm check
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: compress receipt images to JPEG before capture (max 1280px, q=0.85)"
```

---

## Task 3: Claude Output Validation (TDD)

**Files:**
- Modify: `src/lib/services/claude.test.ts`
- Modify: `src/lib/services/claude.ts`

- [ ] **Step 1: Add failing validation tests to `src/lib/services/claude.test.ts`**

Append these test cases inside the existing `describe('parseReceipt', ...)` block, after the existing three tests:

```typescript
  it('throws when amount is not a positive number', async () => {
    mockAnthropic(JSON.stringify({ ...PARSE_RESULT, amount: -5 }))
    await expect(parseReceipt('img', CATEGORIES, 'key')).rejects.toThrow('amount')
  })

  it('throws when amount is zero', async () => {
    mockAnthropic(JSON.stringify({ ...PARSE_RESULT, amount: 0 }))
    await expect(parseReceipt('img', CATEGORIES, 'key')).rejects.toThrow('amount')
  })

  it('throws when date is not YYYY-MM-DD format', async () => {
    mockAnthropic(JSON.stringify({ ...PARSE_RESULT, date: '05/05/2026' }))
    await expect(parseReceipt('img', CATEGORIES, 'key')).rejects.toThrow('date')
  })

  it('throws when merchant is empty string', async () => {
    mockAnthropic(JSON.stringify({ ...PARSE_RESULT, merchant: '' }))
    await expect(parseReceipt('img', CATEGORIES, 'key')).rejects.toThrow('merchant')
  })

  it('throws when confidence is not high/medium/low', async () => {
    mockAnthropic(JSON.stringify({ ...PARSE_RESULT, confidence: 'very-high' }))
    await expect(parseReceipt('img', CATEGORIES, 'key')).rejects.toThrow('confidence')
  })

  it('throws when currency is empty string', async () => {
    mockAnthropic(JSON.stringify({ ...PARSE_RESULT, currency: '' }))
    await expect(parseReceipt('img', CATEGORIES, 'key')).rejects.toThrow('currency')
  })
```

- [ ] **Step 2: Run to confirm the new tests fail**

```bash
pnpm test:unit -- --run src/lib/services/claude.test.ts
```

Expected: 3 pass, 6 fail (the new ones).

- [ ] **Step 3: Add `validateParseResult` to `src/lib/services/claude.ts`**

Replace the entire file with:

```typescript
// src/lib/services/claude.ts
import Anthropic from '@anthropic-ai/sdk'
import type { Category, ParseResult } from '$lib/types'

function validateParseResult(raw: unknown): ParseResult {
  const r = raw as Record<string, unknown>
  if (typeof r.amount !== 'number' || !isFinite(r.amount) || r.amount <= 0)
    throw new Error(`Invalid parse result: amount must be a positive number, got ${r.amount}`)
  if (typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date))
    throw new Error(`Invalid parse result: date must be YYYY-MM-DD, got ${r.date}`)
  if (typeof r.merchant !== 'string' || r.merchant.trim() === '')
    throw new Error('Invalid parse result: merchant must be a non-empty string')
  if (!['high', 'medium', 'low'].includes(r.confidence as string))
    throw new Error(`Invalid parse result: confidence must be high/medium/low, got ${r.confidence}`)
  if (typeof r.currency !== 'string' || r.currency.trim() === '')
    throw new Error('Invalid parse result: currency must be a non-empty string')
  return raw as ParseResult
}

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
  return validateParseResult(JSON.parse(text))
}
```

- [ ] **Step 4: Run to confirm all 9 tests pass**

```bash
pnpm test:unit -- --run src/lib/services/claude.test.ts
```

Expected: 9 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/claude.ts src/lib/services/claude.test.ts
git commit -m "feat: validate Claude parse result fields before use"
```

---

## Task 4: Persist Pending Capture in IndexedDB

The in-memory `captureStore` is lost on page refresh or when the PWA is killed in the background. This task persists the compressed image to IndexedDB before navigating to `/review`, and reads it back on mount if the store is empty.

**Files:**
- Modify: `src/lib/types/index.ts`
- Modify: `src/lib/stores/capture.ts`
- Modify: `src/lib/db/index.ts`
- Create: `src/lib/db/pending-capture.ts`
- Create: `src/lib/db/pending-capture.test.ts`
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/review/+page.svelte`

- [ ] **Step 1: Add `PendingCapture` to the shared types**

In `src/lib/types/index.ts`, add before the `Category` interface:

```typescript
export interface PendingCapture {
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
}
```

- [ ] **Step 2: Update `captureStore` to reuse the shared type**

Replace `src/lib/stores/capture.ts` with:

```typescript
// src/lib/stores/capture.ts
import { writable } from 'svelte/store'
import type { PendingCapture } from '$lib/types'

export type CaptureData = PendingCapture

export const captureStore = writable<CaptureData | null>(null)
```

- [ ] **Step 3: Add `pending-capture` store to the database schema**

Replace `src/lib/db/index.ts` with:

```typescript
// src/lib/db/index.ts
import { openDB, type IDBPDatabase } from 'idb'
import type { Category, Transaction, PendingCapture } from '$lib/types'

interface AppDB {
  settings: { key: string; value: string | number }
  categories: { key: string; value: Category }
  transactions: {
    key: string
    value: Transaction
    indexes: { 'by-date': string }
  }
  'pending-capture': { key: string; value: PendingCapture }
}

let _db: IDBPDatabase<AppDB> | null = null

export async function getDb(): Promise<IDBPDatabase<AppDB>> {
  if (!_db) {
    _db = await openDB<AppDB>('rzm', 2, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('settings')
          db.createObjectStore('categories', { keyPath: 'id' })
          const txStore = db.createObjectStore('transactions', { keyPath: 'id' })
          txStore.createIndex('by-date', 'date')
        }
        if (oldVersion < 2) {
          db.createObjectStore('pending-capture')
        }
      }
    })
  }
  return _db
}

export function _resetDb(): void {
  _db?.close()
  _db = null
}
```

- [ ] **Step 4: Write failing tests for `pending-capture.ts`**

Create `src/lib/db/pending-capture.test.ts`:

```typescript
// src/lib/db/pending-capture.test.ts
import { it, expect, beforeEach } from 'vitest'
import { savePendingCapture, getPendingCapture, clearPendingCapture } from './pending-capture'
import { _resetDb } from './index'
import type { PendingCapture } from '$lib/types'

const CAPTURE: PendingCapture = {
  imageBase64: 'abc123',
  mimeType: 'image/jpeg'
}

beforeEach(async () => {
  _resetDb()
  await new Promise<void>((resolve) => {
    const req = globalThis.indexedDB.deleteDatabase('rzm')
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
  })
})

it('returns undefined when nothing is saved', async () => {
  expect(await getPendingCapture()).toBeUndefined()
})

it('saves and retrieves pending capture', async () => {
  await savePendingCapture(CAPTURE)
  const result = await getPendingCapture()
  expect(result).toEqual(CAPTURE)
})

it('overwrites previous capture on re-save', async () => {
  await savePendingCapture(CAPTURE)
  const updated: PendingCapture = { imageBase64: 'xyz789', mimeType: 'image/jpeg' }
  await savePendingCapture(updated)
  expect(await getPendingCapture()).toEqual(updated)
})

it('clearPendingCapture removes the stored capture', async () => {
  await savePendingCapture(CAPTURE)
  await clearPendingCapture()
  expect(await getPendingCapture()).toBeUndefined()
})
```

- [ ] **Step 5: Run to confirm tests fail**

```bash
pnpm test:unit -- --run src/lib/db/pending-capture.test.ts
```

Expected: FAIL — `Cannot find module './pending-capture'`

- [ ] **Step 6: Create `src/lib/db/pending-capture.ts`**

```typescript
// src/lib/db/pending-capture.ts
import { getDb } from './index'
import type { PendingCapture } from '$lib/types'

const KEY = 'current'

export async function savePendingCapture(data: PendingCapture): Promise<void> {
  const db = await getDb()
  await db.put('pending-capture', data, KEY)
}

export async function getPendingCapture(): Promise<PendingCapture | undefined> {
  const db = await getDb()
  return db.get('pending-capture', KEY)
}

export async function clearPendingCapture(): Promise<void> {
  const db = await getDb()
  await db.delete('pending-capture', KEY)
}
```

- [ ] **Step 7: Run to confirm pending-capture tests pass**

```bash
pnpm test:unit -- --run src/lib/db/pending-capture.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 8: Run the full DB test suite**

```bash
pnpm test:unit -- --run src/lib/db
```

Expected: all tests pass (the existing 17 + 4 new = 21).

- [ ] **Step 9: Update `+page.svelte` to persist before navigating**

In `src/routes/+page.svelte`, add the import at the top of the `<script>` block:

```typescript
  import { savePendingCapture } from '$lib/db/pending-capture'
```

Then in `captureFromVideo`, replace:
```typescript
    captureStore.set({ imageBase64, mimeType: 'image/jpeg' })
    goto('/review')
```
with:
```typescript
    const capture = { imageBase64, mimeType: 'image/jpeg' as const }
    await savePendingCapture(capture)
    captureStore.set(capture)
    goto('/review')
```

And in `handleFileChange`, replace inside the `reader.onload` async function:
```typescript
      captureStore.set({ imageBase64, mimeType: 'image/jpeg' })
      goto('/review')
```
with:
```typescript
      const capture = { imageBase64, mimeType: 'image/jpeg' as const }
      await savePendingCapture(capture)
      captureStore.set(capture)
      goto('/review')
```

- [ ] **Step 10: Update `review/+page.svelte` to load and clear the persisted capture**

Replace the entire `src/routes/review/+page.svelte` with:

```svelte
<!-- src/routes/review/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'
  import { get } from 'svelte/store'
  import { goto } from '$app/navigation'
  import { captureStore } from '$lib/stores/capture'
  import { parseReceipt } from '$lib/services/claude'
  import { syncDiff, buildTransactionPayload } from '$lib/services/zenmoney'
  import { getSettings, saveSettings } from '$lib/db/settings'
  import { getCategories } from '$lib/db/categories'
  import { saveTransaction, updateTransaction } from '$lib/db/transactions'
  import { getPendingCapture, clearPendingCapture } from '$lib/db/pending-capture'
  import CategoryPicker from '$lib/components/CategoryPicker.svelte'
  import type { Category, PendingCapture } from '$lib/types'

  let capture = $state<PendingCapture | null>(get(captureStore))
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
    if (!capture) {
      const persisted = await getPendingCapture()
      if (persisted) {
        capture = persisted
        captureStore.set(persisted)
      }
    }
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

  async function handleBack() {
    await clearPendingCapture()
    captureStore.set(null)
    goto('/')
  }

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
      const diffResponse = await syncDiff(settings.zenmoneyToken, settings.zenmoneyServerTimestamp, [payload])
      await saveSettings({ zenmoneyServerTimestamp: diffResponse.serverTimestamp })
      await updateTransaction(txId, { status: 'submitted', zenmoneyId: txId })
    } catch (e) {
      await updateTransaction(txId, { status: 'failed' })
      submitError = String(e)
      submitting = false
      return
    }
    await clearPendingCapture()
    captureStore.set(null)
    goto('/history')
  }
</script>

<div class="page">
  <div class="header">
    <button class="back" onclick={handleBack}>← Back</button>
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
        <span class="label">Category</span>
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
  label, .label { font-size: 13px; font-weight: 500; color: var(--color-text-muted); }
  .btn-primary { background: var(--color-primary); color: white; border-radius: var(--radius-sm); padding: 16px; font-weight: 600; font-size: 16px; margin-top: 8px; }
  .btn-primary:disabled { opacity: 0.5; }
  .alert { padding: 12px; border-radius: var(--radius-sm); font-size: 13px; }
  .alert.warning { background: color-mix(in srgb, var(--color-warning) 15%, transparent); border: 1px solid var(--color-warning); color: var(--color-warning); }
  .alert.error { background: color-mix(in srgb, var(--color-error) 15%, transparent); border: 1px solid var(--color-error); color: var(--color-error); }
</style>
```

- [ ] **Step 11: Verify TypeScript compiles**

```bash
pnpm check
```

Expected: 0 errors.

- [ ] **Step 12: Run full test suite**

```bash
pnpm test:unit -- --run
```

Expected: all tests pass.

- [ ] **Step 13: Commit**

```bash
git add src/lib/types/index.ts src/lib/stores/capture.ts src/lib/db/index.ts \
        src/lib/db/pending-capture.ts src/lib/db/pending-capture.test.ts \
        src/routes/+page.svelte src/routes/review/+page.svelte
git commit -m "feat: persist pending capture in IndexedDB to survive PWA refresh"
```

---

## Task 5: Retry Failed Transactions

Failed transactions are permanently stranded in the history list with no way to recover. This task adds a Retry button to each failed card, wired to the same submit path used by the review screen.

**Files:**
- Modify: `src/lib/components/TransactionCard.svelte`
- Modify: `src/routes/history/+page.svelte`

- [ ] **Step 1: Replace `src/lib/components/TransactionCard.svelte`**

```svelte
<!-- src/lib/components/TransactionCard.svelte -->
<script lang="ts">
  import type { Transaction, Category } from '$lib/types'

  let {
    transaction,
    categories,
    onRetry
  }: {
    transaction: Transaction
    categories: Category[]
    onRetry?: (tx: Transaction) => Promise<void>
  } = $props()

  const category = $derived(categories.find((c) => c.id === transaction.categoryId))
  const formattedAmount = $derived(
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: transaction.currency }).format(
      transaction.amount
    )
  )
  const formattedDate = $derived(
    new Date(transaction.date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  )

  let retrying = $state(false)
  let retryError = $state<string | null>(null)

  async function handleRetry() {
    if (!onRetry) return
    retrying = true
    retryError = null
    try {
      await onRetry(transaction)
    } catch (e) {
      retryError = String(e)
    } finally {
      retrying = false
    }
  }
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
  {#if transaction.status === 'failed' && onRetry}
    <div class="retry-row">
      {#if retryError}<span class="retry-error">{retryError}</span>{/if}
      <button class="btn-retry" onclick={handleRetry} disabled={retrying}>
        {retrying ? 'Retrying…' : 'Retry'}
      </button>
    </div>
  {/if}
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
  .retry-row { display: flex; justify-content: flex-end; align-items: center; gap: 8px; margin-top: 8px; }
  .retry-error { font-size: 11px; color: var(--color-error); flex: 1; }
  .btn-retry { font-size: 12px; font-weight: 600; color: var(--color-primary); padding: 4px 12px; border: 1px solid var(--color-primary); border-radius: var(--radius-sm); }
  .btn-retry:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
```

- [ ] **Step 2: Replace `src/routes/history/+page.svelte`**

```svelte
<!-- src/routes/history/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte'
  import { getTransactions, updateTransaction } from '$lib/db/transactions'
  import { getCategories } from '$lib/db/categories'
  import { getSettings, saveSettings } from '$lib/db/settings'
  import { syncDiff, buildTransactionPayload } from '$lib/services/zenmoney'
  import TransactionCard from '$lib/components/TransactionCard.svelte'
  import type { Transaction, Category } from '$lib/types'

  let transactions = $state<Transaction[]>([])
  let categories = $state<Category[]>([])
  let loading = $state(true)

  onMount(async () => {
    ;[transactions, categories] = await Promise.all([getTransactions(), getCategories()])
    loading = false
  })

  async function retryTransaction(tx: Transaction): Promise<void> {
    const settings = await getSettings()
    if (!settings.zenmoneyToken) throw new Error('Zenmoney token not set')
    if (!settings.zenmoneyAccountId)
      throw new Error('No default account set — go to Settings → Reload Categories')

    await updateTransaction(tx.id, { status: 'pending' })
    transactions = await getTransactions()

    try {
      const payload = buildTransactionPayload(tx, settings.zenmoneyAccountId)
      const diffResponse = await syncDiff(
        settings.zenmoneyToken,
        settings.zenmoneyServerTimestamp,
        [payload]
      )
      await saveSettings({ zenmoneyServerTimestamp: diffResponse.serverTimestamp })
      await updateTransaction(tx.id, { status: 'submitted', zenmoneyId: tx.id })
    } catch (e) {
      await updateTransaction(tx.id, { status: 'failed' })
      throw e
    } finally {
      transactions = await getTransactions()
    }
  }
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
        <TransactionCard transaction={tx} {categories} onRetry={retryTransaction} />
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

- [ ] **Step 3: Verify TypeScript compiles**

```bash
pnpm check
```

Expected: 0 errors.

- [ ] **Step 4: Run full test suite**

```bash
pnpm test:unit -- --run
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/TransactionCard.svelte src/routes/history/+page.svelte
git commit -m "feat: add retry button for failed transactions in history"
```

---

## Task 6: Settings Key-Presence Indicator

The Settings form shows masked password fields. After keys are saved, opening settings again shows empty-looking inputs (the browser masks the placeholder). This adds a small coloured dot next to each label — green when the key is stored, grey when it is not — without exposing the actual value.

**Files:**
- Modify: `src/routes/settings/+page.svelte`

- [ ] **Step 1: Add dot indicators to the key label sections**

In `src/routes/settings/+page.svelte`, replace the two `<section>` blocks for the key inputs with:

```svelte
  <section>
    <label for="claude-key">
      Claude API Key
      <span class="key-dot" class:set={claudeApiKey.length > 0} aria-label={claudeApiKey.length > 0 ? 'saved' : 'not saved'}>●</span>
    </label>
    <input id="claude-key" type="password" bind:value={claudeApiKey}
      placeholder="sk-ant-api03-…" autocomplete="off" />
    <p class="hint">Get yours at console.anthropic.com</p>
  </section>

  <section>
    <label for="zm-token">
      Zenmoney Token
      <span class="key-dot" class:set={zenmoneyToken.length > 0} aria-label={zenmoneyToken.length > 0 ? 'saved' : 'not saved'}>●</span>
    </label>
    <input id="zm-token" type="password" bind:value={zenmoneyToken}
      placeholder="Paste your Zenmoney token" autocomplete="off" />
    <p class="hint">Get yours at app.zenmoney.ru/consumer</p>
  </section>
```

And add to the `<style>` block (before the closing `</style>`):

```css
  .key-dot { font-size: 10px; margin-left: 6px; vertical-align: middle; color: var(--color-text-muted); }
  .key-dot.set { color: var(--color-success); }
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
pnpm check
```

Expected: 0 errors.

- [ ] **Step 3: Run full test suite**

```bash
pnpm test:unit -- --run
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/routes/settings/+page.svelte
git commit -m "feat: add key-presence indicator to settings screen"
```
