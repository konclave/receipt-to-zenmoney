// src/lib/services/backup.ts
import JSON5 from 'json5';
import { getTransactions, bulkInsertTransactions } from '$lib/db/transactions';
import type { Transaction } from '$lib/types';

interface BackupEnvelope {
  version: number;
  exportedAt: string;
  transactions: Transaction[];
}

export async function exportBackup(): Promise<{ blob: Blob; count: number }> {
  const transactions = await getTransactions();
  const envelope: BackupEnvelope = {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions,
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

  if (envelope.version !== 1) throw new Error('Import failed: unsupported backup version');
  if (!Array.isArray(envelope.transactions)) throw new Error('Import failed: invalid backup file');

  const existing = await getTransactions();
  const existingIds = new Set(existing.map((t) => t.id));
  const toInsert = envelope.transactions.filter((t) => !existingIds.has(t.id));
  await bulkInsertTransactions(toInsert);
  return { imported: toInsert.length, skipped: envelope.transactions.length - toInsert.length };
}
