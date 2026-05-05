// src/lib/db/categories.ts
import { getDb } from './index'
import type { Category } from '$lib/types'

export async function getCategories(): Promise<Category[]> {
  const db = await getDb()
  return db.getAll('categories')
}

export async function saveCategories(categories: Category[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('categories', 'readwrite')
  await tx.store.clear()
  await Promise.all(categories.map((c) => tx.store.put(c)))
  await tx.done
}
