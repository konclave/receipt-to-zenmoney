import { env } from "$env/dynamic/private";

export interface ZenMoneyServerConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenEncryptionKey: string;
  oauthEnabled: boolean;
}

function getMissingOAuthEnvVars(config: ZenMoneyServerConfig): string[] {
  const missing: string[] = [];
  if (!config.clientId) missing.push("ZENMONEY_CLIENT_ID");
  if (!config.clientSecret) missing.push("ZENMONEY_CLIENT_SECRET");
  if (!config.redirectUri) missing.push("ZENMONEY_REDIRECT_URI");
  if (!config.tokenEncryptionKey) missing.push("ZENMONEY_TOKEN_ENCRYPTION_KEY");
  return missing;
}

export function assertZenMoneyServerConfig(
  config: ZenMoneyServerConfig,
): ZenMoneyServerConfig {
  if (!config.oauthEnabled) return config;

  const missing = getMissingOAuthEnvVars(config);
  if (missing.length > 0) {
    throw new Error(
      `ZenMoney OAuth is enabled but server env vars are missing: ${missing.join(", ")}`,
    );
  }

  return config;
}

export function getZenMoneyServerConfig(): ZenMoneyServerConfig {
  return assertZenMoneyServerConfig({
    clientId: env.ZENMONEY_CLIENT_ID ?? "",
    clientSecret: env.ZENMONEY_CLIENT_SECRET ?? "",
    redirectUri: env.ZENMONEY_REDIRECT_URI ?? "",
    tokenEncryptionKey: env.ZENMONEY_TOKEN_ENCRYPTION_KEY ?? "",
    oauthEnabled: import.meta.env.PUBLIC_ZENMONEY_OAUTH_ENABLED === "true",
  });
}
