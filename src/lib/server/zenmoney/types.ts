export interface ZenMoneyTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface ZenMoneySessionRecord {
  sessionId: string;
  refreshToken: string;
  accessToken: string | null;
  accessTokenExpiresAt: number;
  createdAt: number;
  updatedAt: number;
  absoluteExpiresAt: number;
}
