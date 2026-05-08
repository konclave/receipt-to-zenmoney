# ZenMoney OAuth Broker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move ZenMoney OAuth code exchange and refresh-token handling to Vercel server routes while keeping manual ZenMoney personal-token auth as an explicit alternate mode and preserving direct browser-to-ZenMoney API calls.

**Architecture:** Convert the app from static-only deployment to `adapter-vercel`, add a minimal server-side OAuth broker backed by Vercel KV, and introduce explicit ZenMoney auth modes: `oauth` and `manual`. In OAuth mode the client stores `zenmoneyAccessToken` plus `zenmoneyAccessTokenExpiresAt` in IndexedDB; in manual mode it continues to store the user-provided personal token. The broker owns `client_secret`, refresh tokens, and rolling auth sessions; the browser fetches a fresh OAuth access token when missing, near expiry, or rejected by ZenMoney.

**Tech Stack:** SvelteKit 2, Svelte 5, Vitest, IndexedDB via `idb`, Vercel Functions via `@sveltejs/adapter-vercel`, Vercel KV via `@vercel/kv`, Web Crypto on the client, Node `crypto` on the server.

---

### Task 1: Switch Deployment And Public Config Surface

**Files:**
- Create: `src/test/zenmoney-oauth-config.test.ts`
- Modify: `package.json`
- Modify: `svelte.config.js`
- Modify: `vercel.json`
- Modify: `.env.example`

- [ ] **Step 1: Write the failing config test**

```ts
// src/test/zenmoney-oauth-config.test.ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('ZenMoney OAuth deployment config', () => {
  const packageJson = readFileSync(resolve(process.cwd(), 'package.json'), 'utf8');
  const svelteConfig = readFileSync(resolve(process.cwd(), 'svelte.config.js'), 'utf8');
  const envExample = readFileSync(resolve(process.cwd(), '.env.example'), 'utf8');
  const vercelConfig = readFileSync(resolve(process.cwd(), 'vercel.json'), 'utf8');

  it('uses adapter-vercel instead of adapter-static', () => {
    expect(packageJson).toContain('@sveltejs/adapter-vercel');
    expect(svelteConfig).toContain("@sveltejs/adapter-vercel");
  });

  it('does not expose ZenMoney OAuth secret material in PUBLIC env vars', () => {
    expect(envExample).not.toContain('PUBLIC_ZENMONEY_CLIENT_SECRET');
    expect(envExample).toContain('ZENMONEY_CLIENT_SECRET=');
    expect(envExample).toContain('PUBLIC_ZENMONEY_OAUTH_ENABLED=');
  });

  it('does not rewrite every request to index.html', () => {
    expect(vercelConfig).not.toContain('"destination": "/index.html"');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm test -- --run src/test/zenmoney-oauth-config.test.ts`

Expected: FAIL because `@sveltejs/adapter-vercel` is not installed or referenced, `.env.example` still contains `PUBLIC_ZENMONEY_CLIENT_SECRET`, and `vercel.json` still rewrites all routes to `index.html`.

- [ ] **Step 3: Update package, adapter, and env config**

```json
// package.json (relevant excerpt)
{
  "devDependencies": {
    "@sveltejs/adapter-vercel": "^5.10.2",
    "@sveltejs/kit": "^2.57.0"
  },
  "dependencies": {
    "@vercel/kv": "^3.0.0",
    "idb": "^8.0.3"
  }
}
```

```js
// svelte.config.js
import adapter from '@sveltejs/adapter-vercel'
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter()
  }
}
```

```json
// vercel.json
{}
```

```dotenv
# .env.example
# ZenMoney OAuth server credentials
# Add both http://localhost:5173/api/zenmoney/oauth/callback (dev)
# and your production callback URL in ZenMoney app settings.
ZENMONEY_CLIENT_ID=
ZENMONEY_CLIENT_SECRET=
ZENMONEY_REDIRECT_URI=http://localhost:5173/api/zenmoney/oauth/callback
ZENMONEY_SESSION_SECRET=
ZENMONEY_TOKEN_ENCRYPTION_KEY=
PUBLIC_ZENMONEY_OAUTH_ENABLED=true
```

- [ ] **Step 4: Run the config test to verify it passes**

Run: `pnpm test -- --run src/test/zenmoney-oauth-config.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add package.json svelte.config.js vercel.json .env.example src/test/zenmoney-oauth-config.test.ts
git commit -m "build: switch ZenMoney OAuth deployment to Vercel server routes"
```

### Task 2: Add Server OAuth And Session Primitives

**Files:**
- Create: `src/lib/server/zenmoney/config.ts`
- Create: `src/lib/server/zenmoney/types.ts`
- Create: `src/lib/server/zenmoney/cookies.ts`
- Create: `src/lib/server/zenmoney/crypto.ts`
- Create: `src/lib/server/zenmoney/session-store.ts`
- Create: `src/lib/server/zenmoney/oauth.ts`
- Create: `src/lib/server/zenmoney/oauth.test.ts`

- [ ] **Step 1: Write failing unit tests for server helpers**

