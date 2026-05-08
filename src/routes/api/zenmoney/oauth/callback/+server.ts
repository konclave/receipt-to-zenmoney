import { randomUUID } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { getZenMoneyServerConfig } from '$lib/server/zenmoney/config';
import {
  SESSION_COOKIE,
  SESSION_IDLE_TTL_SECONDS,
  STATE_COOKIE,
} from '$lib/server/zenmoney/cookies';
import { encryptRefreshToken } from '$lib/server/zenmoney/crypto';
import { buildTokenExchangeBody, TOKEN_URL } from '$lib/server/zenmoney/oauth';
import { buildNewSession, saveSession } from '$lib/server/zenmoney/session-store';
import type { ZenMoneyTokenResponse } from '$lib/server/zenmoney/types';

export const GET = async ({
  cookies,
  fetch,
  url,
}: {
  cookies: Cookies;
  fetch: typeof globalThis.fetch;
  url: URL;
}) => {
  const config = getZenMoneyServerConfig();
  if (!config.oauthEnabled) {
    return new Response(null, {
      status: 302,
      headers: { location: '/settings?zenmoneyAuthError=disabled' },
    });
  }

  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  const expectedState = cookies.get(STATE_COOKIE);

  cookies.delete(STATE_COOKIE, { path: '/' });

  if (!state || !code || state !== expectedState) {
    return new Response(null, {
      status: 302,
      headers: { location: '/settings?zenmoneyAuthError=state' },
    });
  }

  const tokenResponse = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: buildTokenExchangeBody({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      redirectUri: config.redirectUri,
      code,
    }),
  });

  if (!tokenResponse.ok) {
    return new Response(null, {
      status: 302,
      headers: { location: '/settings?zenmoneyAuthError=exchange' },
    });
  }

  const tokenData = (await tokenResponse.json()) as ZenMoneyTokenResponse;
  const sessionId = randomUUID();
  const expiresAt = Date.now() + tokenData.expires_in * 1000;

  await saveSession(
    buildNewSession({
      sessionId,
      refreshToken: await encryptRefreshToken(tokenData.refresh_token, config.tokenEncryptionKey),
      accessToken: tokenData.access_token,
      accessTokenExpiresAt: expiresAt,
    }),
  );

  cookies.set(SESSION_COOKIE, sessionId, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: SESSION_IDLE_TTL_SECONDS,
  });

  return new Response(null, {
    status: 302,
    headers: { location: '/oauth/callback' },
  });
};
