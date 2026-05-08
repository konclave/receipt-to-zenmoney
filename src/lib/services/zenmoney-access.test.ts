import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getSettings, saveSettings } from '$lib/db/settings';
import {
  getConfiguredZenMoneyToken,
  getZenMoneyAccessToken,
  clearZenMoneyAccessToken,
} from './zenmoney-access';
import { resolveZenMoneyAuthMode } from './zenmoney-auth-mode';

beforeEach(async () => {
  vi.restoreAllMocks();
  vi.stubEnv('PUBLIC_ZENMONEY_OAUTH_ENABLED', 'true');
});

describe('getZenMoneyAccessToken', () => {
  it('forces manual mode when OAuth is disabled by config', () => {
    expect(resolveZenMoneyAuthMode('oauth', false)).toBe('manual');
    expect(resolveZenMoneyAuthMode('manual', false)).toBe('manual');
    expect(resolveZenMoneyAuthMode('oauth', true)).toBe('oauth');
  });

  it('reuses a stored token when it is not close to expiry', async () => {
    await saveSettings({
      zenmoneyAuthMode: 'oauth',
      zenmoneyAccessToken: 'stored-token',
      zenmoneyAccessTokenExpiresAt: Date.now() + 60 * 60_000,
    });

    expect(await getZenMoneyAccessToken()).toBe('stored-token');
  });

  it('refreshes through the broker when the token is expired', async () => {
    await saveSettings({
      zenmoneyAuthMode: 'oauth',
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

  it('clears local token state', async () => {
    await saveSettings({
      zenmoneyAuthMode: 'oauth',
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
