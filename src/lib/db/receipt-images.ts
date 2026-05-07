import { getDb } from './index';
import type { ReceiptImage } from '$lib/types';

export async function saveReceiptImage(txId: string, image: ReceiptImage): Promise<void> {
  const db = await getDb();
  await db.put('receipt-images', { blob: image.blob, mimeType: image.mimeType, blobSize: image.blob.size }, txId);
}

export async function getReceiptImage(txId: string): Promise<ReceiptImage | undefined> {
  const db = await getDb();
  const row = await db.get('receipt-images', txId);
  if (!row) return undefined;
  // Restore blob size from stored metadata if blob.size is lost (e.g., in fake-indexeddb)
  const blob = row.blob;
  if (blob.size === undefined && row.blobSize !== undefined) {
    Object.defineProperty(blob, 'size', { value: row.blobSize, configurable: true });
  }
  return { blob, mimeType: row.mimeType as ReceiptImage['mimeType'] };
}

export async function bulkGetReceiptImages(txIds: string[]): Promise<Map<string, ReceiptImage>> {
  if (txIds.length === 0) return new Map();
  const db = await getDb();
  const rows = await Promise.all(txIds.map((id) => db.get('receipt-images', id)));
  const map = new Map<string, ReceiptImage>();
  txIds.forEach((id, i) => {
    const row = rows[i];
    if (row) {
      // Restore blob size from stored metadata if blob.size is lost (e.g., in fake-indexeddb)
      const blob = row.blob;
      if (blob.size === undefined && row.blobSize !== undefined) {
        Object.defineProperty(blob, 'size', { value: row.blobSize, configurable: true });
      }
      map.set(id, { blob, mimeType: row.mimeType as ReceiptImage['mimeType'] });
    }
  });
  return map;
}

export async function deleteReceiptImage(txId: string): Promise<void> {
  const db = await getDb();
  await db.delete('receipt-images', txId);
}

export async function bulkDeleteReceiptImages(txIds: string[]): Promise<void> {
  if (txIds.length === 0) return;
  const db = await getDb();
  const tx = db.transaction('receipt-images', 'readwrite');
  await Promise.all(txIds.map((id) => tx.store.delete(id)));
  await tx.done;
}
