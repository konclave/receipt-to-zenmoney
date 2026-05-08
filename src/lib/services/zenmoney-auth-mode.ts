export function resolveZenMoneyAuthMode(
  storedMode: "manual" | "oauth",
  oauthEnabled: boolean,
): "manual" | "oauth" {
  return oauthEnabled ? storedMode : "manual";
}
