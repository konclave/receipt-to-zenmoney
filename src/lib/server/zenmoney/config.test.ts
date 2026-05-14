import { describe, expect, it } from "vitest";
import { assertZenmoneyServerConfig } from "./config";

describe("assertZenmoneyServerConfig", () => {
  it("throws a helpful error when required OAuth env vars are missing", () => {
    expect(() =>
      assertZenmoneyServerConfig({
        clientId: "client-id",
        clientSecret: "",
        redirectUri: "",
        tokenEncryptionKey: "",
        oauthEnabled: true,
      }),
    ).toThrow(
      "Zenmoney OAuth is enabled but server env vars are missing: ZENMONEY_CLIENT_SECRET, ZENMONEY_REDIRECT_URI, ZENMONEY_TOKEN_ENCRYPTION_KEY",
    );
  });

  it("does not require private OAuth env vars when OAuth is disabled", () => {
    expect(
      assertZenmoneyServerConfig({
        clientId: "",
        clientSecret: "",
        redirectUri: "",
        tokenEncryptionKey: "",
        oauthEnabled: false,
      }),
    ).toEqual({
      clientId: "",
      clientSecret: "",
      redirectUri: "",
      tokenEncryptionKey: "",
      oauthEnabled: false,
    });
  });
});
