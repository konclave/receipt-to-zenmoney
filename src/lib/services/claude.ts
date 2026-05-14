import Anthropic from '@anthropic-ai/sdk';
import type { Category, ParseResult, ReceiptBounds } from '$lib/types';

export type AiConfig =
  | { provider: 'anthropic'; apiKey: string }
  | { provider: 'openrouter'; apiKey: string; model: string };

function normalizeReceiptBounds(value: unknown): ReceiptBounds | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return null;

  const bounds = value as Record<string, unknown>;
  const x = bounds.x;
  const y = bounds.y;
  const w = bounds.w;
  const h = bounds.h;

  if (
    typeof x !== 'number' ||
    !isFinite(x) ||
    x < 0 ||
    x > 1 ||
    typeof y !== 'number' ||
    !isFinite(y) ||
    y < 0 ||
    y > 1 ||
    typeof w !== 'number' ||
    !isFinite(w) ||
    w < 0 ||
    w > 1 ||
    typeof h !== 'number' ||
    !isFinite(h) ||
    h < 0 ||
    h > 1
  ) {
    return null;
  }

  if (w <= 0 || h <= 0) return null;
  if (x + w > 1 || y + h > 1) return null;

  return { x, y, w, h };
}

function validateParseResult(raw: unknown): ParseResult {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw))
    throw new Error('Invalid parse result: expected a JSON object');
  const r = raw as Record<string, unknown>;
  if (typeof r.amount !== 'number' || !isFinite(r.amount) || r.amount <= 0)
    throw new Error(`Invalid parse result: amount must be a positive number, got ${r.amount}`);
  if (
    typeof r.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(r.date) ||
    isNaN(new Date(r.date).getTime())
  )
    throw new Error(`Invalid parse result: date must be a valid YYYY-MM-DD date, got ${r.date}`);
  if (typeof r.merchant !== 'string' || r.merchant.trim() === '')
    throw new Error(
      `Invalid parse result: merchant must be a non-empty string, got ${JSON.stringify(r.merchant)}`,
    );
  if (typeof r.categoryId !== 'string' || r.categoryId.trim() === '')
    throw new Error(
      `Invalid parse result: categoryId must be a non-empty string, got ${JSON.stringify(r.categoryId)}`,
    );
  if (!['high', 'medium', 'low'].includes(r.confidence as string))
    throw new Error(
      `Invalid parse result: confidence must be high/medium/low, got ${r.confidence}`,
    );
  if (typeof r.currency !== 'string' || r.currency.trim() === '')
    throw new Error(
      `Invalid parse result: currency must be a non-empty string, got ${JSON.stringify(r.currency)}`,
    );
  r.receipt_bounds = normalizeReceiptBounds(r.receipt_bounds);
  return raw as ParseResult;
}

function buildPrompt(categories: Category[]): string {
  const categoryList = categories.map((c) => `${c.id}: ${c.title}`).join('\n');
  const today = new Date().toISOString().slice(0, 10);
  return `Extract from this receipt:
- total amount paid (number only, no currency symbol)
- currency code (ISO 4217, e.g. RUB)
- merchant/store name
- best matching category ID from this list:
${categoryList}
- transaction date (ISO 8601, use today ${today} if not visible)
- receipt bounding box as fractions of image size (x, y, w, h each 0.0–1.0, tightest rectangle around the receipt); set to null if the receipt boundary cannot be determined

Respond ONLY with valid JSON, no markdown:
{"amount":number,"currency":"string","merchant":"string","categoryId":"string","date":"string","confidence":"high"|"medium"|"low","receipt_bounds":{"x":number,"y":number,"w":number,"h":number}|null}`;
}

async function parseReceiptAnthropic(
  imageBase64: string,
  categories: Category[],
  apiKey: string,
): Promise<ParseResult> {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: imageBase64,
            },
          },
          { type: 'text', text: buildPrompt(categories) },
        ],
      },
    ],
  });
  const text = response.content[0].type === 'text' ? response.content[0].text : '';
  return validateParseResult(JSON.parse(text));
}

async function parseReceiptOpenRouter(
  imageBase64: string,
  categories: Category[],
  apiKey: string,
  model: string,
): Promise<ParseResult> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
            },
            { type: 'text', text: buildPrompt(categories) },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText);
    throw new Error(`OpenRouter API error ${response.status}: ${err}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content ?? '';
  const text = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
  return validateParseResult(JSON.parse(text));
}

export async function parseReceipt(
  imageBase64: string,
  categories: Category[],
  config: AiConfig,
): Promise<ParseResult> {
  if (config.provider === 'openrouter') {
    return parseReceiptOpenRouter(imageBase64, categories, config.apiKey, config.model);
  }
  return parseReceiptAnthropic(imageBase64, categories, config.apiKey);
}
