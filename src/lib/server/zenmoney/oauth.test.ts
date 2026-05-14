import { describe, expect, it } from 'vitest';
import {
  buildAuthorizeUrl,
  buildTokenExchangeBody,
  buildRefreshBody,
  isAccessTokenStale,
} from './oauth';
import { encryptRefreshToken, decryptRefreshToken } from './crypto';

describe('buildAuthorizeUrl', () => {
  it('builds Zenmoney authorize URL from server config', () => {
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
    expect(
      buildTokenExchangeBody({
        clientId: 'cid',
        clientSecret: 'secret',
        redirectUri: 'https://app.example.com/callback',
        code: 'abc',
      }).toString(),
    ).toBe(
      'client_id=cid&client_secret=secret&redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback&code=abc&grant_type=authorization_code',
    );
  });

  it('builds form-encoded refresh body', () => {
    expect(
      buildRefreshBody({
        clientId: 'cid',
        clientSecret: 'secret',
        refreshToken: 'refresh-1',
      }).toString(),
    ).toBe('client_id=cid&client_secret=secret&refresh_token=refresh-1&grant_type=refresh_token');
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