```ts
// src/lib/server/zenmoney/oauth.test.ts
import { describe, expect, it, vi } from 'vitest';
import {
  buildAuthorizeUrl,
  buildTokenExchangeBody,
  buildRefreshBody,
  isAccessTokenStale,
} from './oauth';
import { encryptRefreshToken, decryptRefreshToken } from './crypto';

describe('buildAuthorizeUrl', () => {
  it('builds ZenMoney authorize URL from server config', () => {
    const url = buildAuthorizeUrl({
      clientId: 'client-id',
      redirectUri: 'https://app.example.com/api/zenmoney/oauth/callback',
      state: 'state-123',
    });

    expect(url).toBe(
      'https://api.zenmoney.ru/oauth2/authorize/?client_id=client-id&redirect_uri=https%3A%2F%2Fapp.example.com%2Fapi%2Fzenmoney%2Foauth%2Fcallback&response_type=code&state=state-123',
    );
  });
});

describe('token request payloads', () => {
  it('builds form-encoded code exchange body', () => {
    expect(buildTokenExchangeBody({
      clientId: 'cid',
      clientSecret: 'secret',
      redirectUri: 'https://app.example.com/callback',
      code: 'abc',
    }).toString()).toBe(
      'client_id=cid&client_secret=secret&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback&code=abc&grant_type=authorization_code',
    );
  });

  it('builds form-encoded refresh body', () => {
    expect(buildRefreshBody({
      clientId: 'cid',
      clientSecret: 'secret',
      refreshToken: 'refresh-1',
    }).toString()).toBe(
      'client_id=cid&client_secret=secret&refresh_token=refresh-1&grant_type=refresh_token',
    );
  });
});

describe('isAccessTokenStale', () => {
  it('returns true when expiry is within the refresh window', () => {
    expect(isAccessTokenStale(Date.now() + 30_000, Date.now())).toBe(true);
    expect(isAccessTokenStale(Date.now() + 10 * 60_000, Date.now())).toBe(false);
  });
});

describe('refresh token encryption', () => {
  it('round-trips refresh tokens', async () => {
    const secret = '0123456789abcdef0123456789abcdef';
    const encrypted = await encryptRefreshToken('refresh-xyz', secret);
    const decrypted = await decryptRefreshToken(encrypted, secret);

    expect(decrypted).toBe('refresh-xyz');
  });
});
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run: `pnpm test -- --run src/lib/server/zenmoney/oauth.test.ts`

Expected: FAIL because the server helper modules do not exist yet.

- [ ] **Step 3: Implement server config, OAuth helpers, cookie policy, crypto, and KV record types**

```ts
// src/lib/server/zenmoney/types.ts
export interface ZenMoneyTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface ZenMoneySessionRecord {
  sessionId: string;
  refreshToken: string;
  accessToken: string | null;
  accessTokenExpiresAt: number;
  createdAt: number;
  updatedAt: number;
  absoluteExpiresAt: number;
}
```

```ts
// src/lib/server/zenmoney/config.ts
import { env } from '$env/dynamic/private';

export function getZenMoneyServerConfig() {
  return {
    clientId: env.ZENMONEY_CLIENT_ID ?? '',
    clientSecret: env.ZENMONEY_CLIENT_SECRET ?? '',
    redirectUri: env.ZENMONEY_REDIRECT_URI ?? '',
    sessionSecret: env.ZENMONEY_SESSION_SECRET ?? '',
    tokenEncryptionKey: env.ZENMONEY_TOKEN_ENCRYPTION_KEY ?? '',
  };
}
```

```ts
// src/lib/server/zenmoney/oauth.ts
const AUTH_URL = 'https://api.zenmoney.ru/oauth2/authorize/';
const TOKEN_URL = 'https://api.zenmoney.ru/oauth2/token/';
const REFRESH_WINDOW_MS = 5 * 60_000;

export function buildAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    state: input.state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export function buildTokenExchangeBody(input: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}) {
  return new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    code: input.code,
    grant_type: 'authorization_code',
  });
}

export function buildRefreshBody(input: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}) {
  return new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    refresh_token: input.refreshToken,
    grant_type: 'refresh_token',
  });
}

export function isAccessTokenStale(expiresAt: number, now = Date.now()): boolean {
  return !expiresAt || expiresAt - now <= REFRESH_WINDOW_MS;
}

export { TOKEN_URL };
```

```ts
// src/lib/server/zenmoney/cookies.ts
export const SESSION_COOKIE = 'zm_session';
export const STATE_COOKIE = 'zm_oauth_state';
export const SESSION_IDLE_TTL_SECONDS = 30 * 24 * 60 * 60;
export const SESSION_ABSOLUTE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const OAUTH_STATE_TTL_SECONDS = 10 * 60;
```

```ts
// src/lib/server/zenmoney/crypto.ts
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

function buildKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

export async function encryptRefreshToken(value: string, secret: string): Promise<string> {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', buildKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((part) => part.toString('base64url')).join('.');
}

