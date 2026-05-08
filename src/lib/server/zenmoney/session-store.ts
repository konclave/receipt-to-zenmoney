import { SESSION_ABSOLUTE_TTL_MS, SESSION_IDLE_TTL_SECONDS } from './cookies';
import type { ZenMoneySessionRecord } from './types';

type KvLike = {
  set: (key: string, value: unknown, options?: { ex?: number }) => Promise<unknown>;
  get: <T>(key: string) => Promise<T | null>;
  del: (key: string) => Promise<unknown>;
};

const memoryStore = new Map<string, unknown>();

const fallbackKv: KvLike = {
  async set(key, value) {
    memoryStore.set(key, value);
  },
  async get<T>(key: string) {
    return (memoryStore.get(key) as T | undefined) ?? null;
  },
  async del(key: string) {
    memoryStore.delete(key);
  },
};

const loadModule = new Function(
  'specifier',
  'return import(specifier)',
) as (specifier: string) => Promise<{ kv: KvLike }>;

async function getKvClient(): Promise<KvLike> {
  try {
    const mod = await loadModule('@vercel/kv');
    return mod.kv as KvLike;
  } catch {
    return fallbackKv;
  }
}

function sessionKey(sessionId: string): string {
  return `zenmoney:session:${sessionId}`;
}

export async function saveSession(record: ZenMoneySessionRecord): Promise<void> {
  const kv = await getKvClient();
  await kv.set(sessionKey(record.sessionId), record, { ex: SESSION_IDLE_TTL_SECONDS });
}

export async function getSession(sessionId: string): Promise<ZenMoneySessionRecord | null> {
  const kv = await getKvClient();
  return (await kv.get<ZenMoneySessionRecord>(sessionKey(sessionId))) ?? null;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const kv = await getKvClient();
  await kv.del(sessionKey(sessionId));
}

export function buildNewSession(input: {
  sessionId: string;
  refreshToken: string;
  accessToken: string;
  accessTokenExpiresAt: number;
  now?: number;
}): ZenMoneySessionRecord {
  const now = input.now ?? Date.now();
  return {
    sessionId: input.sessionId,
    refreshToken: input.refreshToken,
    accessToken: input.accessToken,
    accessTokenExpiresAt: input.accessTokenExpiresAt,
    createdAt: now,
    updatedAt: now,
    absoluteExpiresAt: now + SESSION_ABSOLUTE_TTL_MS,
  };
}
