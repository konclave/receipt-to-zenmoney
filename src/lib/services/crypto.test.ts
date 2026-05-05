import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'

beforeEach(() => {
  // Replace the global indexedDB with a fresh instance so each test
  // gets an isolated IDB without leftover open connections.
  globalThis.indexedDB = new IDBFactory()
  vi.resetModules()
})

describe('encrypt', () => {
  it('returns a base64 string different from input', async () => {
    const { encrypt } = await import('./crypto')
    const result = await encrypt('my-api-key')
    expect(result).not.toBe('my-api-key')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('produces different ciphertext on each call due to random IV', async () => {
    const { encrypt } = await import('./crypto')
    const a = await encrypt('same-input')
    const b = await encrypt('same-input')
    expect(a).not.toBe(b)
  })
})

describe('decrypt', () => {
  it('reverses encrypt', async () => {
    const { encrypt, decrypt } = await import('./crypto')
    const original = 'sk-ant-api03-secret-key'
    const decrypted = await decrypt(await encrypt(original))
    expect(decrypted).toBe(original)
  })

  it('works with empty string', async () => {
    const { encrypt, decrypt } = await import('./crypto')
    expect(await decrypt(await encrypt(''))).toBe('')
  })
})
