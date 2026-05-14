import { describe, expect, it, vi } from 'vitest';
import { runZenmoneyRequest } from './zenmoney-client';

describe('runZenmoneyRequest', () => {
  it('retries once with a fresh token after a 401', async () => {
    const tokenProvider = vi
      .fn()
      .mockResolvedValueOnce('stale-token')
      .mockResolvedValueOnce('fresh-token');
    const authModeProvider = vi.fn().mockResolvedValue('oauth');
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error('Zenmoney API error: 401 Unauthorized'))
      .mockResolvedValueOnce({ ok: true });

    await expect(runZenmoneyRequest(tokenProvider, authModeProvider, request)).resolves.toEqual({
      ok: true,
    });
    expect(tokenProvider).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not loop forever on repeated 401 errors', async () => {
    const tokenProvider = vi.fn().mockResolvedValue('token');
    const authModeProvider = vi.fn().mockResolvedValue('oauth');
    const request = vi.fn().mockRejectedValue(new Error('Zenmoney API error: 401 Unauthorized'));

    await expect(runZenmoneyRequest(tokenProvider, authModeProvider, request)).rejects.toThrow(
      '401',
    );
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not force-refresh manual-token mode', async () => {
    const tokenProvider = vi.fn().mockResolvedValue('manual-token');
    const authModeProvider = vi.fn().mockResolvedValue('manual');
    const request = vi.fn().mockRejectedValue(new Error('Zenmoney API error: 401 Unauthorized'));

    await expect(runZenmoneyRequest(tokenProvider, authModeProvider, request)).rejects.toThrow(
      '401',
    );
    expect(tokenProvider).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledTimes(1);
  });
});
