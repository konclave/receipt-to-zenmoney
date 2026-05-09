import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Category } from '$lib/types';

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(),
}));

import Anthropic from '@anthropic-ai/sdk';
import { parseReceipt } from './claude';

const CATEGORIES: Category[] = [
  { id: 'c1', title: 'Groceries', parentId: null, syncedAt: 1000 },
  { id: 'c2', title: 'Transport', parentId: null, syncedAt: 1000 },
];

const PARSE_RESULT = {
  amount: 1250,
  currency: 'RUB',
  merchant: 'Magnit',
  categoryId: 'c1',
  date: '2026-05-05',
  confidence: 'high',
  receipt_bounds: null,
};

function mockAnthropic(responseText: string) {
  const createMock = vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: responseText }],
  });
  vi.mocked(Anthropic).mockImplementation(function () {
    return { messages: { create: createMock } } as unknown as InstanceType<typeof Anthropic>;
  });
  return createMock;
}

beforeEach(() => vi.mocked(Anthropic).mockClear());

describe('parseReceipt — Anthropic provider', () => {
  it('calls claude-sonnet-4-6 with image and category list', async () => {
    const createMock = mockAnthropic(JSON.stringify(PARSE_RESULT));
    await parseReceipt('base64img', CATEGORIES, { provider: 'anthropic', apiKey: 'sk-test' });

    const call = createMock.mock.calls[0][0];
    expect(call.model).toBe('claude-sonnet-4-6');
    expect(call.messages[0].content[0].type).toBe('image');
    expect(call.messages[0].content[0].source.data).toBe('base64img');
    expect(call.messages[0].content[1].text).toContain('c1: Groceries');
    expect(call.messages[0].content[1].text).toContain('c2: Transport');
  });

  it('returns parsed JSON from Claude response', async () => {
    mockAnthropic(JSON.stringify(PARSE_RESULT));
    const result = await parseReceipt('img', CATEGORIES, {
      provider: 'anthropic',
      apiKey: 'sk-test',
    });
    expect(result.amount).toBe(1250);
    expect(result.merchant).toBe('Magnit');
    expect(result.confidence).toBe('high');
  });

  it('throws when Claude returns invalid JSON', async () => {
    mockAnthropic('not json at all');
    await expect(
      parseReceipt('img', CATEGORIES, { provider: 'anthropic', apiKey: 'key' }),
    ).rejects.toThrow();
  });

  it('throws when amount is not a positive number', async () => {
    mockAnthropic(JSON.stringify({ ...PARSE_RESULT, amount: -5 }));
    await expect(
      parseReceipt('img', CATEGORIES, { provider: 'anthropic', apiKey: 'key' }),
    ).rejects.toThrow('amount');
  });

  it('throws when amount is zero', async () => {
    mockAnthropic(JSON.stringify({ ...PARSE_RESULT, amount: 0 }));
    await expect(
      parseReceipt('img', CATEGORIES, { provider: 'anthropic', apiKey: 'key' }),
    ).rejects.toThrow('amount');
  });

  it('throws when date is not YYYY-MM-DD format', async () => {
    mockAnthropic(JSON.stringify({ ...PARSE_RESULT, date: '05/05/2026' }));
    await expect(
      parseReceipt('img', CATEGORIES, { provider: 'anthropic', apiKey: 'key' }),
    ).rejects.toThrow('date');
  });

  it('throws when merchant is empty string', async () => {
    mockAnthropic(JSON.stringify({ ...PARSE_RESULT, merchant: '' }));
    await expect(
      parseReceipt('img', CATEGORIES, { provider: 'anthropic', apiKey: 'key' }),
    ).rejects.toThrow('merchant');
  });

  it('throws when confidence is not high/medium/low', async () => {
    mockAnthropic(JSON.stringify({ ...PARSE_RESULT, confidence: 'very-high' }));
    await expect(
      parseReceipt('img', CATEGORIES, { provider: 'anthropic', apiKey: 'key' }),
    ).rejects.toThrow('confidence');
  });

  it('throws when currency is empty string', async () => {
    mockAnthropic(JSON.stringify({ ...PARSE_RESULT, currency: '' }));
    await expect(
      parseReceipt('img', CATEGORIES, { provider: 'anthropic', apiKey: 'key' }),
    ).rejects.toThrow('currency');
  });

  it('throws when response is not a JSON object', async () => {
    mockAnthropic('null');
    await expect(
      parseReceipt('img', CATEGORIES, { provider: 'anthropic', apiKey: 'key' }),
    ).rejects.toThrow('expected a JSON object');
  });

  it('throws when amount is a string instead of number', async () => {
    mockAnthropic(JSON.stringify({ ...PARSE_RESULT, amount: '1250' }));
    await expect(
      parseReceipt('img', CATEGORIES, { provider: 'anthropic', apiKey: 'key' }),
    ).rejects.toThrow('amount');
  });

  it('throws when categoryId is empty', async () => {
    mockAnthropic(JSON.stringify({ ...PARSE_RESULT, categoryId: '' }));
    await expect(
      parseReceipt('img', CATEGORIES, { provider: 'anthropic', apiKey: 'key' }),
    ).rejects.toThrow('categoryId');
  });

  it('accepts a valid receipt_bounds object', async () => {
    mockAnthropic(
      JSON.stringify({
        ...PARSE_RESULT,
        receipt_bounds: { x: 0.05, y: 0.1, w: 0.9, h: 0.85 },
      }),
    );
    const result = await parseReceipt('img', CATEGORIES, {
      provider: 'anthropic',
      apiKey: 'sk-test',
    });
    expect(result.receipt_bounds).toEqual({ x: 0.05, y: 0.1, w: 0.9, h: 0.85 });
  });

  it('accepts receipt_bounds: null', async () => {
    mockAnthropic(JSON.stringify({ ...PARSE_RESULT, receipt_bounds: null }));
    const result = await parseReceipt('img', CATEGORIES, {
      provider: 'anthropic',
      apiKey: 'sk-test',
    });
    expect(result.receipt_bounds).toBeNull();
  });

  it('throws when receipt_bounds has a value outside 0–1', async () => {
    mockAnthropic(
      JSON.stringify({
        ...PARSE_RESULT,
        receipt_bounds: { x: 1.5, y: 0.1, w: 0.9, h: 0.85 },
      }),
    );
    await expect(
      parseReceipt('img', CATEGORIES, { provider: 'anthropic', apiKey: 'sk-test' }),
    ).rejects.toThrow('receipt_bounds');
  });

  it('normalizes missing receipt_bounds to null', async () => {
    const { receipt_bounds: _, ...withoutBounds } = PARSE_RESULT;
    mockAnthropic(JSON.stringify(withoutBounds));
    const result = await parseReceipt('img', CATEGORIES, { provider: 'anthropic', apiKey: 'sk-test' });
    expect(result.receipt_bounds).toBeNull();
  });
});