export async function decryptRefreshToken(payload: string, secret: string): Promise<string> {
  const [ivRaw, tagRaw, encryptedRaw] = payload.split('.');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    buildKey(secret),
    Buffer.from(ivRaw, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedRaw, 'base64url')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}
```

- [ ] **Step 4: Add a KV-backed session store abstraction**

```ts
// src/lib/server/zenmoney/session-store.ts
import { kv } from '@vercel/kv';
import { SESSION_IDLE_TTL_SECONDS, SESSION_ABSOLUTE_TTL_MS } from './cookies';
import type { ZenMoneySessionRecord } from './types';

function sessionKey(sessionId: string): string {
  return `zenmoney:session:${sessionId}`;
}

export async function saveSession(record: ZenMoneySessionRecord): Promise<void> {
  await kv.set(sessionKey(record.sessionId), record, { ex: SESSION_IDLE_TTL_SECONDS });
}

export async function getSession(sessionId: string): Promise<ZenMoneySessionRecord | null> {
  return (await kv.get<ZenMoneySessionRecord>(sessionKey(sessionId))) ?? null;
}

export async function deleteSession(sessionId: string): Promise<void> {
  await kv.del(sessionKey(sessionId));
}

export function buildNewSession(input: {
  sessionId: string;
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: number;
  now?: number;
}): ZenMoneySessionRecord {
  const now = input.now ?? Date.now();
  return {
    sessionId: input.sessionId,
    refreshToken: input.refreshToken,
    accessToken: input.accessToken,
    accessTokenExpiresAt: input.accessTokenExpiresAt,
    createdAt: now,
    updatedAt: now,
    absoluteExpiresAt: now + SESSION_ABSOLUTE_TTL_MS,
  };
}
```

- [ ] **Step 5: Run the helper tests to verify they pass**

Run: `pnpm test -- --run src/lib/server/zenmoney/oauth.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/server/zenmoney/config.ts src/lib/server/zenmoney/types.ts src/lib/server/zenmoney/cookies.ts src/lib/server/zenmoney/crypto.ts src/lib/server/zenmoney/session-store.ts src/lib/server/zenmoney/oauth.ts src/lib/server/zenmoney/oauth.test.ts
git commit -m "feat: add ZenMoney server OAuth primitives"
```

### Task 3: Implement OAuth Broker Routes

**Files:**
- Create: `src/routes/api/zenmoney/oauth/start/+server.ts`
- Create: `src/routes/api/zenmoney/oauth/callback/+server.ts`
- Create: `src/routes/api/zenmoney/access-token/+server.ts`
- Create: `src/routes/api/zenmoney/logout/+server.ts`
- Create: `src/routes/api/zenmoney/oauth/routes.test.ts`

- [ ] **Step 1: Write failing route tests**

```ts
// src/routes/api/zenmoney/oauth/routes.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET as start } from './start/+server';
import { GET as callback } from './callback/+server';
import { GET as accessToken } from '../access-token/+server';
import { POST as logout } from '../logout/+server';

describe('ZenMoney OAuth routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects to ZenMoney authorize URL and sets state cookie', async () => {
    const cookies = fakeCookies();
    const response = await start({ cookies, url: new URL('https://app.example.com/api/zenmoney/oauth/start') } as never);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('https://api.zenmoney.ru/oauth2/authorize/');
    expect(cookies.set).toHaveBeenCalledWith(
      'zm_oauth_state',
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('rejects callback with invalid state', async () => {
    const cookies = fakeCookies({ zm_oauth_state: 'expected' });
    const response = await callback({
      cookies,
      fetch: vi.fn(),
      url: new URL('https://app.example.com/api/zenmoney/oauth/callback?code=abc&state=wrong'),
    } as never);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('/settings?zenmoneyAuthError=state');
  });

  it('returns an access token JSON payload from the broker session', async () => {
    const cookies = fakeCookies({ zm_session: 'session-1' });
    const response = await accessToken({ cookies, fetch: vi.fn() } as never);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ accessToken: expect.any(String), expiresAt: expect.any(Number) }),
    );
  });

  it('clears the session on logout', async () => {
    const cookies = fakeCookies({ zm_session: 'session-1' });
    const response = await logout({ cookies } as never);
    expect(response.status).toBe(200);
    expect(cookies.delete).toHaveBeenCalledWith('zm_session', expect.any(Object));
  });
});
```

- [ ] **Step 2: Run the route tests to verify they fail**

Run: `pnpm test -- --run src/routes/api/zenmoney/oauth/routes.test.ts`

Expected: FAIL because the route files do not exist yet.

- [ ] **Step 3: Implement OAuth start and callback routes**

```ts
// src/routes/api/zenmoney/oauth/start/+server.ts
import { redirect } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { buildAuthorizeUrl } from '$lib/server/zenmoney/oauth';
import { getZenMoneyServerConfig } from '$lib/server/zenmoney/config';
import { OAUTH_STATE_TTL_SECONDS, STATE_COOKIE } from '$lib/server/zenmoney/cookies';

