import { env } from '$env/dynamic/private';
import { PUBLIC_ZENMONEY_OAUTH_ENABLED } from '$env/static/public';

export interface ZenmoneyServerConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenEncryptionKey: string;
  oauthEnabled: boolean;
}

function getMissingOAuthEnvVars(config: ZenmoneyServerConfig): string[] {
  const missing: string[] = [];
  if (!config.clientId) missing.push('ZENMONEY_CLIENT_ID');
  if (!config.clientSecret) missing.push('ZENMONEY_CLIENT_SECRET');
  if (!config.redirectUri) missing.push('ZENMONEY_REDIRECT_URI');
  if (!config.tokenEncryptionKey) missing.push('ZENMONEY_TOKEN_ENCRYPTION_KEY');
  return missing;
}

export function assertZenmoneyServerConfig(config: ZenmoneyServerConfig): ZenmoneyServerConfig {
  if (!config.oauthEnabled) return config;

  const missing = getMissingOAuthEnvVars(config);
  if (missing.length > 0) {
    throw new Error(
      `Zenmoney OAuth is enabled but server env vars are missing: ${missing.join(', ')}`,
    );
  }

  return config;
}

export function getZenmoneyServerConfig(): ZenmoneyServerConfig {
  return assertZenmoneyServerConfig({
    clientId: env.ZENMONEY_CLIENT_ID ?? '',
    clientSecret: env.ZENMONEY_CLIENT_SECRET ?? '',
    redirectUri: env.ZENMONEY_REDIRECT_URI ?? '',
    tokenEncryptionKey: env.ZENMONEY_TOKEN_ENCRYPTION_KEY ?? '',
    oauthEnabled: PUBLIC_ZENMONEY_OAUTH_ENABLED === 'true',
  });
}
