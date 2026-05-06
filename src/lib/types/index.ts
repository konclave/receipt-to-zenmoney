export interface PendingCapture {
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
}

export interface Category {
  id: string
  title: string
  parentId: string | null
  syncedAt: number
}

export interface Transaction {
  id: string
  zenmoneyId: string | null
  amount: number
  currency: string
  merchant: string
  categoryId: string
  date: string
  status: 'pending' | 'submitted' | 'failed'
  createdAt: number
}

export interface ParseResult {
  amount: number
  currency: string
  merchant: string
  categoryId: string
  date: string
  confidence: 'high' | 'medium' | 'low'
}

export interface Settings {
  claudeApiKey: string
  zenmoneyToken: string
  zenmoneyServerTimestamp: number
  zenmoneyAccountId: string
}

export interface ZenMoneyTag {
  id: string
  title: string
  parent: string | null
}

export interface ZenMoneyAccount {
  id: string
  title: string
}

export interface ZenMoneySyncResponse {
  serverTimestamp: number
  tag: ZenMoneyTag[]
  account: ZenMoneyAccount[]
}
