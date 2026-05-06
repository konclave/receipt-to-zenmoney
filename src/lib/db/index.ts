import { openDB, type IDBPDatabase } from 'idb'
import type { Category, Transaction, PendingCapture, ZenMoneyAccount } from '$lib/types'

interface AppDB {
  settings: { key: string; value: string | number }
  categories: { key: string; value: Category }
  accounts: { key: string; value: ZenMoneyAccount }
  transactions: {
    key: string
    value: Transaction
    indexes: { 'by-date': string }
  }
  'pending-capture': { key: string; value: PendingCapture }
}

let _db: IDBPDatabase<AppDB> | null = null

export async function getDb(): Promise<IDBPDatabase<AppDB>> {
  if (!_db) {
    _db = await openDB<AppDB>('rzm', 3, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          db.createObjectStore('settings')
          db.createObjectStore('categories', { keyPath: 'id' })
          const txStore = db.createObjectStore('transactions', { keyPath: 'id' })
          txStore.createIndex('by-date', 'date')
        }
        if (oldVersion < 2) {
          db.createObjectStore('pending-capture')
        }
        if (oldVersion < 3) {
          db.createObjectStore('accounts', { keyPath: 'id' })
        }
      }
    })
  }
  return _db
}

export function _resetDb(): void {
  _db?.close()
  _db = null
}
