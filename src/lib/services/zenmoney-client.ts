import { getConfiguredZenmoneyToken, getZenmoneyAuthMode } from './zenmoney-access';

function isUnauthorized(error: unknown): boolean {
  return error instanceof Error && error.message.includes('401');
}

export async function runZenmoneyRequest<T>(
  tokenProvider: (forceRefresh?: boolean) => Promise<string>,
  authModeProvider: () => Promise<'manual' | 'oauth'>,
  request: (token: string) => Promise<T>,
): Promise<T> {
  try {
    return await request(await tokenProvider(false));
  } catch (error) {
    if (!isUnauthorized(error)) throw error;
  }

  if ((await authModeProvider()) !== 'oauth') {
    throw new Error('Zenmoney API error: 401 Unauthorized');
  }

  return request(await tokenProvider(true));
}

export async function runZenmoneyRequestWithStoredToken<T>(
  request: (token: string) => Promise<T>,
): Promise<T> {
  return runZenmoneyRequest(getConfiguredZenmoneyToken, getZenmoneyAuthMode, request);
}
