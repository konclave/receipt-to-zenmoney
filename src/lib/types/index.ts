export interface PendingCapture {
  imageBase64: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
}

export interface Category {
  id: string;
  title: string;
  parentId: string | null;
  syncedAt: number;
}

export interface Transaction {
  id: string;
  zenmoneyId: string | null;
  accountId?: string;
  amount: number;
  currency: string;
  merchant: string;
  categoryId: string;
  date: string;
  status: 'pending' | 'submitted' | 'failed';
  createdAt: number;
  hasReceipt?: boolean;
}

export interface ReceiptImage {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  blob: Blob;
}

export interface ParseResult {
  amount: number;
  currency: string;
  merchant: string;
  categoryId: string;
  date: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface Settings {
  claudeApiKey: string;
  zenmoneyToken: string;
  zenmoneyAccessToken: string;
  zenmoneyAccessTokenExpiresAt: number;
  zenmoneyServerTimestamp: number;
  zenmoneyAccountId: string;
  zenmoneyUserId: number;
  aiProvider: 'anthropic' | 'openrouter';
  openrouterApiKey: string;
  openrouterModel: string;
}

export interface ZenMoneyTag {
  id: string;
  title: string;
  parent: string | null;
}

export interface ZenMoneyAccount {
  id: string;
  title: string;
}

export interface ZenMoneyUser {
  id: number;
}

export interface ZenMoneyInstrument {
  id: number;
  shortTitle: string;
}

export interface ZenMoneySyncResponse {
  serverTimestamp: number;
  user: ZenMoneyUser[];
  instrument: ZenMoneyInstrument[];
  tag: ZenMoneyTag[];
  account: ZenMoneyAccount[];
}
