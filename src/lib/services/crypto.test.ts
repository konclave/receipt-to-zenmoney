import { describe, it, expect, beforeEach } from 'vitest'
import { encrypt, decrypt } from './crypto'

beforeEach(() => {
  localStorage.clear()
})

describe('encrypt', () => {
  it('returns a base64 string different from input', async () => {
    const result = await encrypt('my-api-key')
    expect(result).not.toBe('my-api-key')
    expect(typeof result).toBe('string')
    expect(result.length).toBeGreaterThan(0)
  })

  it('produces different ciphertext on each call due to random IV', async () => {
    const a = await encrypt('same-input')
    const b = await encrypt('same-input')
    expect(a).not.toBe(b)
  })
})

describe('decrypt', () => {
  it('reverses encrypt', async () => {
    const original = 'sk-ant-api03-secret-key'
    const decrypted = await decrypt(await encrypt(original))
    expect(decrypted).toBe(original)
  })

  it('works with empty string', async () => {
    expect(await decrypt(await encrypt(''))).toBe('')
  })
})
