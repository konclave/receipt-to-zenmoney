import type { Category, Transaction, ZenMoneySyncResponse } from '$lib/types'

const BASE_URL = 'https://api.zenmoney.ru'

export async function syncDiff(
  token: string,
  serverTimestamp: number,
  transactions: object[] = []
): Promise<ZenMoneySyncResponse> {
  const response = await fetch(`${BASE_URL}/v8/diff`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      currentClientTimestamp: Math.floor(Date.now() / 1000),
      serverTimestamp,
      transaction: transactions
    })
  })
  if (!response.ok) {
    throw new Error(`ZenMoney API error: ${response.status} ${response.statusText}`)
  }
  return response.json()
}

export function mapResponseToCategories(response: ZenMoneySyncResponse): Category[] {
  const now = Date.now()
  return response.tag.map((tag) => ({
    id: tag.id,
    title: tag.title,
    parentId: tag.parent,
    syncedAt: now
  }))
}

export function buildTransactionPayload(tx: Transaction, accountId: string, userId: number): object {
  return {
    id: tx.id,
    user: userId,
    date: tx.date,
    created: Math.floor(tx.createdAt / 1000),
    changed: Math.floor(tx.createdAt / 1000),
    income: 0,
    incomeAccount: accountId,
    outcome: tx.amount,
    outcomeAccount: accountId,
    tag: tx.categoryId ? [tx.categoryId] : [],
    comment: tx.merchant,
    deleted: false
  }
}
