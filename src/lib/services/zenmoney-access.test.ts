import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSettings, saveSettings } from "$lib/db/settings";
import {
  getConfiguredZenmoneyToken,
  getZenmoneyAccessToken,
  clearZenmoneyAccessToken,
  getZenmoneyAuthMode,
} from "./zenmoney-access";

const envMock = vi.hoisted(() => ({ PUBLIC_ZENMONEY_OAUTH_ENABLED: "true" }));
vi.mock("$env/static/public", () => envMock);

beforeEach(async () => {
  vi.restoreAllMocks();
  envMock.PUBLIC_ZENMONEY_OAUTH_ENABLED = "true";
  await clearZenmoneyAccessToken();
});

describe("getZenmoneyAccessToken", () => {
  it("reuses a stored token when it is not close to expiry", async () => {
    await saveSettings({
      zenmoneyAccessToken: "stored-token",
      zenmoneyAccessTokenExpiresAt: Date.now() + 60 * 60_000,
    });

    expect(await getZenmoneyAccessToken()).toBe("stored-token");
  });

  it("refreshes through the broker when the token is expired", async () => {
    await saveSettings({
      zenmoneyAccessToken: "expired-token",
      zenmoneyAccessTokenExpiresAt: Date.now() - 1000,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            accessToken: "fresh-token",
            expiresAt: Date.now() + 60 * 60_000,
          }),
          { status: 200 },
        ),
      ),
    );

    expect(await getZenmoneyAccessToken()).toBe("fresh-token");
    expect((await getSettings()).zenmoneyAccessToken).toBe("fresh-token");
  });

  it("throws when OAuth is disabled", async () => {
    envMock.PUBLIC_ZENMONEY_OAUTH_ENABLED = "false";
    await expect(getZenmoneyAccessToken()).rejects.toThrow("OAuth not enabled");
  });

  it("clears local token state", async () => {
    await saveSettings({
      zenmoneyAccessToken: "token",
      zenmoneyAccessTokenExpiresAt: Date.now() + 1000,
    });
    await clearZenmoneyAccessToken();
    const settings = await getSettings();
    expect(settings.zenmoneyAccessToken).toBe("");
    expect(settings.zenmoneyAccessTokenExpiresAt).toBe(0);
  });
});

describe("getConfiguredZenmoneyToken", () => {
  it("returns the saved manual token when OAuth is disabled", async () => {
    envMock.PUBLIC_ZENMONEY_OAUTH_ENABLED = "false";
    await saveSettings({ zenmoneyToken: "manual-token" });
    await expect(getConfiguredZenmoneyToken()).resolves.toBe("manual-token");
  });

  it("returns the manual token when OAuth is enabled but no session exists", async () => {
    await saveSettings({ zenmoneyToken: "manual-token" });
    await expect(getConfiguredZenmoneyToken()).resolves.toBe("manual-token");
  });

  it("returns OAuth token when session is active", async () => {
    await saveSettings({
      zenmoneyAccessToken: "oauth-token",
      zenmoneyAccessTokenExpiresAt: Date.now() + 60 * 60_000,
    });
    await expect(getConfiguredZenmoneyToken()).resolves.toBe("oauth-token");
  });

  it("falls back to manual token when broker returns 401", async () => {
    await saveSettings({
      zenmoneyAccessToken: "stale-token",
      zenmoneyAccessTokenExpiresAt: Date.now() - 1000,
      zenmoneyToken: "manual-token",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 401 })),
    );
    await expect(getConfiguredZenmoneyToken()).resolves.toBe("manual-token");
  });
});

describe("getZenmoneyAuthMode", () => {
  it("returns manual when OAuth is disabled", async () => {
    envMock.PUBLIC_ZENMONEY_OAUTH_ENABLED = "false";
    expect(await getZenmoneyAuthMode()).toBe("manual");
  });

  it("returns oauth when OAuth is enabled and a session token exists", async () => {
    await saveSettings({
      zenmoneyAccessToken: "some-token",
      zenmoneyAccessTokenExpiresAt: 1,
    });
    expect(await getZenmoneyAuthMode()).toBe("oauth");
  });

  it("returns manual when OAuth is enabled but no session exists", async () => {
    expect(await getZenmoneyAuthMode()).toBe("manual");
  });
});
