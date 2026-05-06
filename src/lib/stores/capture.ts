import { writable } from 'svelte/store'
import type { PendingCapture } from '$lib/types'

export type CaptureData = PendingCapture

export const captureStore = writable<CaptureData | null>(null)
