import { getDb } from './index'
import type { ZenMoneyAccount } from '$lib/types'

export async function getAccounts(): Promise<ZenMoneyAccount[]> {
  const db = await getDb()
  return db.getAll('accounts')
}

export async function saveAccounts(accounts: ZenMoneyAccount[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('accounts', 'readwrite')
  await tx.store.clear()
  await Promise.all(accounts.map((account) => tx.store.put(account)))
  await tx.done
}
