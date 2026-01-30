import type { Address, Hex } from "viem"
import { getDb } from "./index.js"

/**
 * Account types
 */
export type AccountType = "readonly" | "api_wallet"
export type AccountSource = "cli_import" // Future: "web", etc.

/**
 * Account interface
 */
export interface Account {
  id: number
  alias: string
  userAddress: Address
  type: AccountType
  source: AccountSource
  apiWalletPrivateKey: Hex | null
  apiWalletPublicKey: Address | null
  isDefault: boolean
  createdAt: number
  updatedAt: number
}

/**
 * Database row representation
 */
interface AccountRow {
  id: number
  alias: string
  user_address: string
  type: string
  source: string
  api_wallet_private_key: string | null
  api_wallet_public_key: string | null
  is_default: number
  created_at: number
  updated_at: number
}

/**
 * Convert database row to Account object
 */
function rowToAccount(row: AccountRow): Account {
  return {
    id: row.id,
    alias: row.alias,
    userAddress: row.user_address as Address,
    type: row.type as AccountType,
    source: row.source as AccountSource,
    apiWalletPrivateKey: row.api_wallet_private_key as Hex | null,
    apiWalletPublicKey: row.api_wallet_public_key as Address | null,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Input for creating an account
 */
export interface CreateAccountInput {
  alias: string
  userAddress: Address
  type: AccountType
  source?: AccountSource
  apiWalletPrivateKey?: Hex
  apiWalletPublicKey?: Address
  setAsDefault?: boolean
}

/**
 * Create a new account
 */
export function createAccount(input: CreateAccountInput): Account {
  const db = getDb()

  // If this is the first account or setAsDefault is true, make it default
  const accountCount = db.prepare("SELECT COUNT(*) as count FROM accounts").get() as { count: number }
  const shouldBeDefault = accountCount.count === 0 || input.setAsDefault

  // If setting as default, unset current default first
  if (shouldBeDefault) {
    db.prepare("UPDATE accounts SET is_default = 0 WHERE is_default = 1").run()
  }

  const result = db.prepare(`
    INSERT INTO accounts (
      alias,
      user_address,
      type,
      source,
      api_wallet_private_key,
      api_wallet_public_key,
      is_default
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    input.alias,
    input.userAddress,
    input.type,
    input.source || "cli_import",
    input.apiWalletPrivateKey || null,
    input.apiWalletPublicKey || null,
    shouldBeDefault ? 1 : 0
  )

  return getAccountById(Number(result.lastInsertRowid))!
}

/**
 * Get an account by ID
 */
export function getAccountById(id: number): Account | null {
  const db = getDb()
  const row = db.prepare("SELECT * FROM accounts WHERE id = ?").get(id) as AccountRow | undefined
  return row ? rowToAccount(row) : null
}

/**
 * Get an account by alias
 */
export function getAccountByAlias(alias: string): Account | null {
  const db = getDb()
  const row = db.prepare("SELECT * FROM accounts WHERE alias = ?").get(alias) as AccountRow | undefined
  return row ? rowToAccount(row) : null
}

/**
 * Get the default account
 */
export function getDefaultAccount(): Account | null {
  const db = getDb()
  const row = db.prepare("SELECT * FROM accounts WHERE is_default = 1").get() as AccountRow | undefined
  return row ? rowToAccount(row) : null
}

/**
 * Get all accounts
 */
export function getAllAccounts(): Account[] {
  const db = getDb()
  const rows = db.prepare("SELECT * FROM accounts ORDER BY is_default DESC, created_at ASC").all() as AccountRow[]
  return rows.map(rowToAccount)
}

/**
 * Set an account as default by alias
 */
export function setDefaultAccount(alias: string): Account {
  const db = getDb()

  // Check if account exists
  const account = getAccountByAlias(alias)
  if (!account) {
    throw new Error(`Account with alias "${alias}" not found`)
  }

  // Unset current default
  db.prepare("UPDATE accounts SET is_default = 0 WHERE is_default = 1").run()

  // Set new default
  db.prepare("UPDATE accounts SET is_default = 1, updated_at = strftime('%s', 'now') WHERE alias = ?").run(alias)

  return getAccountByAlias(alias)!
}

/**
 * Delete an account by alias
 */
export function deleteAccount(alias: string): boolean {
  const db = getDb()
  const account = getAccountByAlias(alias)
  if (!account) {
    return false
  }

  const wasDefault = account.isDefault
  db.prepare("DELETE FROM accounts WHERE alias = ?").run(alias)

  // If deleted account was default, set the first remaining account as default
  if (wasDefault) {
    const firstAccount = db.prepare("SELECT * FROM accounts ORDER BY created_at ASC LIMIT 1").get() as AccountRow | undefined
    if (firstAccount) {
      db.prepare("UPDATE accounts SET is_default = 1 WHERE id = ?").run(firstAccount.id)
    }
  }

  return true
}

/**
 * Check if an alias is already taken
 */
export function isAliasTaken(alias: string): boolean {
  const db = getDb()
  const row = db.prepare("SELECT 1 FROM accounts WHERE alias = ?").get(alias)
  return row !== undefined
}

/**
 * Update an account's API wallet credentials
 */
export function updateAccountApiWallet(
  alias: string,
  apiWalletPrivateKey: Hex,
  apiWalletPublicKey: Address
): Account {
  const db = getDb()

  const account = getAccountByAlias(alias)
  if (!account) {
    throw new Error(`Account with alias "${alias}" not found`)
  }

  db.prepare(`
    UPDATE accounts
    SET
      api_wallet_private_key = ?,
      api_wallet_public_key = ?,
      type = 'api_wallet',
      updated_at = strftime('%s', 'now')
    WHERE alias = ?
  `).run(apiWalletPrivateKey, apiWalletPublicKey, alias)

  return getAccountByAlias(alias)!
}

/**
 * Get account count
 */
export function getAccountCount(): number {
  const db = getDb()
  const result = db.prepare("SELECT COUNT(*) as count FROM accounts").get() as { count: number }
  return result.count
}
