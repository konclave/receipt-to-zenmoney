# [1.9.0](https://github.com/konclave/receipt-to-zenmoney/compare/v1.8.0...v1.9.0) (2026-05-08)


### Bug Fixes

* copy .env.example before type check in CI ([08fcce7](https://github.com/konclave/receipt-to-zenmoney/commit/08fcce76bea21513688d540389fe968794425cb9))
* update version test for AppFeedback component extraction ([041598d](https://github.com/konclave/receipt-to-zenmoney/commit/041598d0db4fb9a8785471e06e8e15a346f87e3a))
* use \$env/static/public for OAuth feature flag in server config ([b21d6da](https://github.com/konclave/receipt-to-zenmoney/commit/b21d6da14121e962b7e1c346eeb43ad55fede1d8))


### Features

* add ZenMoney OAuth authentication ([9953d62](https://github.com/konclave/receipt-to-zenmoney/commit/9953d6229f1040ee0053b187217fc091060e864d))
* add ZenMoney OAuth broker flow ([fe1092d](https://github.com/konclave/receipt-to-zenmoney/commit/fe1092d639ddfc909946c5136ff341e02f387450))
* hide ZenMoney OAuth button when credentials not configured ([dc0e21c](https://github.com/konclave/receipt-to-zenmoney/commit/dc0e21c1b652e16e223ac3ef2414e1d6a1bca8da))

# [1.8.0](https://github.com/konclave/receipt-to-zenmoney/compare/v1.7.0...v1.8.0) (2026-05-07)


### Features

* add about page and update settings footer ([a2f4611](https://github.com/konclave/receipt-to-zenmoney/commit/a2f46113fa7c7c1b65a4aa5776ff601cc8f0890e))
* expand about page with privacy & install details ([4d243e4](https://github.com/konclave/receipt-to-zenmoney/commit/4d243e47f1ac74ec6e256ded6920fe31fbf24739))
* move About to bottom nav bar ([f097420](https://github.com/konclave/receipt-to-zenmoney/commit/f0974209749c5b5ed8f12ea3d57a68ed3db30025))

# [1.7.0](https://github.com/konclave/receipt-to-zenmoney/compare/v1.6.0...v1.7.0) (2026-05-07)


### Bug Fixes

* reset cleaning on abort, refresh stats after import, add tabindex to modals ([cad943a](https://github.com/konclave/receipt-to-zenmoney/commit/cad943a4d4b6267cda83f2ded9a48deb2cf010e4))
* use vi.spyOn in storage-stats test to avoid fake-indexeddb blob.size issue ([77439b9](https://github.com/konclave/receipt-to-zenmoney/commit/77439b97e623d3ccb27576795dd632dd9498865d))
* use year-dash prefix match and add empty-DB test ([a3a0b49](https://github.com/konclave/receipt-to-zenmoney/commit/a3a0b49ff1857e6973b27b0a7b983cedfb0eab47))


### Features

* add bulkDeleteReceiptImages to receipt-images db ([2ffd6f8](https://github.com/konclave/receipt-to-zenmoney/commit/2ffd6f86d4ffbca94d72db5abe4eea55bd5ed429))
* add CleanupConfirmModal component ([43626bd](https://github.com/konclave/receipt-to-zenmoney/commit/43626bde8c9e7c9ad9a952aced54d0b27a473801))
* add CleanupModal component ([24f7c14](https://github.com/konclave/receipt-to-zenmoney/commit/24f7c14980956708243cc7fdc5578acaeeb93eec))
* add deleteTransactionsByPeriod to transactions db ([b42da66](https://github.com/konclave/receipt-to-zenmoney/commit/b42da66a544fd1c4ff5b1b9c9fcb7034a263657d))
* add exportBackupForPeriod to backup service ([994837d](https://github.com/konclave/receipt-to-zenmoney/commit/994837d5e036851908f43eea14a543553d16445d))
* add storage stats and cleanup flow to settings page ([5130b7c](https://github.com/konclave/receipt-to-zenmoney/commit/5130b7ceb902fe32de82fce45cf0636ba975b6fd))
* add storage-stats service with getStorageStats and formatBytes ([7b1e61e](https://github.com/konclave/receipt-to-zenmoney/commit/7b1e61e2564ca149bfef67bee74180caf9927bcf))


### Reverts

* restore receipt-images.ts to pre-Task-3 state (remove out-of-scope blobSize) ([5a68258](https://github.com/konclave/receipt-to-zenmoney/commit/5a68258e4dcde81bf5dcb246c10085680fc461ec))

# [1.6.0](https://github.com/konclave/receipt-to-zenmoney/compare/v1.5.0...v1.6.0) (2026-05-07)


### Bug Fixes

* guard against empty OpenRouter model string before parsing ([7220a1a](https://github.com/konclave/receipt-to-zenmoney/commit/7220a1a909e99cd55f8dc2f70231084fb32c8061))


### Features

* add aiProvider, openrouterApiKey, openrouterModel to Settings ([7e8d7a2](https://github.com/konclave/receipt-to-zenmoney/commit/7e8d7a2af5e039c56cdddb459ded81fbe1054504))
* add OpenRouter provider selector to Settings UI ([a6b96bd](https://github.com/konclave/receipt-to-zenmoney/commit/a6b96bdeabecc2065854254db606464b178734f6))
* add OpenRouter provider support to parseReceipt ([8d85c67](https://github.com/konclave/receipt-to-zenmoney/commit/8d85c67fcfbe530410cc81105ed1812a076690ee))
* dynamic OpenRouter model list fetched from API with fallback to text input ([b474487](https://github.com/konclave/receipt-to-zenmoney/commit/b474487815c101a187d66a2d139182bf388b1c0a))
* mark free OpenRouter models with 🆓 emoji in model list ([6fe8138](https://github.com/konclave/receipt-to-zenmoney/commit/6fe813899d76377a6dfeef0b21a4542732de885c))
* pass AiConfig from settings to parseReceipt in review flow ([2f35850](https://github.com/konclave/receipt-to-zenmoney/commit/2f35850bff32ded07341848d7364ae288c9d29b1))

# [1.5.0](https://github.com/konclave/receipt-to-zenmoney/compare/v1.4.0...v1.5.0) (2026-05-07)


### Bug Fixes

* address code review issues (blob URL leak, loading state, base64 perf, mimeType validation) ([2c04831](https://github.com/konclave/receipt-to-zenmoney/commit/2c048313d58e7260d7da1a05c50a2dfe41e515c2))
* correct type errors in receipt page (params.id assertion, undefined state types) ([4c0e677](https://github.com/konclave/receipt-to-zenmoney/commit/4c0e67712c0197901a7fe6b580fe7553e790ea43))
* disable prerender for dynamic receipt route ([28c9f64](https://github.com/konclave/receipt-to-zenmoney/commit/28c9f645f689af0b914c130ab722ce692b6dfee7))


### Features

* add /receipt/[id] page for full receipt image view ([3b1748f](https://github.com/konclave/receipt-to-zenmoney/commit/3b1748f9f404189d5cd1c89d88ac8775141f83a8))
* add getTransaction(id) to transactions module ([a701e18](https://github.com/konclave/receipt-to-zenmoney/commit/a701e18dde07696f86a33ef76efd8765fa08d14e))
* add receipt thumbnail to TransactionCard ([6ec8ab7](https://github.com/konclave/receipt-to-zenmoney/commit/6ec8ab747c3c65ac3bbde3152f97a88db034a5e8))
* add receipt-images DB module with CRUD operations ([cb69c10](https://github.com/konclave/receipt-to-zenmoney/commit/cb69c102ecde6b6f4bcfa0e63984eca6c7e961de))
* add ReceiptImage type and receipt-images IndexedDB store (v5) ([cf0fdb2](https://github.com/konclave/receipt-to-zenmoney/commit/cf0fdb2650c50af1be6d1f76c17b213787cc958c))
* backup v2 includes receipt images in export/import ([cfe29f5](https://github.com/konclave/receipt-to-zenmoney/commit/cfe29f53c580ab2ec5ddbc0d11d0f2124eae82a4))
* load and display receipt image thumbnails in history ([98a34d7](https://github.com/konclave/receipt-to-zenmoney/commit/98a34d7c76216f75e7cbee41a0d2530d9fa988bd))
* save receipt image to IndexedDB on transaction submit ([0e9ebe5](https://github.com/konclave/receipt-to-zenmoney/commit/0e9ebe50944d02557578166778296cd7ffc6d672))

# [1.4.0](https://github.com/konclave/receipt-to-zenmoney/compare/v1.3.1...v1.4.0) (2026-05-07)


### Bug Fixes

* fall back to download when Web Share API throws NotAllowedError ([a4ff2b0](https://github.com/konclave/receipt-to-zenmoney/commit/a4ff2b0b46594febf5a2894755182a863061a6f6))
* harden importBackup validation and strengthen tests ([8109c4f](https://github.com/konclave/receipt-to-zenmoney/commit/8109c4fe71dc094f0014808ca9b8ef4e53add027))
* resolve lint and format issues in backup service ([927ef89](https://github.com/konclave/receipt-to-zenmoney/commit/927ef89cb6c878b8d1336e6f9c2474ec93007ca8))
* type-safe fileInput binding and narrow accept filter ([5e482aa](https://github.com/konclave/receipt-to-zenmoney/commit/5e482aa1290c084e79d10a3f780ea76429be7a5f))
* validate transaction items and guard against oversized imports ([62a3fd9](https://github.com/konclave/receipt-to-zenmoney/commit/62a3fd901d480d46f91084d72c7b70d0cf3c4018))


### Features

* add Backup & Restore section to settings page ([acbf104](https://github.com/konclave/receipt-to-zenmoney/commit/acbf104fe297585b3ed1da8462751d31723f09e3))
* add bulkInsertTransactions for batch import ([daf4e9c](https://github.com/konclave/receipt-to-zenmoney/commit/daf4e9cc7ee918075fb03b56399a9f08d03e7c33))
* implement exportBackup — gzip JSON5 transaction dump ([d8d274d](https://github.com/konclave/receipt-to-zenmoney/commit/d8d274dafccc71a03fec2a3450ac3a6d12113993))
* implement importBackup — merge from gzip JSON5 backup ([fe958c8](https://github.com/konclave/receipt-to-zenmoney/commit/fe958c89ea990719115c5d566cec5a89fcfd854f))

## [1.3.1](https://github.com/konclave/receipt-to-zenmoney/compare/v1.3.0...v1.3.1) (2026-05-06)


### Bug Fixes

* add vercel rewrites config ([dae7e79](https://github.com/konclave/receipt-to-zenmoney/commit/dae7e793d99fae1116cf5e62f9be150ba0e3931a))
* replace category select with native ([853c8af](https://github.com/konclave/receipt-to-zenmoney/commit/853c8af464fd4e0423b6b5456100fcf4ae55b137))

# [1.3.0](https://github.com/konclave/receipt-to-zenmoney/compare/v1.2.0...v1.3.0) (2026-05-06)


### Features

* add app version to settings page ([5d61a09](https://github.com/konclave/receipt-to-zenmoney/commit/5d61a096909f6dcf40de301a5cd2b61cce0d1a29))
* update icons ([ab7d9aa](https://github.com/konclave/receipt-to-zenmoney/commit/ab7d9aab4b30eb006a4e4e5862bf7f6baa323fd2))

# [1.2.0](https://github.com/konclave/receipt-to-zenmoney/compare/v1.1.0...v1.2.0) (2026-05-06)


### Bug Fixes

* add created and changed timestamps to ZenMoney transaction payload ([ad2e16b](https://github.com/konclave/receipt-to-zenmoney/commit/ad2e16bb5a29b6819bf1bafb54c0cb52b6116de7))
* add incomeInstrument and outcomeInstrument to ZenMoney transaction payload ([920b326](https://github.com/konclave/receipt-to-zenmoney/commit/920b326ba17f71c08b75fbb135f21edaad0f1417))
* include all required ZenMoney transaction fields in payload ([8832099](https://github.com/konclave/receipt-to-zenmoney/commit/88320998d28d8974f0665d3fe46b49bb8691bad1))
* include user ID in ZenMoney transaction payload ([3767f99](https://github.com/konclave/receipt-to-zenmoney/commit/3767f99e24d842e35737f8e5eee948bcd4d37fb9))
* sort accounts alphabetical ([fc036d2](https://github.com/konclave/receipt-to-zenmoney/commit/fc036d2d51ec04a8488f81379e43f528557c17b9))


### Features

* disable save buttons until settings are changed ([c815ac8](https://github.com/konclave/receipt-to-zenmoney/commit/c815ac85596fa5588339196dcf53ace0a89f8f7d))

# [1.1.0](https://github.com/konclave/receipt-to-zenmoney/compare/v1.0.0...v1.1.0) (2026-05-06)


### Bug Fixes

* clarify zenmoneyId strategy, scope onRetry to failed cards, improve error display ([85da8fb](https://github.com/konclave/receipt-to-zenmoney/commit/85da8fb61472a0cb6ac389615bd20831ef748168))
* handle compression error and null check in file picker ([b478f34](https://github.com/konclave/receipt-to-zenmoney/commit/b478f34aa0a4d4fb6694a9a312071beac3024d58))
* key-presence dot reflects saved state, add role=img for accessibility ([8403b28](https://github.com/konclave/receipt-to-zenmoney/commit/8403b28bc30be2e9ff93984be0cdcd37eaec3ac9))
* strengthen Claude output validation (null guard, categoryId, date validity) ([28be6d9](https://github.com/konclave/receipt-to-zenmoney/commit/28be6d9d7ad298ce6e2dbba0ee7ccab32314692a))


### Features

* add key-presence indicator to settings screen ([11b7616](https://github.com/konclave/receipt-to-zenmoney/commit/11b761626bb6c5df1ff9f36c223ca6d33df20def))
* add retry button for failed transactions in history ([ef7b41a](https://github.com/konclave/receipt-to-zenmoney/commit/ef7b41a7cd50228105aeaa61f22dd3acb30c6686))
* compress receipt images to JPEG before capture (max 1280px, q=0.85) ([bfd1681](https://github.com/konclave/receipt-to-zenmoney/commit/bfd168156803823d8d0d798d2cc6bd7024b77984))
* persist pending capture in IndexedDB to survive PWA refresh ([8904042](https://github.com/konclave/receipt-to-zenmoney/commit/8904042d707ea3d942cdb90479aff6098f8e897a))
* validate Claude parse result fields before use ([b245d6f](https://github.com/konclave/receipt-to-zenmoney/commit/b245d6f21eec11fd52bdc89f475976938e492974))

# 1.0.0 (2026-05-06)


### Bug Fixes

* crypto key in IDB, serverTimestamp update, file input, cleanup ([8aa278a](https://github.com/konclave/receipt-to-zenmoney/commit/8aa278a81155517a19fcabee2fc45963add042fe))


### Features

* add AES-GCM crypto service ([4395b6f](https://github.com/konclave/receipt-to-zenmoney/commit/4395b6f76fe1f4c39133e8979b3a162c029fafe9))
* add app layout with bottom nav and first-launch redirect ([6c2ed4a](https://github.com/konclave/receipt-to-zenmoney/commit/6c2ed4a6deae9352e321275a37bbef746a0dcb9c))
* add capture screen with camera and file picker ([0d3cd85](https://github.com/konclave/receipt-to-zenmoney/commit/0d3cd8597a2011bcda997910a134751c3b08c3b2))
* add capture store and global CSS design tokens ([9b4f171](https://github.com/konclave/receipt-to-zenmoney/commit/9b4f17107de70069808418c94351d836f045578a))
* add CategoryPicker component using Melt UI Select ([8cd55bb](https://github.com/konclave/receipt-to-zenmoney/commit/8cd55bb0262290b6bff0decf7e7ab265b602a010))
* add Claude receipt parsing service ([a9de0aa](https://github.com/konclave/receipt-to-zenmoney/commit/a9de0aa87667e89886355b552e7f328ed8b010e0))
* add history screen with transaction list ([d3ebb76](https://github.com/konclave/receipt-to-zenmoney/commit/d3ebb763c4ed9faaffb092b84b190184e3d826f8))
* add IndexedDB layer for settings, categories, and transactions ([7530dd7](https://github.com/konclave/receipt-to-zenmoney/commit/7530dd79befd3d4c4c456c7710b07e87d623006e))
* add PWA configuration with service worker and app manifest ([58f6097](https://github.com/konclave/receipt-to-zenmoney/commit/58f6097460141993cd46a1ff1235ca1b6c18e866))
* add review screen with Claude parsing and ZenMoney submission ([b331b02](https://github.com/konclave/receipt-to-zenmoney/commit/b331b020d86928660efea0a3b3565a2a12e89d1f))
* add semantic-release with changelog and GitHub Actions workflow ([0bee7dc](https://github.com/konclave/receipt-to-zenmoney/commit/0bee7dc5ea575d41d85f859da8bf6e976d13ccb2))
* add settings screen with key management and category sync ([e837c59](https://github.com/konclave/receipt-to-zenmoney/commit/e837c59e75de5e1d470b1140beea779cdf596626))
* add shared TypeScript types ([a20b535](https://github.com/konclave/receipt-to-zenmoney/commit/a20b53556bfa0a17d4f75eef9f9774a039500b59))
* add ZenMoney sync API service ([8ac2bcc](https://github.com/konclave/receipt-to-zenmoney/commit/8ac2bccdaf4b5519eec5911532de371b6f698435))
* scaffold SvelteKit project with adapter-static and Vitest ([d688a6d](https://github.com/konclave/receipt-to-zenmoney/commit/d688a6d99fd3add2d41c516fb14d55cd370de94f))
