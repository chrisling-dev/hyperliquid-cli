import { secureStateDirectory, secureStateFile } from "../private-state.js"
import Database from "better-sqlite3"
import { chmodSync, existsSync } from "node:fs"
import { HL_DIR, DB_PATH } from "../paths.js"

let db: Database.Database | null = null

/**
 * Get or create the database connection
 */
export function getDb(): Database.Database {
  if (db) {
    return db
  }

  // Ensure the directory exists
  secureStateDirectory(HL_DIR)
  secureStateFile(DB_PATH)
  secureStateFile(`${DB_PATH}.pre-v1`)

  db = new Database(DB_PATH)
  chmodSync(DB_PATH, 0o600)
  db.pragma("busy_timeout = 5000")

  // Enable foreign keys
  db.pragma("foreign_keys = ON")

  // Run migrations
  runMigrations(db)

  return db
}

/**
 * Close the database connection
 */
export function closeDb(): void {
  if (db) {
    db.close()
    db = null
  }
}

/**
 * Run database migrations
 */
function runMigrations(db: Database.Database): void {
  // Create migrations table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    )
  `)

  const migrations = [
    {
      name: "001_create_accounts",
      sql: `
        CREATE TABLE IF NOT EXISTS accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          alias TEXT NOT NULL UNIQUE,
          user_address TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('readonly', 'api_wallet')),
          source TEXT NOT NULL DEFAULT 'cli_import',
          api_wallet_private_key TEXT,
          api_wallet_public_key TEXT,
          is_default INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
          updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        );

        -- Index for quick default account lookup
        CREATE INDEX IF NOT EXISTS idx_accounts_is_default ON accounts(is_default);

        -- Index for user address lookups
        CREATE INDEX IF NOT EXISTS idx_accounts_user_address ON accounts(user_address);
      `,
    },
    {
      name: "002_master_accounts_and_nonces",
      sql: `
        ALTER TABLE accounts RENAME TO accounts_old;
        CREATE TABLE accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT, alias TEXT NOT NULL UNIQUE,
          user_address TEXT NOT NULL, type TEXT NOT NULL CHECK(type IN ('readonly','api_wallet','master')),
          source TEXT NOT NULL DEFAULT 'cli_import', api_wallet_private_key TEXT,
          api_wallet_public_key TEXT, is_default INTEGER NOT NULL DEFAULT 0,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
          updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
        );
        INSERT INTO accounts SELECT * FROM accounts_old;
        DROP TABLE accounts_old;
        CREATE INDEX idx_accounts_is_default ON accounts(is_default);
        CREATE INDEX idx_accounts_user_address ON accounts(user_address);
        CREATE TABLE nonces (signer TEXT PRIMARY KEY, value INTEGER NOT NULL);
      `,
    },
  ]

  const appliedMigrations = db.prepare("SELECT name FROM migrations").all() as {
    name: string
  }[]
  const appliedNames = new Set(appliedMigrations.map((m) => m.name))

  for (const migration of migrations) {
    if (!appliedNames.has(migration.name)) {
      if (
        migration.name === "002_master_accounts_and_nonces" &&
        existsSync(DB_PATH) &&
        !existsSync(`${DB_PATH}.pre-v1`)
      ) {
        db.prepare("VACUUM INTO ?").run(`${DB_PATH}.pre-v1`)
        chmodSync(`${DB_PATH}.pre-v1`, 0o600)
      }
      db.transaction(() => {
        if (
          db
            .prepare("SELECT 1 FROM migrations WHERE name = ?")
            .get(migration.name)
        )
          return
        db.exec(migration.sql)
        db.prepare("INSERT INTO migrations (name) VALUES (?)").run(
          migration.name,
        )
      }).immediate()
    }
  }
}

export * from "./accounts.js"
