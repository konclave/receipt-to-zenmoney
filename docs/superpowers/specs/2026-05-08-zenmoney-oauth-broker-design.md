# ZenMoney OAuth Broker Design

**Date:** 2026-05-08

## Goal

Replace the current browser-side ZenMoney OAuth code exchange with a minimal Vercel-hosted auth broker that keeps `client_secret` and `refresh_token` on the server, while preserving the existing client-side pattern where the SPA talks directly to the ZenMoney API and persists a short-lived ZenMoney `access_token` locally.

## Context

The current app is a client-rendered SvelteKit PWA deployed on Vercel as a static site. ZenMoney OAuth is currently implemented in the browser:

- The frontend bundle contains `PUBLIC_ZENMONEY_CLIENT_ID` and `PUBLIC_ZENMONEY_CLIENT_SECRET`.
- The browser exchanges the OAuth `code` for an access token directly against ZenMoney.
- The resulting ZenMoney token is stored in IndexedDB alongside other app settings.

This design exposes the ZenMoney `client_secret` to all users and has no server-side refresh-token handling. ZenMoney does not support PKCE, so a public-client-only SPA cannot implement OAuth correctly without introducing a trusted server component.

## Non-Goals

- Do not proxy all ZenMoney API calls through Vercel.
- Do not convert the app into a server-rendered application.
- Do not add multi-user accounts or any app-specific login system.
- Do not redesign unrelated Settings, capture, review, or history flows.
- Do not remove support for manual ZenMoney personal-token auth.

## High-Level Approach

Add a narrow auth broker to the existing SvelteKit app using Vercel server routes. The broker will:

- start the ZenMoney OAuth flow
- receive the OAuth callback
- exchange authorization codes using server-only ZenMoney credentials
- store the refresh token in Vercel KV
- issue short-lived ZenMoney access tokens to the SPA on initial connect and on demand
- clear server-side session state on logout

The SPA will continue calling ZenMoney directly for `diff` and transaction sync. It will persist the current ZenMoney `access_token` and expiry timestamp in IndexedDB, use that token for direct ZenMoney calls, and request a fresh token from the broker when the stored token is missing, expired, near expiry, or rejected with `401`.

## Architecture

### Deployment Model

The app will move from `@sveltejs/adapter-static` to `@sveltejs/adapter-vercel` so the same codebase can host both the client-rendered UI and server-side auth endpoints on Vercel.

The UI should remain client-rendered for the main app experience. Existing SPA-style navigation and client persistence remain intact. Server functionality is introduced only for OAuth and token lifecycle management.

The current `vercel.json` catch-all rewrite to `index.html` must be removed or replaced with configuration compatible with SvelteKit on Vercel, because it would interfere with server routes such as `/api/zenmoney/*`.

### Server-Side Session Model

The server will own the ZenMoney refresh token.

Each connected browser session receives:

- a random server-generated session id
- an `HttpOnly`, `Secure`, `SameSite=Lax` session cookie containing only that session id

The corresponding session record is stored in Vercel KV. The browser never receives the refresh token and cannot read the session cookie from JavaScript.

This keeps the ZenMoney confidential client credentials and long-lived refresh capability off the device while avoiding a larger backend proxy.

### Authentication Modes

The app will support two explicit ZenMoney authentication modes:

- `oauth`: ZenMoney OAuth via the Vercel broker
- `manual`: user-pasted personal ZenMoney token stored locally

The active auth mode must be stored in local settings and used to decide:

- which UI controls are shown in Settings
- how the app determines whether ZenMoney is connected
- where the bearer token comes from before each ZenMoney API call

OAuth and manual-token state must remain separate. The app must not infer auth state from the presence of a token alone.

### Token Ownership

- Server owns: `client_secret`, refresh token, refresh flow, token expiry metadata
- Browser owns:
  - for `oauth` mode: short-lived access token returned by broker endpoints plus access-token expiry metadata
  - for `manual` mode: the user-provided personal ZenMoney token
  - for both modes: existing local app state such as categories, account selection, sync timestamps, and transaction drafts

The browser persists the ZenMoney access token in IndexedDB together with `expiresAt`. That token is the local credential used for direct ZenMoney API calls, but it is not independently refreshable. The broker session remains the durable server-side authority that can mint a new ZenMoney access token using the stored refresh token.

### Session Lifetime Policy

The broker session cookie identifies the server-side refresh-token session. It does not need to match the ZenMoney access-token lifetime.

Policy:

