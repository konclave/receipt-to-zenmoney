// src/lib/db/categories.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { getCategories, saveCategories } from './categories'
import { _resetDb } from './index'
import type { Category } from '$lib/types'

const CATS: Category[] = [
  { id: 'c1', title: 'Groceries', parentId: null, syncedAt: 1000 },
  { id: 'c2', title: 'Transport', parentId: null, syncedAt: 1000 },
  { id: 'c3', title: 'Bus', parentId: 'c2', syncedAt: 1000 }
]

beforeEach(async () => {
  _resetDb()
  await new Promise<void>((resolve) => {
    const req = globalThis.indexedDB.deleteDatabase('rzm')
    req.onsuccess = () => resolve()
    req.onerror = () => resolve()
  })
})

it('returns empty array initially', async () => {
  expect(await getCategories()).toEqual([])
})

it('stores and retrieves categories', async () => {
  await saveCategories(CATS)
  const result = await getCategories()
  expect(result).toHaveLength(3)
  expect(result.map((c) => c.id)).toContain('c1')
})

it('replaces old categories on re-save', async () => {
  await saveCategories(CATS)
  await saveCategories([{ id: 'new', title: 'New', parentId: null, syncedAt: 2000 }])
  const result = await getCategories()
  expect(result).toHaveLength(1)
  expect(result[0].id).toBe('new')
})
