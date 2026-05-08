import {
  PUBLIC_ZENMONEY_CLIENT_ID,
  PUBLIC_ZENMONEY_CLIENT_SECRET,
  PUBLIC_ZENMONEY_REDIRECT_URI,
} from '$env/static/public';

const AUTH_URL = 'https://api.zenmoney.ru/oauth2/authorize/';
const TOKEN_URL = 'https://api.zenmoney.ru/oauth2/token/';

export const oauthConfigured =
  Boolean(PUBLIC_ZENMONEY_CLIENT_ID) && Boolean(PUBLIC_ZENMONEY_CLIENT_SECRET);

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: PUBLIC_ZENMONEY_CLIENT_ID,
    redirect_uri: PUBLIC_ZENMONEY_REDIRECT_URI,
    response_type: 'code',
    state,
  });
  return `${AUTH_URL}?${params}`;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: PUBLIC_ZENMONEY_CLIENT_ID,
      client_secret: PUBLIC_ZENMONEY_CLIENT_SECRET,
      redirect_uri: PUBLIC_ZENMONEY_REDIRECT_URI,
      code,
      grant_type: 'authorization_code',
    }),
  });
  if (!response.ok) throw new Error(`Token exchange failed: ${response.status}`);
  const data = (await response.json()) as { access_token: string };
  return data.access_token;
}