export const GET = async ({ cookies }) => {
  const state = randomUUID();
  const config = getZenMoneyServerConfig();

  cookies.set(STATE_COOKIE, state, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: OAUTH_STATE_TTL_SECONDS,
  });

  throw redirect(302, buildAuthorizeUrl({
    clientId: config.clientId,
    redirectUri: config.redirectUri,
    state,
  }));
};
```

```ts
// src/routes/api/zenmoney/oauth/callback/+server.ts
import { redirect } from '@sveltejs/kit';
import { randomUUID } from 'node:crypto';
import { getZenMoneyServerConfig } from '$lib/server/zenmoney/config';
import { STATE_COOKIE, SESSION_COOKIE, SESSION_IDLE_TTL_SECONDS } from '$lib/server/zenmoney/cookies';
import { buildTokenExchangeBody, TOKEN_URL } from '$lib/server/zenmoney/oauth';
import { buildNewSession, saveSession } from '$lib/server/zenmoney/session-store';
import { encryptRefreshToken } from '$lib/server/zenmoney/crypto';

export const GET = async ({ cookies, fetch, url }) => {
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const expectedState = cookies.get(STATE_COOKIE);
  cookies.delete(STATE_COOKIE, { path: '/' });

  if (!state || !code || state !== expectedState) {
    throw redirect(302, '/settings?zenmoneyAuthError=state');
  }

  const config = getZenMoneyServerConfig();
  const tokenResponse = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: buildTokenExchangeBody({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      code,
    }),
  });

  if (!tokenResponse.ok) {
    throw redirect(302, '/settings?zenmoneyAuthError=exchange');
  }

  const tokenData = await tokenResponse.json();
  const sessionId = randomUUID();
  const expiresAt = Date.now() + tokenData.expires_in * 1000;
  await saveSession(buildNewSession({
    sessionId,
    refreshToken: await encryptRefreshToken(tokenData.refresh_token, config.tokenEncryptionKey),
    accessToken: tokenData.access_token,
    accessTokenExpiresAt: expiresAt,
  }));

  cookies.set(SESSION_COOKIE, sessionId, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: SESSION_IDLE_TTL_SECONDS,
  });

  throw redirect(302, '/oauth/callback');
};
```

- [ ] **Step 4: Implement access-token and logout routes**

```ts
// src/routes/api/zenmoney/access-token/+server.ts
import { json } from '@sveltejs/kit';
import { getZenMoneyServerConfig } from '$lib/server/zenmoney/config';
import { SESSION_COOKIE, SESSION_IDLE_TTL_SECONDS } from '$lib/server/zenmoney/cookies';
import { decryptRefreshToken } from '$lib/server/zenmoney/crypto';
import { buildRefreshBody, isAccessTokenStale, TOKEN_URL } from '$lib/server/zenmoney/oauth';
import { deleteSession, getSession, saveSession } from '$lib/server/zenmoney/session-store';

export const GET = async ({ cookies, fetch }) => {
  const sessionId = cookies.get(SESSION_COOKIE);
  if (!sessionId) return json({ message: 'Not connected' }, { status: 401 });

  const config = getZenMoneyServerConfig();
  const session = await getSession(sessionId);
  if (!session || session.absoluteExpiresAt <= Date.now()) {
    if (sessionId) cookies.delete(SESSION_COOKIE, { path: '/' });
    return json({ message: 'Session expired' }, { status: 401 });
  }

  if (isAccessTokenStale(session.accessTokenExpiresAt)) {
    const refreshToken = await decryptRefreshToken(session.refreshToken, config.tokenEncryptionKey);
    const refreshResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: buildRefreshBody({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        refreshToken,
      }),
    });

    if (!refreshResponse.ok) {
      await deleteSession(sessionId);
      cookies.delete(SESSION_COOKIE, { path: '/' });
      return json({ message: 'Refresh failed' }, { status: 401 });
    }

    const tokenData = await refreshResponse.json();
    session.accessToken = tokenData.access_token;
    session.accessTokenExpiresAt = Date.now() + tokenData.expires_in * 1000;
    session.updatedAt = Date.now();
    await saveSession(session);
  }

  cookies.set(SESSION_COOKIE, sessionId, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: SESSION_IDLE_TTL_SECONDS,
  });

  return json({
    accessToken: session.accessToken,
    expiresAt: session.accessTokenExpiresAt,
  });
};
```

```ts
// src/routes/api/zenmoney/logout/+server.ts
import { json } from '@sveltejs/kit';
import { SESSION_COOKIE } from '$lib/server/zenmoney/cookies';
import { deleteSession } from '$lib/server/zenmoney/session-store';

