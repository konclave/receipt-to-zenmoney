import { getDb } from './index';
import type { ReceiptImage } from '$lib/types';

export async function saveReceiptImage(txId: string, image: ReceiptImage): Promise<void> {
  const db = await getDb();
  await db.put('receipt-images', { blob: image.blob, mimeType: image.mimeType }, txId);
}

export async function getReceiptImage(txId: string): Promise<ReceiptImage | undefined> {
  const db = await getDb();
  const row = await db.get('receipt-images', txId);
  if (!row) return undefined;
  return { blob: row.blob, mimeType: row.mimeType as ReceiptImage['mimeType'] };
}

export async function bulkGetReceiptImages(txIds: string[]): Promise<Map<string, ReceiptImage>> {
  if (txIds.length === 0) return new Map();
  const db = await getDb();
  const rows = await Promise.all(txIds.map((id) => db.get('receipt-images', id)));
  const map = new Map<string, ReceiptImage>();
  txIds.forEach((id, i) => {
    const row = rows[i];
    if (row) map.set(id, { blob: row.blob, mimeType: row.mimeType as ReceiptImage['mimeType'] });
  });
  return map;
}

export async function deleteReceiptImage(txId: string): Promise<void> {
  const db = await getDb();
  await db.delete('receipt-images', txId);
}
