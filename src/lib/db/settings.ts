// src/lib/db/settings.ts
import { getDb } from './index'
import { encrypt, decrypt } from '$lib/services/crypto'
import type { Settings } from '$lib/types'

export async function getSettings(): Promise<Settings> {
  const db = await getDb()
  const [apiKeyRaw, tokenRaw, ts, accountId, userId] = await Promise.all([
    db.get('settings', 'claudeApiKey'),
    db.get('settings', 'zenmoneyToken'),
    db.get('settings', 'zenmoneyServerTimestamp'),
    db.get('settings', 'zenmoneyAccountId'),
    db.get('settings', 'zenmoneyUserId')
  ])
  return {
    claudeApiKey: apiKeyRaw ? await decrypt(apiKeyRaw as string) : '',
    zenmoneyToken: tokenRaw ? await decrypt(tokenRaw as string) : '',
    zenmoneyServerTimestamp: (ts as number) ?? 0,
    zenmoneyAccountId: (accountId as string) ?? '',
    zenmoneyUserId: (userId as number) ?? 0
  }
}

export async function saveSettings(partial: Partial<Settings>): Promise<void> {
  const db = await getDb()

  // Pre-encrypt sensitive values before opening the transaction,
  // because IDB transactions auto-commit when there are no pending requests
  // and async crypto work would let the transaction expire.
  const encrypted: Record<string, string | number> = {}
  if (partial.claudeApiKey !== undefined)
    encrypted.claudeApiKey = await encrypt(partial.claudeApiKey)
  if (partial.zenmoneyToken !== undefined)
    encrypted.zenmoneyToken = await encrypt(partial.zenmoneyToken)

  const tx = db.transaction('settings', 'readwrite')
  const puts: Promise<unknown>[] = []
  if (encrypted.claudeApiKey !== undefined)
    puts.push(tx.store.put(encrypted.claudeApiKey, 'claudeApiKey'))
  if (encrypted.zenmoneyToken !== undefined)
    puts.push(tx.store.put(encrypted.zenmoneyToken, 'zenmoneyToken'))
  if (partial.zenmoneyServerTimestamp !== undefined)
    puts.push(tx.store.put(partial.zenmoneyServerTimestamp, 'zenmoneyServerTimestamp'))
  if (partial.zenmoneyAccountId !== undefined)
    puts.push(tx.store.put(partial.zenmoneyAccountId, 'zenmoneyAccountId'))
  if (partial.zenmoneyUserId !== undefined)
    puts.push(tx.store.put(partial.zenmoneyUserId, 'zenmoneyUserId'))
  await Promise.all(puts)
  await tx.done
}
