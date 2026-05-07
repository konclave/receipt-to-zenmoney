import { getTransactions } from '$lib/db/transactions';
import { bulkGetReceiptImages } from '$lib/db/receipt-images';

export interface YearStats {
  year: number;
  txCount: number;
  bytes: number;
}

export interface StorageStats {
  totalBytes: number;
  byYear: YearStats[]; // descending by year
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function getStorageStats(): Promise<StorageStats> {
  const transactions = await getTransactions();

  const grouped = new Map<number, string[]>();
  for (const tx of transactions) {
    const year = parseInt(tx.date.slice(0, 4), 10);
    if (!grouped.has(year)) grouped.set(year, []);
    grouped.get(year)!.push(tx.id);
  }

  const years = Array.from(grouped.keys()).sort((a, b) => b - a);

  const byYear: YearStats[] = await Promise.all(
    years.map(async (year) => {
      const txIds = grouped.get(year)!;
      const images = await bulkGetReceiptImages(txIds);
      let bytes = txIds.length * 500;
      for (const img of images.values()) {
        bytes += img.blob.size;
      }
      return { year, txCount: txIds.length, bytes };
    }),
  );

  const totalBytes = byYear.reduce((sum, s) => sum + s.bytes, 0);
  return { totalBytes, byYear };
}
