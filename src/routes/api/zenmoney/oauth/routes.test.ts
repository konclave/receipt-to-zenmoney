import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockConfig = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'https://app.example.com/api/zenmoney/oauth/callback',
  tokenEncryptionKey: 'token-secret',
  oauthEnabled: true,
};

vi.mock('$lib/server/zenmoney/config', () => ({
  getZenMoneyServerConfig: () => mockConfig,
}));

vi.mock('$lib/server/zenmoney/session-store', () => ({
  saveSession: vi.fn(),
  getSession: vi.fn(),
  deleteSession: vi.fn(),
  buildNewSession: vi.fn((input) => ({
    sessionId: input.sessionId,
    refreshToken: input.refreshToken,
    accessToken: input.accessToken,
    accessTokenExpiresAt: input.accessTokenExpiresAt,
    createdAt: 1,
    updatedAt: 1,
    absoluteExpiresAt: Date.now() + 60_000,
  })),
}));

vi.mock('$lib/server/zenmoney/crypto', () => ({
  encryptRefreshToken: vi.fn(async (value: string) => `encrypted:${value}`),
  decryptRefreshToken: vi.fn(async (value: string) => value.replace(/^encrypted:/, '')),
}));

import { GET as start } from './start/+server';
import { GET as callback } from './callback/+server';
import { GET as accessToken } from '../access-token/+server';
import { POST as logout } from '../logout/+server';
import {
  getSession,
  saveSession,
  deleteSession,
  buildNewSession,
} from '$lib/server/zenmoney/session-store';

function fakeCookies(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial));
  return {
    get: vi.fn((key: string) => store.get(key)),
    set: vi.fn((key: string, value: string) => {
      store.set(key, value);
    }),
    delete: vi.fn((key: string) => {
      store.delete(key);
    }),
  };
}

describe('ZenMoney OAuth routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockConfig.oauthEnabled = true;
    vi.mocked(getSession).mockReset();
    vi.mocked(saveSession).mockReset();
    vi.mocked(deleteSession).mockReset();
    vi.mocked(buildNewSession).mockClear();
  });

  it('redirects to ZenMoney authorize URL and sets state cookie', async () => {
    const cookies = fakeCookies();
    const response = await start({
      cookies,
      url: new URL('https://app.example.com/api/zenmoney/oauth/start'),
    } as never);

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toContain('https://api.zenmoney.ru/oauth2/authorize/');
    expect(cookies.set).toHaveBeenCalledWith(
      'zm_oauth_state',
      expect.any(String),
      expect.objectContaining({ httpOnly: true }),
    );
  });

  it('rejects OAuth start when the feature flag is disabled', async () => {
    mockConfig.oauthEnabled = false;

    const response = await start({
      cookies: fakeCookies(),
      url: new URL('https://app.example.com/api/zenmoney/oauth/start'),
    } as never);

    expect(response.status).toBe(404);
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
    vi.mocked(getSession).mockResolvedValue({
      sessionId: 'session-1',
      refreshToken: 'encrypted:refresh',
      accessToken: 'cached-token',
      accessTokenExpiresAt: Date.now() + 10 * 60_000,
      createdAt: 1,
      updatedAt: 1,
      absoluteExpiresAt: Date.now() + 60_000,
    });

    const response = await accessToken({
      cookies,
      fetch: vi.fn(),
    } as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({ accessToken: 'cached-token', expiresAt: expect.any(Number) }),
    );
  });

  it('refreshes stale broker tokens and persists rotated refresh tokens', async () => {
    const cookies = fakeCookies({ zm_session: 'session-1' });
    vi.mocked(getSession).mockResolvedValue({
      sessionId: 'session-1',
      refreshToken: 'encrypted:refresh',
      accessToken: 'stale-token',
      accessTokenExpiresAt: Date.now() - 1,
      createdAt: 1,
      updatedAt: 1,
      absoluteExpiresAt: Date.now() + 60_000,
    });

    const response = await accessToken({
      cookies,
      fetch: vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            access_token: 'fresh-token',
            refresh_token: 'rotated-refresh',
            expires_in: 3600,
          }),
          { status: 200 },
        ),
      ),
    } as never);

    expect(response.status).toBe(200);
    expect(saveSession).toHaveBeenCalledWith(
      expect.objectContaining({
        accessToken: 'fresh-token',
        refreshToken: 'encrypted:rotated-refresh',
      }),
    );
  });

  it('clears the session on logout', async () => {
    const cookies = fakeCookies({ zm_session: 'session-1' });
    const response = await logout({ cookies } as never);
    expect(response.status).toBe(200);
    expect(cookies.delete).toHaveBeenCalledWith('zm_session', expect.any(Object));
    expect(deleteSession).toHaveBeenCalledWith('session-1');
  });
});
