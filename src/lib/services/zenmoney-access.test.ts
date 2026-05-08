import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSettings, saveSettings } from '$lib/db/settings';
import {
  getConfiguredZenMoneyToken,
  getZenMoneyAccessToken,
  clearZenMoneyAccessToken,
  getZenMoneyAuthMode,
} from './zenmoney-access';

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.stubEnv('PUBLIC_ZENMONEY_OAUTH_ENABLED', 'true');
  await clearZenMoneyAccessToken();
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
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            accessToken: 'fresh-token',
            expiresAt: Date.now() + 60 * 60_000,
          }),
          { status: 200 },
        ),
      ),
    );

    expect(await getZenMoneyAccessToken()).toBe('fresh-token');
    expect((await getSettings()).zenmoneyAccessToken).toBe('fresh-token');
  });

  it('throws when OAuth is disabled', async () => {
    vi.stubEnv('PUBLIC_ZENMONEY_OAUTH_ENABLED', 'false');
    await expect(getZenMoneyAccessToken()).rejects.toThrow('OAuth not enabled');
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
});

describe('getConfiguredZenMoneyToken', () => {
  it('returns the saved manual token when OAuth is disabled', async () => {
    vi.stubEnv('PUBLIC_ZENMONEY_OAUTH_ENABLED', 'false');
    await saveSettings({ zenmoneyToken: 'manual-token' });
    await expect(getConfiguredZenMoneyToken()).resolves.toBe('manual-token');
  });

  it('returns the manual token when OAuth is enabled but no session exists', async () => {
    await saveSettings({ zenmoneyToken: 'manual-token' });
    await expect(getConfiguredZenMoneyToken()).resolves.toBe('manual-token');
  });

  it('returns OAuth token when session is active', async () => {
    await saveSettings({
      zenmoneyAccessToken: 'oauth-token',
      zenmoneyAccessTokenExpiresAt: Date.now() + 60 * 60_000,
    });
    await expect(getConfiguredZenMoneyToken()).resolves.toBe('oauth-token');
  });

  it('falls back to manual token when broker returns 401', async () => {
    await saveSettings({
      zenmoneyAccessToken: 'stale-token',
      zenmoneyAccessTokenExpiresAt: Date.now() - 1000,
      zenmoneyToken: 'manual-token',
    });
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );
    await expect(getConfiguredZenMoneyToken()).resolves.toBe('manual-token');
  });
});

describe('getZenMoneyAuthMode', () => {
  it('returns manual when OAuth is disabled', async () => {
    vi.stubEnv('PUBLIC_ZENMONEY_OAUTH_ENABLED', 'false');
    expect(await getZenMoneyAuthMode()).toBe('manual');
  });

  it('returns oauth when OAuth is enabled and a session token exists', async () => {
    await saveSettings({ zenmoneyAccessToken: 'some-token', zenmoneyAccessTokenExpiresAt: 1 });
    expect(await getZenMoneyAuthMode()).toBe('oauth');
  });

  it('returns manual when OAuth is enabled but no session exists', async () => {
    expect(await getZenMoneyAuthMode()).toBe('manual');
  });
});
