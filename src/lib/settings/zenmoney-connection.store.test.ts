import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createZenMoneyConnectionStore } from './zenmoney-connection.store.svelte';

describe('createZenMoneyConnectionStore', () => {
  const repo = {
    saveManualZenMoneyToken: vi.fn(),
    disconnectZenMoney: vi.fn(),
  };

  beforeEach(() => {
    repo.saveManualZenMoneyToken.mockReset();
    repo.disconnectZenMoney.mockReset();
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
});
