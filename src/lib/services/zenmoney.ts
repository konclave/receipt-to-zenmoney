import type { Category, Transaction, ZenmoneySyncResponse } from "$lib/types";

const BASE_URL = "https://api.zenmoney.ru";

export async function syncDiff(
  token: string,
  serverTimestamp: number,
  transactions: object[] = [],
): Promise<ZenmoneySyncResponse> {
  const response = await fetch(`${BASE_URL}/v8/diff`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      currentClientTimestamp: Math.floor(Date.now() / 1000),
      serverTimestamp,
      transaction: transactions,
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Zenmoney API error: ${response.status} ${response.statusText}`,
    );
  }
  return response.json();
}

export function mapResponseToCategories(
  response: ZenmoneySyncResponse,
): Category[] {
  const now = Date.now();
  return response.tag.map((tag) => ({
    id: tag.id,
    title: tag.title,
    parentId: tag.parent,
    syncedAt: now,
  }));
}

export function buildTransactionPayload(
  tx: Transaction,
  accountId: string,
  userId: number,
  instrumentId: number,
): object {
  return {
    id: tx.id,
    user: userId,
    date: tx.date,
    created: Math.floor(tx.createdAt / 1000),
    changed: Math.floor(tx.createdAt / 1000),
    income: 0,
    incomeAccount: accountId,
    incomeInstrument: instrumentId,
    outcome: tx.amount,
    outcomeAccount: accountId,
    outcomeInstrument: instrumentId,
    tag: tx.categoryId ? [tx.categoryId] : [],
    comment: tx.merchant,
    deleted: false,
    viewed: false,
    hold: false,
    qrCode: null,
    originalPayee: null,
    payee: null,
    opIncome: null,
    opOutcome: null,
    opIncomeInstrument: null,
    opOutcomeInstrument: null,
    latitude: null,
    longitude: null,
    merchant: null,
    incomeBankID: null,
    outcomeBankID: null,
    reminderMarker: null,
  };
}
