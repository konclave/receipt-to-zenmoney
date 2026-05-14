export interface ZenmoneyTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export interface ZenmoneySessionRecord {
  sessionId: string;
  refreshToken: string;
  accessToken: string | null;
  accessTokenExpiresAt: number;
  createdAt: number;
  updatedAt: number;
  absoluteExpiresAt: number;
}
