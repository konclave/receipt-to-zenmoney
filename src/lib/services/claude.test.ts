import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Category } from '$lib/types'

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn()
}))

import Anthropic from '@anthropic-ai/sdk'
import { parseReceipt } from './claude'

const CATEGORIES: Category[] = [
  { id: 'c1', title: 'Groceries', parentId: null, syncedAt: 1000 },
  { id: 'c2', title: 'Transport', parentId: null, syncedAt: 1000 }
]

const PARSE_RESULT = {
  amount: 1250,
  currency: 'RUB',
  merchant: 'Magnit',
  categoryId: 'c1',
  date: '2026-05-05',
  confidence: 'high'
}

function mockAnthropic(responseText: string) {
  const createMock = vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: responseText }]
  })
  vi.mocked(Anthropic).mockImplementation(
    function() {
      return { messages: { create: createMock } } as unknown as InstanceType<typeof Anthropic>
    }
  )
  return createMock
}

beforeEach(() => vi.mocked(Anthropic).mockClear())

describe('parseReceipt', () => {
  it('calls claude-sonnet-4-6 with image and category list', async () => {
    const createMock = mockAnthropic(JSON.stringify(PARSE_RESULT))
    await parseReceipt('base64img', CATEGORIES, 'sk-test')

    const call = createMock.mock.calls[0][0]
    expect(call.model).toBe('claude-sonnet-4-6')
    expect(call.messages[0].content[0].type).toBe('image')
    expect(call.messages[0].content[0].source.data).toBe('base64img')
    expect(call.messages[0].content[1].text).toContain('c1: Groceries')
    expect(call.messages[0].content[1].text).toContain('c2: Transport')
  })

  it('returns parsed JSON from Claude response', async () => {
    mockAnthropic(JSON.stringify(PARSE_RESULT))
    const result = await parseReceipt('img', CATEGORIES, 'sk-test')
    expect(result.amount).toBe(1250)
    expect(result.merchant).toBe('Magnit')
    expect(result.confidence).toBe('high')
  })

  it('throws when Claude returns invalid JSON', async () => {
    mockAnthropic('not json at all')
    await expect(parseReceipt('img', CATEGORIES, 'key')).rejects.toThrow()
  })
})
