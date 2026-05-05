import { writable } from 'svelte/store'

export interface CaptureData {
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
}

export const captureStore = writable<CaptureData | null>(null)
