// src/lib/db/transactions.ts
import { getDb } from './index';
import type { Transaction } from '$lib/types';

export async function getTransactions(): Promise<Transaction[]> {
  const db = await getDb();
  const all = await db.getAllFromIndex('transactions', 'by-date');
  return all.reverse();
}

export async function saveTransaction(transaction: Transaction): Promise<void> {
  const db = await getDb();
  await db.put('transactions', transaction);
}

export async function updateTransaction(id: string, updates: Partial<Transaction>): Promise<void> {
  const db = await getDb();
  const existing = await db.get('transactions', id);
  if (!existing) throw new Error(`Transaction ${id} not found`);
  await db.put('transactions', { ...existing, ...updates });
}

export async function bulkInsertTransactions(transactions: Transaction[]): Promise<void> {
  if (transactions.length === 0) return;
  const db = await getDb();
  const tx = db.transaction('transactions', 'readwrite');
  // uses put() — callers must pre-filter duplicates if insert-only semantics are needed
  await Promise.all(transactions.map((t) => tx.store.put(t)));
  await tx.done;
}
