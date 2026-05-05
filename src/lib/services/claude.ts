import Anthropic from '@anthropic-ai/sdk'
import type { Category, ParseResult } from '$lib/types'

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
  return JSON.parse(text) as ParseResult
}