- rolling idle lifetime: 30 days
- absolute maximum lifetime: 90 days
- refresh the cookie expiry on successful `/api/zenmoney/access-token` calls
- clear the cookie immediately on logout, missing KV session, or refresh-token failure

ZenMoney access tokens remain governed by ZenMoney's own expiry response and are expected to be much shorter-lived, typically around 24 hours.

## Server Components

### `GET /api/zenmoney/oauth/start`

Responsibilities:

- generate a CSRF `state` value
- store that `state` in a short-lived cookie
- construct the ZenMoney authorize URL
- redirect the browser to ZenMoney

Notes:

- This replaces client-side `buildAuthUrl()` usage from the Settings page.
- The state cookie should have a short TTL and should be cleared after callback handling.

### `GET /api/zenmoney/oauth/callback`

Responsibilities:

- read `code` and `state` from the callback URL
- validate the returned `state` against the stored cookie
- exchange the authorization code for ZenMoney tokens using server-only env vars
- create a new auth session id
- persist session data in Vercel KV
- set the `HttpOnly` session cookie
- clear the temporary OAuth state cookie
- redirect back to the client callback page so the app can fetch and persist the initial ZenMoney access token

Failure behavior:

- invalid or missing `state` returns the user to `/settings` with an explicit reconnect error
- token exchange failure returns the user to `/settings` with an explicit auth error

Notes:

- The server stores the refresh token in KV and may also cache the returned access token there.
- The client callback page should immediately call `/api/zenmoney/access-token`, persist the returned ZenMoney token in IndexedDB, and then continue to `/settings`.

### `GET /api/zenmoney/access-token`

Responsibilities:

- read the session cookie
- load the session record from Vercel KV
- determine whether the cached ZenMoney access token is still valid
- refresh the access token with the stored refresh token when necessary
- update the KV record after refresh
- return `{ accessToken, expiresAt }` JSON to the SPA

Notes:

- Refresh should happen slightly before hard expiry to reduce race conditions during client requests.
- Successful responses should also extend the rolling broker session cookie expiry.
- If session lookup fails or refresh fails, this endpoint should return an auth failure that the SPA treats as “Reconnect ZenMoney”.

### `POST /api/zenmoney/logout`

Responsibilities:

- read the session cookie
- delete the associated session record from Vercel KV if present
- clear the session cookie
- return success regardless of whether the session was already missing

## Vercel KV Data Model

Each session record should be narrow and purpose-built:

- `sessionId`
- encrypted `refreshToken`
- optional cached `accessToken`
- `accessTokenExpiresAt`
- `createdAt`
- `updatedAt`

The access token cache is an optimization only. The refresh token remains the durable credential.

The refresh token should be encrypted before storage. Encryption keys live in server-only Vercel environment variables and are never exposed to the client.

## Environment Variables

### Server-only

- `ZENMONEY_CLIENT_ID`
- `ZENMONEY_CLIENT_SECRET`
- `ZENMONEY_REDIRECT_URI`
- `ZENMONEY_SESSION_SECRET`
- `ZENMONEY_TOKEN_ENCRYPTION_KEY`
- Vercel KV binding variables

### Client-visible

No ZenMoney OAuth secret material should remain in `PUBLIC_*` variables.

If the client needs to know whether OAuth is configured, that should come from a server-derived flag or a build-time public boolean that does not expose secrets.

## Client Changes

## Settings Page

The Settings screen will stop initiating OAuth directly against ZenMoney. Instead:

- the manual personal-token input remains visible and editable at all times
- the app still stores the active auth mode explicitly
- in `oauth` mode, “Connect with ZenMoney” navigates to `/api/zenmoney/oauth/start`
- in `oauth` mode, “Disconnect” calls `/api/zenmoney/logout` and clears the locally cached OAuth access token
- OAuth controls are rendered only when the developer enables them via public config such as `PUBLIC_ZENMONEY_OAUTH_ENABLED`

The connected state should be mode-aware:

- `oauth` mode: based on the presence of a usable locally cached OAuth access token and successful broker refresh when needed
- `manual` mode: based on the presence of a saved manual ZenMoney token

Mode switching should be explicit. The user does not need to leave manual-token mode to edit the token field. Changing the active mode should clear only the credentials belonging to the other mode if the user confirms the switch.

## Client Token Helper

Add client helpers responsible for obtaining the bearer token used for ZenMoney API requests.

Responsibilities:

- `oauth` helper:
  - read the persisted ZenMoney `access_token` and `expiresAt` from IndexedDB
  - decide whether the stored token is still usable
  - fetch the current access token from the broker when refresh is needed
  - persist refreshed token data back to IndexedDB
