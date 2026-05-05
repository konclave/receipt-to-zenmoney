// src/lib/services/crypto.ts
import { openDB } from 'idb'

const KEY_STORE = 'crypto-keys'
const DB_NAME = 'rzm-keys'
const KEY_ID = 'main'

async function getKeyDb() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(KEY_STORE)
    }
  })
}

async function getOrCreateKey(): Promise<CryptoKey> {
  const db = await getKeyDb()
  const stored: CryptoKey | undefined = await db.get(KEY_STORE, KEY_ID)
  if (stored) return stored
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt'
  ])
  await db.put(KEY_STORE, key, KEY_ID)
  return key
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getOrCreateKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return btoa(String.fromCharCode(...combined))
}

export async function decrypt(ciphertext: string): Promise<string> {
  const key = await getOrCreateKey()
  const combined = Uint8Array.from(atob(ciphertext), (c) => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const data = combined.slice(12)
  const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return new TextDecoder().decode(plaintext)
}
