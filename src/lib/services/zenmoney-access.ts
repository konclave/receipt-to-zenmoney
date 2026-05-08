import { getSettings, saveSettings } from "$lib/db/settings";

const REFRESH_WINDOW_MS = 5 * 60_000;

function isOAuthEnabled(): boolean {
  return import.meta.env.PUBLIC_ZENMONEY_OAUTH_ENABLED === "true";
}

function tokenNeedsRefresh(expiresAt: number, now = Date.now()): boolean {
  return !expiresAt || expiresAt - now <= REFRESH_WINDOW_MS;
}

export async function clearZenMoneyAccessToken(): Promise<void> {
  await saveSettings({
    zenmoneyAccessToken: "",
    zenmoneyAccessTokenExpiresAt: 0,
  });
}

export async function getZenMoneyAccessToken(
  forceRefresh = false,
): Promise<string> {
  const settings = await getSettings();
  if (isOAuthEnabled()) {
    throw new Error("ZenMoney OAuth mode is not active.");
  }

  if (
    !forceRefresh &&
    settings.zenmoneyAccessToken &&
    !tokenNeedsRefresh(settings.zenmoneyAccessTokenExpiresAt)
  ) {
    return settings.zenmoneyAccessToken;
  }

  const response = await fetch("/api/zenmoney/access-token", {
    credentials: "include",
  });
  if (!response.ok) {
    await clearZenMoneyAccessToken();
    throw new Error("ZenMoney connection expired. Reconnect in Settings.");
  }

  const data = (await response.json()) as {
    accessToken: string;
    expiresAt: number;
  };
  await saveSettings({
    zenmoneyAccessToken: data.accessToken,
    zenmoneyAccessTokenExpiresAt: data.expiresAt,
  });
  return data.accessToken;
}

export async function getConfiguredZenMoneyToken(
  forceRefresh = false,
): Promise<string> {
  const settings = await getSettings();
  if (
    resolveZenMoneyAuthMode(settings.zenmoneyAuthMode, isOAuthEnabled()) ===
    "manual"
  ) {
    if (!settings.zenmoneyToken) {
      throw new Error("ZenMoney token not set");
    }
    return settings.zenmoneyToken;
  }

  return getZenMoneyAccessToken(forceRefresh);
}

export async function getZenMoneyAuthMode(): Promise<"manual" | "oauth"> {
  return resolveZenMoneyAuthMode(
    (await getSettings()).zenmoneyAuthMode,
    isOAuthEnabled(),
  );
}
