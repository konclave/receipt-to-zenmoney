import { describe, expect, it } from 'vitest';
import { assertZenMoneyServerConfig } from './config';

describe('assertZenMoneyServerConfig', () => {
  it('throws a helpful error when required OAuth env vars are missing', () => {
    expect(() =>
      assertZenMoneyServerConfig({
        clientId: 'client-id',
        clientSecret: '',
        redirectUri: '',
        tokenEncryptionKey: '',
        oauthEnabled: true,
      }),
    ).toThrow(
      'ZenMoney OAuth is enabled but server env vars are missing: ZENMONEY_CLIENT_SECRET, ZENMONEY_REDIRECT_URI, ZENMONEY_TOKEN_ENCRYPTION_KEY',
    );
  });

  it('does not require private OAuth env vars when OAuth is disabled', () => {
    expect(
      assertZenMoneyServerConfig({
        clientId: '',
        clientSecret: '',
        redirectUri: '',
        tokenEncryptionKey: '',
        oauthEnabled: false,
      }),
    ).toEqual({
      clientId: '',
      clientSecret: '',
      redirectUri: '',
      tokenEncryptionKey: '',
      oauthEnabled: false,
    });
  });
});
