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
  accountId?: string
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
  zenmoneyUserId: number
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

export interface ZenMoneyUser {
  id: number
}

export interface ZenMoneySyncResponse {
  serverTimestamp: number
  user: ZenMoneyUser[]
  tag: ZenMoneyTag[]
  account: ZenMoneyAccount[]
}