export const POST = async ({ cookies }) => {
  const sessionId = cookies.get(SESSION_COOKIE);
  if (sessionId) await deleteSession(sessionId);
  cookies.delete(SESSION_COOKIE, { path: '/' });
  return json({ ok: true });
};
```

- [ ] **Step 5: Run the route tests to verify they pass**

Run: `pnpm test -- --run src/routes/api/zenmoney/oauth/routes.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/routes/api/zenmoney/oauth/start/+server.ts src/routes/api/zenmoney/oauth/callback/+server.ts src/routes/api/zenmoney/access-token/+server.ts src/routes/api/zenmoney/logout/+server.ts src/routes/api/zenmoney/oauth/routes.test.ts
git commit -m "feat: add ZenMoney OAuth broker routes"
```

### Task 4: Persist Auth Mode And Add OAuth Access-Token Helper

**Files:**
- Create: `src/lib/services/zenmoney-access.ts`
- Create: `src/lib/services/zenmoney-access.test.ts`
- Modify: `src/lib/types/index.ts`
- Modify: `src/lib/db/settings.ts`
- Modify: `src/lib/db/settings.test.ts`

- [ ] **Step 1: Write failing settings and helper tests**

```ts
// src/lib/services/zenmoney-access.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSettings, saveSettings } from '$lib/db/settings';
import {
  getConfiguredZenMoneyToken,
  getZenMoneyAccessToken,
  clearZenMoneyAccessToken,
} from './zenmoney-access';

beforeEach(async () => {
  vi.restoreAllMocks();
});

