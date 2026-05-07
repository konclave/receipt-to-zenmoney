import JSON5 from 'json5';
import { getTransactions, bulkInsertTransactions } from '$lib/db/transactions';
import {
  saveReceiptImage,
  bulkGetReceiptImages,
} from '$lib/db/receipt-images';
import type { Transaction } from '$lib/types';

interface BackupEnvelope {
  version: number;
  exportedAt: string;
  transactions: Transaction[];
  receiptImages?: Record<string, { mimeType: string; data: string }>;
}

async function blobToBase64(blob: Blob): Promise<string> {
  // Use Response to read the blob bytes — works across jsdom and browser environments.
  const buffer = await new Response(blob).arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBlob(data: string, mimeType: string): Blob {
  const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: mimeType });
}

export async function exportBackup(): Promise<{ blob: Blob; count: number }> {
  const transactions = await getTransactions();

  const receiptTxIds = transactions.filter((t) => t.hasReceipt).map((t) => t.id);
  const receiptMap = await bulkGetReceiptImages(receiptTxIds);
  const receiptImages: Record<string, { mimeType: string; data: string }> = {};
  await Promise.all(
    receiptTxIds.map(async (id) => {
      const img = receiptMap.get(id);
      if (img) receiptImages[id] = { mimeType: img.mimeType, data: await blobToBase64(img.blob) };
    }),
  );

  const envelope: BackupEnvelope = {
    version: 2,
    exportedAt: new Date().toISOString(),
    transactions,
    receiptImages,
  };

  const compressed = await new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON5.stringify(envelope, null, 2)));
        controller.close();
      },
    }).pipeThrough(new CompressionStream('gzip')),
  ).arrayBuffer();

  return { blob: new Blob([compressed], { type: 'application/gzip' }), count: transactions.length };
}

export async function importBackup(file: File): Promise<{ imported: number; skipped: number }> {
  let text: string;
  try {
    const buffer = await file.arrayBuffer();
    text = await new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(new Uint8Array(buffer));
          controller.close();
        },
      }).pipeThrough(new DecompressionStream('gzip')),
    ).text();
  } catch {
    throw new Error('Import failed: could not read file');
  }

  let envelope: BackupEnvelope;
  try {
    envelope = JSON5.parse(text);
  } catch {
    throw new Error('Import failed: invalid backup file');
  }

  if (envelope === null || typeof envelope !== 'object' || Array.isArray(envelope)) {
    throw new Error('Import failed: invalid backup file');
  }
  if (envelope.version !== 1 && envelope.version !== 2) {
    throw new Error('Import failed: unsupported backup version');
  }
  if (!Array.isArray(envelope.transactions)) {
    throw new Error('Import failed: invalid backup file');
  }

  const valid = envelope.transactions.every(
    (t: unknown) =>
      t !== null &&
      typeof t === 'object' &&
      !Array.isArray(t) &&
      typeof (t as Record<string, unknown>).id === 'string',
  );
  if (!valid) throw new Error('Import failed: invalid backup file');

  const receiptImages = envelope.receiptImages ?? {};

  const txsToInsert = envelope.transactions.map((t) =>
    receiptImages[t.id] ? { ...t, hasReceipt: true } : t,
  );

  const existing = await getTransactions();
  const existingIds = new Set(existing.map((t) => t.id));
  const toInsert = txsToInsert.filter((t) => !existingIds.has(t.id));
  await bulkInsertTransactions(toInsert);

  await Promise.all(
    toInsert
      .filter((t) => t.hasReceipt && receiptImages[t.id])
      .map(async (t) => {
        const { mimeType, data } = receiptImages[t.id];
        await saveReceiptImage(t.id, {
          blob: base64ToBlob(data, mimeType),
          mimeType: mimeType as 'image/jpeg' | 'image/png' | 'image/webp',
        });
      }),
  );

  return { imported: toInsert.length, skipped: envelope.transactions.length - toInsert.length };
}
