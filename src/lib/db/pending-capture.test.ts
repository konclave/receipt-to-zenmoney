import { it, expect, beforeEach } from 'vitest';
import { savePendingCapture, getPendingCapture, clearPendingCapture } from './pending-capture';
import { _resetDb } from './index';
import type { PendingCapture } from '$lib/types';

const CAPTURE: PendingCapture = {
  imageBase64: 'abc123',
  mimeType: 'image/jpeg',
};

beforeEach(async () => {
  _resetDb();
  await new Promise<void>((resolve) => {
    const req = globalThis.indexedDB.deleteDatabase('rzm');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
});

it('returns undefined when nothing is saved', async () => {
  expect(await getPendingCapture()).toBeUndefined();
});

it('saves and retrieves pending capture', async () => {
  await savePendingCapture(CAPTURE);
  const result = await getPendingCapture();
  expect(result).toEqual(CAPTURE);
});

it('overwrites previous capture on re-save', async () => {
  await savePendingCapture(CAPTURE);
  const updated: PendingCapture = { imageBase64: 'xyz789', mimeType: 'image/jpeg' };
  await savePendingCapture(updated);
  expect(await getPendingCapture()).toEqual(updated);
});

it('clearPendingCapture removes the stored capture', async () => {
  await savePendingCapture(CAPTURE);
  await clearPendingCapture();
  expect(await getPendingCapture()).toBeUndefined();
});
