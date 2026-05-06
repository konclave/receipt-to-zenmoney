import { getDb } from './index';
import type { PendingCapture } from '$lib/types';

const KEY = 'current';

export async function savePendingCapture(data: PendingCapture): Promise<void> {
  const db = await getDb();
  await db.put('pending-capture', data, KEY);
}

export async function getPendingCapture(): Promise<PendingCapture | undefined> {
  const db = await getDb();
  return db.get('pending-capture', KEY);
}

export async function clearPendingCapture(): Promise<void> {
  const db = await getDb();
  await db.delete('pending-capture', KEY);
}
