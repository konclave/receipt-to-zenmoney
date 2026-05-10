import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createZenMoneyConnectionStore } from './zenmoney-connection.store.svelte';

describe('createZenMoneyConnectionStore', () => {
  const repo = {
    saveManualZenMoneyToken: vi.fn(),
    disconnectZenMoney: vi.fn(),
  };

  beforeEach(() => {
    vi.unstubAllGlobals();
    repo.saveManualZenMoneyToken.mockReset();
    repo.disconnectZenMoney.mockReset();
    window.history.replaceState({}, '', 'http://localhost/');
  });

  it('is connected when a saved manual token exists or a saved access token exists', () => {
    const withManualToken = createZenMoneyConnectionStore(
      {
        zenmoneyToken: 'manual-token',
        zenmoneyAccessToken: '',
      },
      repo,
    );
    const withAccessToken = createZenMoneyConnectionStore(
      {
        zenmoneyToken: '',
        zenmoneyAccessToken: 'access-token',
      },
      repo,
    );

    expect(withManualToken.connected).toBe(true);
    expect(withAccessToken.connected).toBe(true);
  });

  it('saves a pasted manual token, reports success, and becomes connected', async () => {
    const store = createZenMoneyConnectionStore(
      {
        zenmoneyToken: '',
        zenmoneyAccessToken: '',
      },
      repo,
    );

    store.manualToken = 'manual-token';
    await store.saveManualToken();

    expect(repo.saveManualZenMoneyToken).toHaveBeenCalledWith('manual-token');
    expect(store.success).toBe('Saved');
    expect(store.connected).toBe(true);
  });

  it('starts the OAuth flow by navigating to the ZenMoney start endpoint', () => {
    const stubWindow = { location: { href: 'http://localhost/' } };
    vi.stubGlobal('window', stubWindow);
    const store = createZenMoneyConnectionStore(
      {
        zenmoneyToken: '',
        zenmoneyAccessToken: '',
      },
      repo,
    );

    store.startOAuthFlow();

    expect(stubWindow.location.href).toBe('/api/zenmoney/oauth/start');
  });

  it('captures the manual token being saved so later edits do not rewrite the saved snapshot', async () => {
    let resolveSave!: () => void;
    repo.saveManualZenMoneyToken.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSave = resolve;
      }),
    );

    const store = createZenMoneyConnectionStore(
      {
        zenmoneyToken: '',
        zenmoneyAccessToken: '',
      },
      repo,
    );

    store.manualToken = 'token-before-save';
    const savePromise = store.saveManualToken();
    expect(store.saving).toBe(true);

    store.manualToken = 'token-after-save-started';
    resolveSave();
    await savePromise;

    expect(repo.saveManualZenMoneyToken).toHaveBeenCalledWith('token-before-save');
    expect(store.connected).toBe(true);

    await store.disconnect();

    expect(store.connected).toBe(false);
  });

  it('clears current and saved connection state after disconnect succeeds', async () => {
    const store = createZenMoneyConnectionStore(
      {
        zenmoneyToken: 'manual-token',
        zenmoneyAccessToken: 'access-token',
      },
      repo,
    );

    store.manualToken = 'edited-token';
    await store.disconnect();

    expect(repo.disconnectZenMoney).toHaveBeenCalledTimes(1);
    expect(store.manualToken).toBe('');
    expect(store.connected).toBe(false);
    expect(store.error).toBeNull();
  });

  it('sets error when connection actions fail', async () => {
    repo.saveManualZenMoneyToken.mockRejectedValueOnce(new Error('save failed'));
    repo.disconnectZenMoney.mockRejectedValueOnce(new Error('disconnect failed'));

    const store = createZenMoneyConnectionStore(
      {
        zenmoneyToken: 'manual-token',
        zenmoneyAccessToken: '',
      },
      repo,
    );

    store.manualToken = 'next-token';
    await store.saveManualToken();
    expect(store.error).toBe('save failed');

    await store.disconnect();
    expect(store.error).toBe('disconnect failed');
  });
});
