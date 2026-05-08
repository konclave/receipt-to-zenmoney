// src/lib/db/settings.ts
import { getDb } from "./index";
import { encrypt, decrypt } from "$lib/services/crypto";
import type { Settings } from "$lib/types";

export async function getSettings(): Promise<Settings> {
  const db = await getDb();
  const [
    apiKeyRaw,
    tokenRaw,
    authMode,
    accessTokenRaw,
    accessTokenExpiresAt,
    ts,
    accountId,
    userId,
    orKeyRaw,
    aiProvider,
    orModel,
  ] = await Promise.all([
    db.get("settings", "claudeApiKey"),
    db.get("settings", "zenmoneyToken"),
    db.get("settings", "zenmoneyAuthMode"),
    db.get("settings", "zenmoneyAccessToken"),
    db.get("settings", "zenmoneyAccessTokenExpiresAt"),
    db.get("settings", "zenmoneyServerTimestamp"),
    db.get("settings", "zenmoneyAccountId"),
    db.get("settings", "zenmoneyUserId"),
    db.get("settings", "openrouterApiKey"),
    db.get("settings", "aiProvider"),
    db.get("settings", "openrouterModel"),
  ]);
  return {
    claudeApiKey: apiKeyRaw ? await decrypt(apiKeyRaw as string) : "",
    zenmoneyAuthMode: (authMode as "manual" | "oauth") ?? "manual",
    zenmoneyToken: tokenRaw ? await decrypt(tokenRaw as string) : "",
    zenmoneyAccessToken: accessTokenRaw
      ? await decrypt(accessTokenRaw as string)
      : "",
    zenmoneyAccessTokenExpiresAt: (accessTokenExpiresAt as number) ?? 0,
    zenmoneyServerTimestamp: (ts as number) ?? 0,
    zenmoneyAccountId: (accountId as string) ?? "",
    zenmoneyUserId: (userId as number) ?? 0,
    aiProvider: (aiProvider as "anthropic" | "openrouter") ?? "anthropic",
    openrouterApiKey: orKeyRaw ? await decrypt(orKeyRaw as string) : "",
    openrouterModel: (orModel as string) ?? "anthropic/claude-sonnet-4.6",
  };
}

export async function saveSettings(partial: Partial<Settings>): Promise<void> {
  const db = await getDb();

  // Pre-encrypt sensitive values before opening the transaction,
  // because IDB transactions auto-commit when there are no pending requests
  // and async crypto work would let the transaction expire.
  const encrypted: Record<string, string | number> = {};
  if (partial.claudeApiKey !== undefined)
    encrypted.claudeApiKey = await encrypt(partial.claudeApiKey);
  if (partial.zenmoneyToken !== undefined)
    encrypted.zenmoneyToken = await encrypt(partial.zenmoneyToken);
  if (partial.zenmoneyAuthMode !== undefined)
    encrypted.zenmoneyAuthMode = partial.zenmoneyAuthMode;
  if (partial.zenmoneyAccessToken !== undefined)
    encrypted.zenmoneyAccessToken = await encrypt(partial.zenmoneyAccessToken);
  if (partial.openrouterApiKey !== undefined)
    encrypted.openrouterApiKey = await encrypt(partial.openrouterApiKey);

  const tx = db.transaction("settings", "readwrite");
  const puts: Promise<unknown>[] = [];
  if (encrypted.claudeApiKey !== undefined)
    puts.push(tx.store.put(encrypted.claudeApiKey, "claudeApiKey"));
  if (encrypted.zenmoneyToken !== undefined)
    puts.push(tx.store.put(encrypted.zenmoneyToken, "zenmoneyToken"));
  if (encrypted.zenmoneyAuthMode !== undefined)
    puts.push(tx.store.put(encrypted.zenmoneyAuthMode, "zenmoneyAuthMode"));
  if (encrypted.zenmoneyAccessToken !== undefined)
    puts.push(
      tx.store.put(encrypted.zenmoneyAccessToken, "zenmoneyAccessToken"),
    );
  if (partial.zenmoneyAccessTokenExpiresAt !== undefined)
    puts.push(
      tx.store.put(
        partial.zenmoneyAccessTokenExpiresAt,
        "zenmoneyAccessTokenExpiresAt",
      ),
    );
  if (partial.zenmoneyServerTimestamp !== undefined)
    puts.push(
      tx.store.put(partial.zenmoneyServerTimestamp, "zenmoneyServerTimestamp"),
    );
  if (partial.zenmoneyAccountId !== undefined)
    puts.push(tx.store.put(partial.zenmoneyAccountId, "zenmoneyAccountId"));
  if (partial.zenmoneyUserId !== undefined)
    puts.push(tx.store.put(partial.zenmoneyUserId, "zenmoneyUserId"));
  if (encrypted.openrouterApiKey !== undefined)
    puts.push(tx.store.put(encrypted.openrouterApiKey, "openrouterApiKey"));
  if (partial.aiProvider !== undefined)
    puts.push(tx.store.put(partial.aiProvider, "aiProvider"));
  if (partial.openrouterModel !== undefined)
    puts.push(tx.store.put(partial.openrouterModel, "openrouterModel"));
  await Promise.all(puts);
  await tx.done;
}
