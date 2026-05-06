import Anthropic from '@anthropic-ai/sdk'
import type { Category, ParseResult } from '$lib/types'

function validateParseResult(raw: unknown): ParseResult {
  const r = raw as Record<string, unknown>
  if (typeof r.amount !== 'number' || !isFinite(r.amount) || r.amount <= 0)
    throw new Error(`Invalid parse result: amount must be a positive number, got ${r.amount}`)
  if (typeof r.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(r.date))
    throw new Error(`Invalid parse result: date must be YYYY-MM-DD, got ${r.date}`)
  if (typeof r.merchant !== 'string' || r.merchant.trim() === '')
    throw new Error('Invalid parse result: merchant must be a non-empty string')
  if (!['high', 'medium', 'low'].includes(r.confidence as string))
    throw new Error(`Invalid parse result: confidence must be high/medium/low, got ${r.confidence}`)
  if (typeof r.currency !== 'string' || r.currency.trim() === '')
    throw new Error('Invalid parse result: currency must be a non-empty string')
  return raw as ParseResult
}

export async function parseReceipt(
  imageBase64: string,
  categories: Category[],
  apiKey: string
): Promise<ParseResult> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true })
  const categoryList = categories.map((c) => `${c.id}: ${c.title}`).join('\n')
  const today = new Date().toISOString().slice(0, 10)

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 }
          },
          {
            type: 'text',
            text: `Extract from this receipt:
- total amount paid (number only, no currency symbol)
- currency code (ISO 4217, e.g. RUB)
- merchant/store name
- best matching category ID from this list:
${categoryList}
- transaction date (ISO 8601, use today ${today} if not visible)

Respond ONLY with valid JSON, no markdown:
{"amount":number,"currency":"string","merchant":"string","categoryId":"string","date":"string","confidence":"high"|"medium"|"low"}`
          }
        ]
      }
    ]
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return validateParseResult(JSON.parse(text))
}
