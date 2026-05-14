export interface PendingCapture {
  imageBase64: string;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
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
  status: "pending" | "submitted" | "failed";
  createdAt: number;
  hasReceipt?: boolean;
}

export interface ReceiptImage {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  blob: Blob;
}

export interface ReceiptBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ParseResult {
  amount: number;
  currency: string;
  merchant: string;
  categoryId: string;
  date: string;
  confidence: "high" | "medium" | "low";
  receipt_bounds: ReceiptBounds | null;
}

export interface Settings {
  claudeApiKey: string;
  zenmoneyToken: string;
  zenmoneyAccessToken: string;
  zenmoneyAccessTokenExpiresAt: number;
  zenmoneyServerTimestamp: number;
  zenmoneyAccountId: string;
  zenmoneyUserId: number;
  aiProvider: "anthropic" | "openrouter";
  openrouterApiKey: string;
  openrouterModel: string;
}

export interface ZenmoneyTag {
  id: string;
  title: string;
  parent: string | null;
}

export interface ZenmoneyAccount {
  id: string;
  title: string;
}

export interface ZenmoneyUser {
  id: number;
}

export interface ZenmoneyInstrument {
  id: number;
  shortTitle: string;
}

export interface ZenmoneySyncResponse {
  serverTimestamp: number;
  user: ZenmoneyUser[];
  instrument: ZenmoneyInstrument[];
  tag: ZenmoneyTag[];
  account: ZenmoneyAccount[];
}
