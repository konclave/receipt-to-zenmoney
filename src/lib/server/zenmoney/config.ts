import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';

export function getZenMoneyServerConfig() {
  return {
    clientId: env.ZENMONEY_CLIENT_ID ?? '',
    clientSecret: env.ZENMONEY_CLIENT_SECRET ?? '',
    redirectUri: env.ZENMONEY_REDIRECT_URI ?? '',
    sessionSecret: env.ZENMONEY_SESSION_SECRET ?? '',
    tokenEncryptionKey: env.ZENMONEY_TOKEN_ENCRYPTION_KEY ?? '',
    oauthEnabled: publicEnv.PUBLIC_ZENMONEY_OAUTH_ENABLED === 'true',
  };
}
