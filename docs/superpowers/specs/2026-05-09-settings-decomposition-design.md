# Settings Page Decomposition Design

Date: 2026-05-09
Status: Drafted from approved brainstorming

## Goal

Decompose `src/routes/settings/+page.svelte` into smaller, feature-focused components and Svelte-native stores so that:

- `+page.svelte` becomes a thin composition layer
- async workflows move out of the route component
- each settings area owns its own reactive state and feedback
- the refactor reduces coupling instead of only moving markup around

## Current Problem

`src/routes/settings/+page.svelte` is large and mixes multiple unrelated responsibilities:

- AI provider configuration
- Zenmoney authentication and connection state
- Zenmoney category/account sync
- default account selection
- backup/export/import workflows
- storage stats and cleanup workflows
- page-level feedback and modal orchestration

This makes the route hard to reason about, increases accidental coupling between features, and makes testing expensive because most behavior is trapped in one component.

## Recommended Approach

Use domain-specific Svelte-native stores plus feature components, backed by a small repository layer.

This approach was chosen over:

- a single page store with mostly presentational child components, which would keep most coupling intact
- nested settings subroutes, which would be cleaner long-term but would expand scope beyond decomposition

## Target Structure

### Route

`src/routes/settings/+page.svelte`

Responsibilities:

- initialize the page-level settings context
- render the settings sections in order
- pass `appVersion` to the footer component
- optionally host cleanup modals if modal layering should remain route-owned

Non-responsibilities:

- direct DB/service calls
- OpenRouter model fetching
- Zenmoney sync logic
- backup/export/import workflows
- cleanup execution logic
- feature-specific dirty-state calculations

### Settings State Layer

Create `src/lib/settings/` with the following modules.

`settings.repository.ts`

- wraps existing DB and service functions behind a smaller settings-focused API
- prevents stores from importing many unrelated modules directly

`settings-page.store.svelte.ts`

- loads the initial snapshot once
- exposes page bootstrap state such as `ready` and `loadError`
- constructs feature stores from shared initial data

`ai-settings.store.svelte.ts`

- owns provider choice
- owns API key fields
- owns OpenRouter model loading and fallback state
- owns save and dirty-state logic

`zenmoney-connection.store.svelte.ts`

- owns OAuth/manual token connection state
- owns connect/disconnect actions
- owns connection-specific feedback

`zenmoney-data.store.svelte.ts`

- owns category sync state
- owns cached account data
- owns default account selection and persistence
- owns the single-account auto-select rule after sync

`backup.store.svelte.ts`

- owns export/import state and feedback

`cleanup.store.svelte.ts`

- owns storage stats
- owns cleanup modal state
- owns cleanup target selection
- owns backup-before-delete and delete execution flow

### Settings Components

Create `src/lib/components/settings/` with:

- `AiSettingsSection.svelte`
- `ZenmoneyConnectionSection.svelte`
- `ZenmoneyDataSection.svelte`
- `BackupRestoreSection.svelte`
- `StorageCleanupSection.svelte`

`ZenmoneyDataSection.svelte` intentionally includes both:

- category sync UI
- default account UI

Those behaviors belong to the same Zenmoney data lifecycle and should not be split into separate components.

## Initial Snapshot

The page store should load one normalized snapshot and distribute it to feature stores. The initial snapshot should contain:

- persisted settings
- cached categories
- cached accounts
- storage stats
- `oauthEnabled`

This avoids multiple mount-time reads from IndexedDB and keeps bootstrap order deterministic.

## Store Interfaces

### AI Settings Store

Suggested public surface:

- state: `provider`, `claudeApiKey`, `openrouterApiKey`, `openrouterModel`
- derived: `claudeApiKeySaved`, `openrouterApiKeySaved`, `dirty`
- async state: `saving`, `modelsLoading`, `modelsFailed`
- feedback: `error`, `success`
- actions: `setProvider()`, `loadModels()`, `save()`

Notes:

- the store owns current-vs-saved comparison
- the UI should not calculate dirty state

### Zenmoney Connection Store

Suggested public surface:

- state: `manualToken`
- derived: `connected`
- async state: `saving`, `disconnecting`
- feedback: `error`, `success`
- actions: `saveManualToken()`, `startOAuthFlow()`, `disconnect()`

Notes:

- this store owns only auth/connection concerns
- it should not know about categories or account lists

### Zenmoney Data Store

Suggested public surface:

- state: `categoryCount`, `lastSyncDate`, `accounts`, `selectedAccountId`
- derived: `hasMultipleAccounts`, `accountDirty`
- async state: `syncing`, `savingAccount`
- feedback: `error`, `success`
- actions: `reloadCategories()`, `selectAccount()`, `saveAccount()`

Notes:

- this store owns the default account UI
- it also owns the current single-account auto-select behavior after sync

### Backup Store

Suggested public surface:

- async state: `exporting`, `importing`
- feedback: `status`, `error`
- actions: `exportAll()`, `importFile(file)`

### Cleanup Store

Suggested public surface:

- state: `storageStats`, `cleanupModalOpen`, `cleanupConfirmTarget`
- async state: `loadingStats`, `cleaning`
- feedback: `status`, `error`
- actions:
  - `refreshStats()`
  - `openCleanupModal()`
  - `selectCleanupTarget()`
  - `confirmCleanup({ withBackup })`
  - `closeModals()`

## Data Flow

`settings-page.store.svelte.ts` loads the snapshot once, then constructs feature stores.

After bootstrap, stores should communicate through explicit callbacks or narrow shared helpers rather than through a single giant mutable store.

Allowed cross-store coordination:

- `zenmoney-connection` can notify `zenmoney-data` when disconnect happens if account-related derived state must be reset
- `backup` and `cleanup` can share `cleanup.refreshStats()` after import/delete operations
- `zenmoney-data.reloadCategories()` updates its own accounts and category state without depending on the connection store

Avoid:

- one giant writable settings store for the whole page
- page-level feature orchestration leaking back into `+page.svelte`

## Error Handling And Feedback

Each feature store should own its own feedback state.

Use a consistent pattern:

- `error`
- `success` or `status`
- feature-specific loading flags

Reasoning:

- backup failures should not overwrite AI settings feedback
- OpenRouter model fetch issues should remain local to AI settings
- route-level alerts should be reserved for bootstrap failures only

`settings-page.store.svelte.ts` should expose only page bootstrap failure, not feature-action failures.

## Testing Strategy

Test behavior at the store level first, because that is where the refactor moves the logic.

Add store tests for:

- dirty-state calculation
- save success/error handling
- OpenRouter model-loading fallback behavior
- category/account sync behavior
- single-account auto-select and persistence
- cleanup target selection
- cleanup flow with optional backup

Keep component tests light:

- each section renders the correct controls for store state
- each section wires user actions to store actions

Keep route-level tests minimal:

- route composes sections
- route handles page bootstrap/loading state

Add repository tests only where the adapter performs non-trivial transformation.

## Refactor Constraints

- preserve current behavior; this is a decomposition refactor, not a product redesign
- keep `ZenmoneyDataSection` as the combined sync/account section
- keep `zenmoney-connection` separate from `zenmoney-data`
- prefer Svelte-native stores over plain controller modules for reactive UI state
- keep the route thin after extraction

## Out Of Scope

- changing settings navigation or splitting into nested subroutes
- redesigning the visual layout
- changing persistence formats
- changing Zenmoney/OAuth product behavior

## Implementation Outcome

After the refactor:

- `src/routes/settings/+page.svelte` should mostly compose sections
- each settings area should be understandable in isolation
- async side effects should live in feature stores
- tests should target focused store behavior instead of one monolithic page component