describe('getZenMoneyAccessToken', () => {
  it('reuses a stored token when it is not close to expiry', async () => {
    await saveSettings({
      zenmoneyAccessToken: 'stored-token',
      zenmoneyAccessTokenExpiresAt: Date.now() + 60 * 60_000,
    });

    expect(await getZenMoneyAccessToken()).toBe('stored-token');
  });

  it('refreshes through the broker when the token is expired', async () => {
    await saveSettings({
      zenmoneyAccessToken: 'expired-token',
      zenmoneyAccessTokenExpiresAt: Date.now() - 1000,
    });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      accessToken: 'fresh-token',
      expiresAt: Date.now() + 60 * 60_000,
    }), { status: 200 })));

    expect(await getZenMoneyAccessToken()).toBe('fresh-token');
    expect((await getSettings()).zenmoneyAccessToken).toBe('fresh-token');
  });

  it('clears local token state', async () => {
    await saveSettings({
      zenmoneyAccessToken: 'token',
      zenmoneyAccessTokenExpiresAt: Date.now() + 1000,
    });
    await clearZenMoneyAccessToken();
    const settings = await getSettings();
    expect(settings.zenmoneyAccessToken).toBe('');
    expect(settings.zenmoneyAccessTokenExpiresAt).toBe(0);
  });

  it('returns the saved manual token when manual mode is active', async () => {
    await saveSettings({
      zenmoneyAuthMode: 'manual',
      zenmoneyToken: 'manual-token',
    });

    await expect(getConfiguredZenMoneyToken()).resolves.toBe('manual-token');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test -- --run src/lib/db/settings.test.ts src/lib/services/zenmoney-access.test.ts`

Expected: FAIL because `zenmoneyAuthMode`, `zenmoneyAccessToken`, `zenmoneyAccessTokenExpiresAt`, and the client helper do not exist yet.

- [ ] **Step 3: Extend the settings model to support both manual and OAuth auth modes**

```ts
// src/lib/types/index.ts (Settings excerpt)
export interface Settings {
  claudeApiKey: string;
  zenmoneyAuthMode: 'manual' | 'oauth';
  zenmoneyToken: string;
  zenmoneyAccessToken: string;
  zenmoneyAccessTokenExpiresAt: number;
  zenmoneyServerTimestamp: number;
  zenmoneyAccountId: string;
  zenmoneyUserId: number;
  aiProvider: 'anthropic' | 'openrouter';
  openrouterApiKey: string;
  openrouterModel: string;
}
```

```ts
// src/lib/db/settings.ts (relevant excerpt)
const [apiKeyRaw, manualTokenRaw, authMode, accessTokenRaw, accessTokenExpiresAt, ts, accountId, userId, orKeyRaw, aiProvider, orModel] =
  await Promise.all([
    db.get('settings', 'claudeApiKey'),
    db.get('settings', 'zenmoneyToken'),
    db.get('settings', 'zenmoneyAuthMode'),
    db.get('settings', 'zenmoneyAccessToken'),
    db.get('settings', 'zenmoneyAccessTokenExpiresAt'),
    db.get('settings', 'zenmoneyServerTimestamp'),
    db.get('settings', 'zenmoneyAccountId'),
    db.get('settings', 'zenmoneyUserId'),
    db.get('settings', 'openrouterApiKey'),
    db.get('settings', 'aiProvider'),
    db.get('settings', 'openrouterModel'),
  ]);

return {
  claudeApiKey: apiKeyRaw ? await decrypt(apiKeyRaw as string) : '',
  zenmoneyAuthMode: (authMode as 'manual' | 'oauth') ?? 'manual',
  zenmoneyToken: manualTokenRaw ? await decrypt(manualTokenRaw as string) : '',
  zenmoneyAccessToken: accessTokenRaw ? await decrypt(accessTokenRaw as string) : '',
  zenmoneyAccessTokenExpiresAt: (accessTokenExpiresAt as number) ?? 0,
  zenmoneyServerTimestamp: (ts as number) ?? 0,
  zenmoneyAccountId: (accountId as string) ?? '',
  zenmoneyUserId: (userId as number) ?? 0,
  aiProvider: (aiProvider as 'anthropic' | 'openrouter') ?? 'anthropic',
  openrouterApiKey: orKeyRaw ? await decrypt(orKeyRaw as string) : '',
  openrouterModel: (orModel as string) ?? 'anthropic/claude-sonnet-4.6',
};
```

- [ ] **Step 4: Implement auth-mode-aware token helpers**

```ts
// src/lib/services/zenmoney-access.ts
import { getSettings, saveSettings } from '$lib/db/settings';

const REFRESH_WINDOW_MS = 5 * 60_000;

function tokenNeedsRefresh(expiresAt: number, now = Date.now()): boolean {
  return !expiresAt || expiresAt - now <= REFRESH_WINDOW_MS;
}

export async function clearZenMoneyAccessToken(): Promise<void> {
  await saveSettings({
    zenmoneyAccessToken: '',
    zenmoneyAccessTokenExpiresAt: 0,
  });
}

export async function getZenMoneyAccessToken(forceRefresh = false): Promise<string> {
  const settings = await getSettings();
  if (settings.zenmoneyAuthMode !== 'oauth') {
    throw new Error('ZenMoney OAuth mode is not active.');
  }
  if (
    !forceRefresh &&
    settings.zenmoneyAccessToken &&
    !tokenNeedsRefresh(settings.zenmoneyAccessTokenExpiresAt)
  ) {
    return settings.zenmoneyAccessToken;
  }

  const response = await fetch('/api/zenmoney/access-token', {
    credentials: 'include',
  });
  if (!response.ok) {
    await clearZenMoneyAccessToken();
    throw new Error('ZenMoney connection expired. Reconnect in Settings.');
  }

  const data = (await response.json()) as { accessToken: string; expiresAt: number };
  await saveSettings({
    zenmoneyAccessToken: data.accessToken,
    zenmoneyAccessTokenExpiresAt: data.expiresAt,
  });
  return data.accessToken;
}

export async function getConfiguredZenMoneyToken(forceRefresh = false): Promise<string> {
  const settings = await getSettings();
  if (settings.zenmoneyAuthMode === 'manual') {
    if (!settings.zenmoneyToken) throw new Error('ZenMoney token not set');
    return settings.zenmoneyToken;
  }

  return getZenMoneyAccessToken(forceRefresh);
}

export async function getZenMoneyAuthMode(): Promise<'manual' | 'oauth'> {
  return (await getSettings()).zenmoneyAuthMode;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm test -- --run src/lib/db/settings.test.ts src/lib/services/zenmoney-access.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/types/index.ts src/lib/db/settings.ts src/lib/db/settings.test.ts src/lib/services/zenmoney-access.ts src/lib/services/zenmoney-access.test.ts
git commit -m "feat: support ZenMoney auth modes in local settings"
```

### Task 5: Migrate Settings, Callback, And App Gating To Dual-Mode Auth

**Files:**
- Modify: `src/routes/settings/+page.svelte`
- Modify: `src/routes/oauth/callback/+page.svelte`
- Modify: `src/routes/+layout.svelte`
- Modify: `src/routes/settings/version.test.ts`

- [ ] **Step 1: Write failing UI wiring tests**

```ts
// src/routes/settings/version.test.ts (append cases)
it('links ZenMoney connect flow to the broker start endpoint', () => {
  const settingsPage = readFileSync(
    resolve(process.cwd(), 'src/routes/settings/+page.svelte'),
    'utf8',
  );

  expect(settingsPage).toContain("/api/zenmoney/oauth/start");
  expect(settingsPage).toContain("/api/zenmoney/logout");
});

it('keeps the manual ZenMoney token input available', () => {
  const settingsPage = readFileSync(
    resolve(process.cwd(), 'src/routes/settings/+page.svelte'),
    'utf8',
  );

  expect(settingsPage).toContain('placeholder="Paste your ZenMoney token"');
  expect(settingsPage).toContain('zenmoneyAuthMode');
  expect(settingsPage).toContain('PUBLIC_ZENMONEY_OAUTH_ENABLED');
});
```

- [ ] **Step 2: Run the UI wiring tests to verify they fail**

Run: `pnpm test -- --run src/routes/settings/version.test.ts`

Expected: FAIL because Settings does not yet contain explicit auth-mode handling or conditional broker endpoint wiring.

- [ ] **Step 3: Replace browser OAuth exchange with dual-mode auth wiring**

```ts
// src/routes/oauth/callback/+page.svelte (script excerpt)
import { onMount } from 'svelte';
import { goto } from '$app/navigation';
import { getZenMoneyAccessToken } from '$lib/services/zenmoney-access';

let status = $state<'loading' | 'error'>('loading');
let errorMessage = $state('');

onMount(async () => {
  try {
    await getZenMoneyAccessToken(true);
    goto('/settings?zenmoneyConnected=1');
  } catch (error) {
    status = 'error';
    errorMessage = error instanceof Error ? error.message : 'Authentication failed.';
  }
});
```

```ts
// src/routes/settings/+page.svelte (script excerpts)
import { getZenMoneyAccessToken, clearZenMoneyAccessToken } from '$lib/services/zenmoney-access';

let zenmoneyAuthMode = $state<'manual' | 'oauth'>('manual');
let zenmoneyConnected = $state(false);
let zenmoneyToken = $state('');
let zenmoneyAccessTokenSaved = $derived(savedZenmoneyAccessToken.length > 0);

onMount(async () => {
  const s = await getSettings();
  zenmoneyAuthMode = s.zenmoneyAuthMode;
  zenmoneyToken = s.zenmoneyToken;
  zenmoneyConnected =
    s.zenmoneyAuthMode === 'manual'
      ? Boolean(s.zenmoneyToken)
      : Boolean(s.zenmoneyAccessToken);
});

function startOAuthFlow() {
  window.location.href = '/api/zenmoney/oauth/start';
}

async function disconnectZenMoney() {
  await fetch('/api/zenmoney/logout', { method: 'POST', credentials: 'include' });
  await clearZenMoneyAccessToken();
  zenmoneyConnected = false;
}

async function handleReloadCategories() {
  const token =
    zenmoneyAuthMode === 'manual' ? zenmoneyToken : await getZenMoneyAccessToken();
  const response = await syncDiff(token, 0);
  // existing category save logic
}
```

```ts
// src/routes/+layout.svelte (onMount excerpt)
onMount(async () => {
  const settings = await getSettings();
  if (!settings.claudeApiKey && !$page.url.pathname.startsWith('/settings')) {
    goto('/settings');
  }
});
```

- [ ] **Step 4: Update the Settings markup so manual token is always available and OAuth is conditional**

```svelte
<!-- src/routes/settings/+page.svelte (ZenMoney section excerpt) -->
<label for="zm-token">ZenMoney token</label>
<input
  id="zm-token"
  type="password"
  bind:value={zenmoneyToken}
  placeholder="Paste your ZenMoney token"
  autocomplete="off"
/>

<select bind:value={zenmoneyAuthMode}>
  <option value="manual">Manual token</option>
  <option value="oauth">OAuth</option>
</select>

{#if PUBLIC_ZENMONEY_OAUTH_ENABLED}
  {#if zenmoneyAuthMode === 'oauth' && zenmoneyConnected}
    <div class="connected-row">
      <span class="connected-badge">✓ Connected</span>
      <button type="button" class="btn-disconnect" onclick={disconnectZenMoney}>
        Disconnect
      </button>
    </div>
  {:else}
    <button type="button" class="btn-oauth" onclick={startOAuthFlow}>
      Connect with ZenMoney
    </button>
  {/if}
{/if}
```

- [ ] **Step 5: Run the wiring tests to verify they pass**

Run: `pnpm test -- --run src/routes/settings/version.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/routes/settings/+page.svelte src/routes/oauth/callback/+page.svelte src/routes/+layout.svelte src/routes/settings/version.test.ts
git commit -m "feat: add dual-mode ZenMoney auth settings"
```

### Task 6: Add One-Retry ZenMoney Calls And Migrate Review/History Flows

**Files:**
- Create: `src/lib/services/zenmoney-client.ts`
- Create: `src/lib/services/zenmoney-client.test.ts`
- Modify: `src/lib/services/zenmoney.ts`
- Modify: `src/lib/services/zenmoney.test.ts`
- Modify: `src/routes/review/+page.svelte`
- Modify: `src/routes/history/+page.svelte`
- Modify: `src/routes/settings/+page.svelte`

- [ ] **Step 1: Write failing retry tests**

```ts
// src/lib/services/zenmoney-client.test.ts
import { describe, expect, it, vi } from 'vitest';
import { runZenMoneyRequest } from './zenmoney-client';

describe('runZenMoneyRequest', () => {
  it('retries once with a fresh token after a 401', async () => {
    const tokenProvider = vi
      .fn()
      .mockResolvedValueOnce('stale-token')
      .mockResolvedValueOnce('fresh-token');
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('ZenMoney API error: 401 Unauthorized'))
      .mockResolvedValueOnce({ ok: true });

    await expect(runZenMoneyRequest(tokenProvider, request)).resolves.toEqual({ ok: true });
    expect(tokenProvider).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not loop forever on repeated 401 errors', async () => {
    const tokenProvider = vi.fn().mockResolvedValue('token');
    const request = vi.fn().mockRejectedValue(new Error('ZenMoney API error: 401 Unauthorized'));

    await expect(runZenMoneyRequest(tokenProvider, request)).rejects.toThrow('401');
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not force-refresh manual-token mode', async () => {
    const tokenProvider = vi.fn().mockResolvedValue('manual-token');
    const authModeProvider = vi.fn().mockResolvedValue('manual');
    const request = vi.fn().mockRejectedValue(new Error('ZenMoney API error: 401 Unauthorized'));

    await expect(runZenMoneyRequest(tokenProvider, authModeProvider, request)).rejects.toThrow('401');
    expect(tokenProvider).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the retry tests to verify they fail**

Run: `pnpm test -- --run src/lib/services/zenmoney-client.test.ts src/lib/services/zenmoney.test.ts`

Expected: FAIL because the retry wrapper does not exist yet and current callers still require `settings.zenmoneyToken`.

- [ ] **Step 3: Implement a central retry wrapper for direct ZenMoney requests**

```ts
// src/lib/services/zenmoney-client.ts
import { getConfiguredZenMoneyToken, getZenMoneyAuthMode } from './zenmoney-access';

function isUnauthorized(error: unknown): boolean {
  return error instanceof Error && error.message.includes('401');
}

export async function runZenMoneyRequest<T>(
  tokenProvider: (forceRefresh?: boolean) => Promise<string>,
  authModeProvider: () => Promise<'manual' | 'oauth'>,
  request: (token: string) => Promise<T>,
): Promise<T> {
  try {
    return await request(await tokenProvider(false));
  } catch (error) {
    if (!isUnauthorized(error)) throw error;
  }

  if ((await authModeProvider()) !== 'oauth') {
    throw new Error('ZenMoney API error: 401 Unauthorized');
  }

  return request(await tokenProvider(true));
}

export async function runZenMoneyRequestWithStoredToken<T>(
  request: (token: string) => Promise<T>,
): Promise<T> {
  return runZenMoneyRequest(getConfiguredZenMoneyToken, getZenMoneyAuthMode, request);
}
```

- [ ] **Step 4: Migrate all ZenMoney callers to broker-backed access tokens**

```ts
// src/routes/settings/+page.svelte (reload excerpt)
import { runZenMoneyRequestWithStoredToken } from '$lib/services/zenmoney-client';

const response = await runZenMoneyRequestWithStoredToken((token) => syncDiff(token, 0));
```

```ts
// src/routes/review/+page.svelte (submit excerpt)
import { runZenMoneyRequestWithStoredToken } from '$lib/services/zenmoney-client';

const diffResponse = await runZenMoneyRequestWithStoredToken((token) =>
  syncDiff(token, settings.zenmoneyServerTimestamp, [payload]),
);
```

```ts
// src/routes/history/+page.svelte (retry excerpt)
import { runZenMoneyRequestWithStoredToken } from '$lib/services/zenmoney-client';

const diffResponse = await runZenMoneyRequestWithStoredToken((token) =>
  syncDiff(token, settings.zenmoneyServerTimestamp, [payload]),
);
```

- [ ] **Step 5: Run the ZenMoney service and retry tests to verify they pass**

Run: `pnpm test -- --run src/lib/services/zenmoney-client.test.ts src/lib/services/zenmoney.test.ts src/lib/db/settings.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/zenmoney-client.ts src/lib/services/zenmoney-client.test.ts src/lib/services/zenmoney.ts src/lib/services/zenmoney.test.ts src/routes/settings/+page.svelte src/routes/review/+page.svelte src/routes/history/+page.svelte
git commit -m "feat: refresh and retry direct ZenMoney API calls"
```

### Task 7: Update Documentation And Run Full Verification

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Modify: `docs/superpowers/specs/2026-05-08-zenmoney-oauth-broker-design.md`

- [ ] **Step 1: Update the README for Vercel OAuth broker setup**

```md
## ZenMoney connection

ZenMoney OAuth now uses a small Vercel-hosted auth broker.

- The server stores the ZenMoney `client_secret` and refresh token.
- The app supports two ZenMoney auth modes:
  - manual personal token
  - OAuth with a short-lived locally stored access token
- Vercel KV is required for ZenMoney session storage.

Required Vercel environment variables:

- `ZENMONEY_CLIENT_ID`
- `ZENMONEY_CLIENT_SECRET`
- `ZENMONEY_REDIRECT_URI`
- `ZENMONEY_SESSION_SECRET`
- `ZENMONEY_TOKEN_ENCRYPTION_KEY`
- Vercel KV binding variables
```

- [ ] **Step 2: Run the full verification suite**

Run: `pnpm test`

Expected: PASS all Vitest suites.

Run: `pnpm check`

Expected: PASS with no type errors.

Run: `pnpm build`

Expected: PASS and emit a Vercel-compatible SvelteKit build output.

- [ ] **Step 3: Commit**

```bash
git add README.md .env.example docs/superpowers/specs/2026-05-08-zenmoney-oauth-broker-design.md
git commit -m "docs: document ZenMoney OAuth broker deployment"
```

- [ ] **Step 4: Manual Vercel verification**

Run on a preview deployment after setting all env vars and Vercel KV:

```text
1. Open /settings and tap "Connect with ZenMoney".
2. Complete ZenMoney OAuth and confirm the app returns to /settings.
3. Tap "Reload Categories" and confirm categories, accounts, and user id save locally.
4. Capture and submit a receipt from /review.
5. Retry a failed transaction from /history.
6. Tap "Disconnect" and confirm the next ZenMoney action requires reconnect.
7. Simulate expiry by lowering zenmoneyAccessTokenExpiresAt in IndexedDB and verify silent refresh.
```
