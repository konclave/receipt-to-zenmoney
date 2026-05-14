import { PUBLIC_ZENMONEY_OAUTH_ENABLED } from "$env/static/public";
import { getSettings, saveSettings } from "$lib/db/settings";

const REFRESH_WINDOW_MS = 5 * 60_000;

function isOAuthEnabled(): boolean {
  return PUBLIC_ZENMONEY_OAUTH_ENABLED === "true";
}

function tokenNeedsRefresh(expiresAt: number, now = Date.now()): boolean {
  return !expiresAt || expiresAt - now <= REFRESH_WINDOW_MS;
}

export async function clearZenmoneyAccessToken(): Promise<void> {
  await saveSettings({
    zenmoneyAccessToken: "",
    zenmoneyAccessTokenExpiresAt: 0,
  });
}

export async function getZenmoneyAccessToken(
  forceRefresh = false,
): Promise<string> {
  if (!isOAuthEnabled()) throw new Error("OAuth not enabled.");

  const settings = await getSettings();
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
    await clearZenmoneyAccessToken();
    throw new Error("Zenmoney connection expired. Reconnect in Settings.");
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

export async function getConfiguredZenmoneyToken(
  forceRefresh = false,
): Promise<string> {
  if (isOAuthEnabled()) {
    const settings = await getSettings();
    const hasSession =
      settings.zenmoneyAccessToken || settings.zenmoneyAccessTokenExpiresAt > 0;

    if (hasSession || forceRefresh) {
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
      if (response.ok) {
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
      await clearZenmoneyAccessToken();
    }
  }

  const settings = await getSettings();
  if (!settings.zenmoneyToken) throw new Error("Zenmoney token not set");
  return settings.zenmoneyToken;
}

export async function getZenmoneyAuthMode(): Promise<"manual" | "oauth"> {
  if (!isOAuthEnabled()) return "manual";
  const settings = await getSettings();
  return settings.zenmoneyAccessToken ||
    settings.zenmoneyAccessTokenExpiresAt > 0
    ? "oauth"
    : "manual";
}
