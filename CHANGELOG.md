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
