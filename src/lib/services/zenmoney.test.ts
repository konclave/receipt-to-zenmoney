import { describe, it, expect, vi, beforeEach } from 'vitest'
import { syncDiff, mapResponseToCategories, buildTransactionPayload } from './zenmoney'
import type { ZenMoneySyncResponse, Transaction } from '$lib/types'

const MOCK_RESPONSE: ZenMoneySyncResponse = {
  serverTimestamp: 1746441600,
  tag: [
    { id: 'tag-1', title: 'Groceries', parent: null },
    { id: 'tag-2', title: 'Transport', parent: null },
    { id: 'tag-3', title: 'Bus', parent: 'tag-2' }
  ],
  account: [{ id: 'acc-1', title: 'Cash' }]
}

beforeEach(() => vi.restoreAllMocks())

describe('syncDiff', () => {
  it('POSTs to /v8/diff with Bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_RESPONSE)
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncDiff('my-token', 0)

    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.zenmoney.ru/v8/diff')
    expect(options.method).toBe('POST')
    expect(options.headers['Authorization']).toBe('Bearer my-token')
  })

  it('includes serverTimestamp in request body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_RESPONSE)
    })
    vi.stubGlobal('fetch', fetchMock)

    await syncDiff('token', 12345)
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.serverTimestamp).toBe(12345)
  })

  it('throws on non-OK response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 401, statusText: 'Unauthorized' })
    )
    await expect(syncDiff('bad', 0)).rejects.toThrow('401')
  })

  it('returns the parsed JSON response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_RESPONSE)
    }))
    const result = await syncDiff('token', 0)
    expect(result.serverTimestamp).toBe(1746441600)
    expect(result.tag).toHaveLength(3)
  })
})

describe('mapResponseToCategories', () => {
  it('maps ZM tags to Category objects', () => {
    const result = mapResponseToCategories(MOCK_RESPONSE)
    expect(result).toHaveLength(3)
    expect(result[0]).toMatchObject({ id: 'tag-1', title: 'Groceries', parentId: null })
    expect(result[2]).toMatchObject({ id: 'tag-3', parentId: 'tag-2' })
  })

  it('sets syncedAt to approximately now', () => {
    const before = Date.now()
    const result = mapResponseToCategories(MOCK_RESPONSE)
    expect(result[0].syncedAt).toBeGreaterThanOrEqual(before)
    expect(result[0].syncedAt).toBeLessThanOrEqual(Date.now())
  })
})

describe('buildTransactionPayload', () => {
  it('builds correct ZenMoney transaction object', () => {
    const tx: Transaction = {
      id: 'local-uuid',
      zenmoneyId: null,
      amount: 1250,
      currency: 'RUB',
      merchant: 'Magnit',
      categoryId: 'tag-1',
      date: '2026-05-05',
      status: 'pending',
      createdAt: 1000
    }
    const payload = buildTransactionPayload(tx, 'acc-1')
    expect(payload).toMatchObject({
      id: 'local-uuid',
      date: '2026-05-05',
      income: 0,
      outcome: 1250,
      outcomeAccount: 'acc-1',
      tag: ['tag-1'],
      comment: 'Magnit',
      deleted: false
    })
  })
})