- `manual` helper:
  - read the saved manual ZenMoney token from IndexedDB
  - return a clear error when manual mode is selected but the token is missing
- shared behavior:
  - resolve the current auth mode
  - return structured auth errors to the caller

The OAuth helper should refresh proactively shortly before expiry rather than waiting for the exact timestamp to pass.

## Existing ZenMoney Client Calls

Current client-side ZenMoney operations such as category reload and transaction submission will keep calling ZenMoney directly, but they will first acquire an access token from the broker helper.

ZenMoney-specific local settings that are not credentials can remain in IndexedDB:

- selected account id
- ZenMoney user id
- last known server timestamp

Browser-stored ZenMoney OAuth refresh tokens must not exist.
Browser-stored ZenMoney access-token data may remain in IndexedDB for OAuth mode.
Browser-stored manual ZenMoney tokens remain valid for manual mode.

## Error Handling

The new flow should make auth failures explicit and recoverable.

### OAuth initiation and callback

- missing or invalid state: fail callback, clear temporary auth state, redirect to settings with reconnect guidance
- ZenMoney token exchange failure: redirect to settings with a clear connection error

### Session and token lifecycle

- missing session cookie in OAuth mode: client shows disconnected state and reconnect CTA
- missing KV session record: clear cookie and require reconnect
- refresh failure: clear session record and require reconnect
- KV outage: surface a temporary auth infrastructure error and avoid silently using stale local state
- locally stored OAuth access token expired or near expiry: fetch a new token from broker before calling ZenMoney
- manual mode with missing saved token: show manual-token guidance in Settings

### Direct ZenMoney API calls from the SPA

If ZenMoney responds with `401` during a direct client call in OAuth mode:

1. request a fresh access token once from `/api/zenmoney/access-token`
2. retry the ZenMoney request once
3. if it still fails, show reconnect guidance and stop retrying

If ZenMoney responds with `401` during a direct client call in manual mode:

1. do not call the broker
2. show manual-token failure guidance
3. ask the user to update or reconnect with OAuth

This keeps retry behavior bounded and auth-mode-specific.

## Security Considerations

- ZenMoney `client_secret` must never be imported into client code.
- ZenMoney refresh tokens must never be returned to the browser.
- Session cookies must be `HttpOnly`, `Secure`, and `SameSite=Lax`.
- OAuth state must be generated server-side and validated server-side.
- Refresh tokens stored in KV must be encrypted at rest by the application before writing.
- Logout must remove server-side session records, not just clear client state.
- Broker session cookies should use a 30-day rolling lifetime with a 90-day absolute cap.
- Manual-token mode must not accidentally inherit OAuth broker state.

This design improves the current secret exposure problem but does not attempt to fully hide short-lived ZenMoney access tokens from the browser, because direct browser-to-ZenMoney API calls remain an explicit requirement.

## Testing Strategy

### Unit Tests

Add unit coverage for:

- authorize URL creation
- OAuth state generation and validation helpers
- token exchange request formatting
- refresh-token request formatting
- session record serialization and encryption helpers
- cookie creation and clearing helpers

### Route Tests

Add route-level coverage for:

- OAuth start redirect
- callback success
- callback invalid-state failure
- callback token-exchange failure
- access-token success using cached token
- access-token success after refresh
- access-token response extends rolling session expiry
- access-token failure with missing session
- logout cleanup

### Client Tests

Add client coverage for:

- settings connected vs disconnected state
- settings mode switching between OAuth and manual token
- connect/disconnect actions wiring to broker endpoints
- access-token helper behavior
- persisted token reuse until near expiry
- one-time retry on ZenMoney `401`

### Manual Verification

Verify on a real Vercel preview deployment with:

- configured ZenMoney OAuth redirect URI
- Vercel KV enabled
- server-only env vars set

Manual checks:

- connect from `/settings`
- return successfully from ZenMoney
- reload categories
- submit a transaction
- disconnect and verify reconnect is required
- wait for token expiry or simulate expiry and verify refresh path

## Migration Notes

- Remove browser-side OAuth token exchange code from the bundle.
- Remove `PUBLIC_ZENMONEY_CLIENT_SECRET` and related public secret configuration.
- Replace adapter-static deployment assumptions with adapter-vercel assumptions.
- Update documentation to describe Vercel env vars, KV requirement, and the new OAuth connection flow.

## Implementation Constraint

Manual ZenMoney personal-token auth remains supported as an explicit alternate auth mode.

The implementation plan must keep manual-token and OAuth session state clearly separated in UI, settings persistence, and runtime token acquisition.
