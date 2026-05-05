// src/lib/db/index.ts
import { openDB, type IDBPDatabase } from 'idb'
import type { Category, Transaction } from '$lib/types'

interface AppDB {
  settings: { key: string; value: string | number }
  categories: { key: string; value: Category }
  transactions: {
    key: string
    value: Transaction
    indexes: { 'by-date': string }
  }
}

let _db: IDBPDatabase<AppDB> | null = null

export async function getDb(): Promise<IDBPDatabase<AppDB>> {
  if (!_db) {
    _db = await openDB<AppDB>('rzm', 1, {
      upgrade(db) {
        db.createObjectStore('settings')
        db.createObjectStore('categories', { keyPath: 'id' })
        const txStore = db.createObjectStore('transactions', { keyPath: 'id' })
        txStore.createIndex('by-date', 'date')
      }
    })
  }
  return _db
}

export function _resetDb(): void {
  _db?.close()
  _db = null
}
