// src/lib/services/backup.ts
import JSON5 from 'json5';
import { getTransactions } from '$lib/db/transactions';
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

export async function importBackup(_file: File): Promise<{ imported: number; skipped: number }> {
  // placeholder — implemented in Task 5
  throw new Error('not implemented');
}
