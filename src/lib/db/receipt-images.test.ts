import { it, expect, beforeEach } from 'vitest';
import {
  saveReceiptImage,
  getReceiptImage,
  bulkGetReceiptImages,
  deleteReceiptImage,
  bulkDeleteReceiptImages,
} from './receipt-images';
import { _resetDb } from './index';
import type { ReceiptImage } from '$lib/types';

function makeImage(overrides: Partial<ReceiptImage> = {}): ReceiptImage {
  return {
    mimeType: 'image/jpeg',
    blob: new Blob(['fake-image-data'], { type: 'image/jpeg' }),
    ...overrides,
  };
}

beforeEach(async () => {
  _resetDb();
  await new Promise<void>((resolve) => {
    const req = globalThis.indexedDB.deleteDatabase('rzm');
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
  });
});

it('returns undefined for unknown txId', async () => {
  expect(await getReceiptImage('no-such-id')).toBeUndefined();
});

it('saves and retrieves a receipt image', async () => {
  const img = makeImage({ mimeType: 'image/png' });
  await saveReceiptImage('tx-1', img);
  const result = await getReceiptImage('tx-1');
  expect(result).toBeDefined();
  expect(result!.mimeType).toBe('image/png');
});

it('overwrites on duplicate txId', async () => {
  await saveReceiptImage('tx-1', makeImage({ mimeType: 'image/jpeg' }));
  await saveReceiptImage('tx-1', makeImage({ mimeType: 'image/webp' }));
  const result = await getReceiptImage('tx-1');
  expect(result!.mimeType).toBe('image/webp');
});

it('deleteReceiptImage removes the entry', async () => {
  await saveReceiptImage('tx-del', makeImage());
  await deleteReceiptImage('tx-del');
  expect(await getReceiptImage('tx-del')).toBeUndefined();
});

it('deleteReceiptImage is a no-op for unknown id', async () => {
  await expect(deleteReceiptImage('ghost')).resolves.toBeUndefined();
});

it('bulkGetReceiptImages returns empty map for empty input', async () => {
  const result = await bulkGetReceiptImages([]);
  expect(result.size).toBe(0);
});

it('bulkGetReceiptImages returns only found entries', async () => {
  await saveReceiptImage('tx-a', makeImage({ mimeType: 'image/jpeg' }));
  await saveReceiptImage('tx-b', makeImage({ mimeType: 'image/png' }));
  const result = await bulkGetReceiptImages(['tx-a', 'tx-b', 'tx-missing']);
  expect(result.size).toBe(2);
  expect(result.get('tx-a')!.mimeType).toBe('image/jpeg');
  expect(result.get('tx-b')!.mimeType).toBe('image/png');
  expect(result.has('tx-missing')).toBe(false);
});

it('bulkDeleteReceiptImages removes all specified ids', async () => {
  await saveReceiptImage('tx-1', makeImage());
  await saveReceiptImage('tx-2', makeImage());
  await saveReceiptImage('tx-3', makeImage());
  await bulkDeleteReceiptImages(['tx-1', 'tx-3']);
  expect(await getReceiptImage('tx-1')).toBeUndefined();
  expect(await getReceiptImage('tx-2')).toBeDefined();
  expect(await getReceiptImage('tx-3')).toBeUndefined();
});

it('bulkDeleteReceiptImages is a no-op for empty array', async () => {
  await saveReceiptImage('keep', makeImage());
  await bulkDeleteReceiptImages([]);
  expect(await getReceiptImage('keep')).toBeDefined();
});
