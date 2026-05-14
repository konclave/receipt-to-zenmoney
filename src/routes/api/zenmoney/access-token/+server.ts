import { json } from '@sveltejs/kit';
import type { Cookies } from '@sveltejs/kit';
import { getZenmoneyServerConfig } from '$lib/server/zenmoney/config';
import { SESSION_COOKIE, SESSION_IDLE_TTL_SECONDS } from '$lib/server/zenmoney/cookies';
import { decryptRefreshToken, encryptRefreshToken } from '$lib/server/zenmoney/crypto';
import { buildRefreshBody, isAccessTokenStale, TOKEN_URL } from '$lib/server/zenmoney/oauth';
import { deleteSession, getSession, saveSession } from '$lib/server/zenmoney/session-store';
import type { ZenmoneyTokenResponse } from '$lib/server/zenmoney/types';

export const GET = async ({
  cookies,
  fetch,
}: {
  cookies: Cookies;
  fetch: typeof globalThis.fetch;
}) => {
  const config = getZenmoneyServerConfig();
  if (!config.oauthEnabled) {
    return json({ message: 'OAuth disabled' }, { status: 404 });
  }

  const sessionId = cookies.get(SESSION_COOKIE);
  if (!sessionId) {
    return json({ message: 'Not connected' }, { status: 401 });
  }

  const session = await getSession(sessionId);
  if (!session || session.absoluteExpiresAt <= Date.now()) {
    cookies.delete(SESSION_COOKIE, { path: '/' });
    return json({ message: 'Session expired' }, { status: 401 });
  }

  if (isAccessTokenStale(session.accessTokenExpiresAt)) {
    const refreshToken = await decryptRefreshToken(session.refreshToken, config.tokenEncryptionKey);
    const refreshResponse = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: buildRefreshBody({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        refreshToken,
      }),
    });

    if (!refreshResponse.ok) {
      await deleteSession(sessionId);
      cookies.delete(SESSION_COOKIE, { path: '/' });
      return json({ message: 'Refresh failed' }, { status: 401 });
    }

    const tokenData = (await refreshResponse.json()) as ZenmoneyTokenResponse;
    session.accessToken = tokenData.access_token;
    session.accessTokenExpiresAt = Date.now() + tokenData.expires_in * 1000;
    if (tokenData.refresh_token) {
      session.refreshToken = await encryptRefreshToken(
        tokenData.refresh_token,
        config.tokenEncryptionKey,
      );
    }
    session.updatedAt = Date.now();
    await saveSession(session);
  }

  cookies.set(SESSION_COOKIE, sessionId, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: SESSION_IDLE_TTL_SECONDS,
  });

  return json({
    accessToken: session.accessToken,
    expiresAt: session.accessTokenExpiresAt,
  });
};
