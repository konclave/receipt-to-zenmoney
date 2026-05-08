const AUTH_URL = 'https://api.zenmoney.ru/oauth2/authorize/';
const TOKEN_URL = 'https://api.zenmoney.ru/oauth2/token/';
const REFRESH_WINDOW_MS = 5 * 60_000;

export function buildAuthorizeUrl(input: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const params = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    state: input.state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export function buildTokenExchangeBody(input: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}): URLSearchParams {
  return new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    redirect_uri: input.redirectUri,
    code: input.code,
    grant_type: 'authorization_code',
  });
}

export function buildRefreshBody(input: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): URLSearchParams {
  return new URLSearchParams({
    client_id: input.clientId,
    client_secret: input.clientSecret,
    refresh_token: input.refreshToken,
    grant_type: 'refresh_token',
  });
}

export function isAccessTokenStale(expiresAt: number, now = Date.now()): boolean {
  return !expiresAt || expiresAt - now <= REFRESH_WINDOW_MS;
}

export { TOKEN_URL };