describe('parseReceipt — OpenRouter provider', () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function mockOpenRouter(responseText: string, status = 200) {
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ message: { content: responseText } }] }), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
  }

  it('POSTs to OpenRouter with model, bearer token, and image_url content', async () => {
    mockOpenRouter(JSON.stringify(PARSE_RESULT));
    await parseReceipt('base64img', CATEGORIES, {
      provider: 'openrouter',
      apiKey: 'sk-or-test',
      model: 'openai/gpt-4o',
    });

    expect(fetchSpy).toHaveBeenCalledOnce();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer sk-or-test');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('openai/gpt-4o');
    expect(body.messages[0].content[0].type).toBe('image_url');
    expect(body.messages[0].content[0].image_url.url).toContain('data:image/jpeg;base64,base64img');
    expect(body.messages[0].content[1].text).toContain('c1: Groceries');
  });

  it('returns parsed result from OpenRouter response', async () => {
    mockOpenRouter(JSON.stringify(PARSE_RESULT));
    const result = await parseReceipt('img', CATEGORIES, {
      provider: 'openrouter',
      apiKey: 'sk-or-test',
      model: 'anthropic/claude-sonnet-4.6',
    });
    expect(result.amount).toBe(1250);
    expect(result.merchant).toBe('Magnit');
  });

  it('throws on non-2xx response', async () => {
    fetchSpy.mockResolvedValue(new Response('Unauthorized', { status: 401 }));
    await expect(
      parseReceipt('img', CATEGORIES, {
        provider: 'openrouter',
        apiKey: 'bad',
        model: 'openai/gpt-4o',
      }),
    ).rejects.toThrow('401');
  });

  it('throws when OpenRouter returns invalid JSON in content', async () => {
    mockOpenRouter('not json');
    await expect(
      parseReceipt('img', CATEGORIES, {
        provider: 'openrouter',
        apiKey: 'sk-or',
        model: 'openai/gpt-4o',
      }),
    ).rejects.toThrow();
  });

  it('passes validation — throws when amount is negative', async () => {
    mockOpenRouter(JSON.stringify({ ...PARSE_RESULT, amount: -1 }));
    await expect(
      parseReceipt('img', CATEGORIES, { provider: 'openrouter', apiKey: 'k', model: 'm' }),
    ).rejects.toThrow('amount');
  });
});
