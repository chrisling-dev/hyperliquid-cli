import { it, expect, vi } from "vitest"
import { mkdtempSync, existsSync, statSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import Database from "better-sqlite3"
it("migrates old accounts without losing credentials; backs up, adds masters, and allocates unique nonces", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hl-db-test-"))
  const path = join(dir, "hl.db")
  const old = new Database(path)
  old.exec(`CREATE TABLE migrations(id INTEGER PRIMARY KEY,name TEXT UNIQUE,applied_at INTEGER);
    INSERT INTO migrations(name) VALUES('001_create_accounts');
    CREATE TABLE accounts(id INTEGER PRIMARY KEY,alias TEXT UNIQUE,user_address TEXT,type TEXT CHECK(type IN ('readonly','api_wallet')),
    source TEXT,api_wallet_private_key TEXT,api_wallet_public_key TEXT,is_default INTEGER,created_at INTEGER,updated_at INTEGER);
    CREATE INDEX idx_accounts_is_default ON accounts(is_default);
    CREATE INDEX idx_accounts_user_address ON accounts(user_address);
    INSERT INTO accounts VALUES(1,'existing','0x0000000000000000000000000000000000000001','api_wallet','cli_import','fixture-secret','fixture-public',1,1,1);`)
  old.close()
  vi.resetModules()
  vi.doMock("../paths.js", () => ({ HL_DIR: dir, DB_PATH: path }))
  const db = await import("./index.js")
  try {
    expect(db.getDefaultAccount()).toMatchObject({
      alias: "existing",
      apiWalletPrivateKey: "fixture-secret",
      isDefault: true,
    })
    expect(existsSync(`${path}.pre-v1`)).toBe(true)
    expect(statSync(path).mode & 0o777).toBe(0o600)
    db.createAccount({
      alias: "master",
      userAddress: "0x0000000000000000000000000000000000000002",
      type: "master",
    })
    expect(() =>
      db.createAccount({
        alias: "existing",
        userAddress: "0x0",
        type: "readonly",
        setAsDefault: true,
      }),
    ).toThrow()
    expect(db.getDefaultAccount()?.alias).toBe("existing")
    const { nextNonce } = await import("../../api/execution.js")
    const first = nextNonce("signer", false),
      second = nextNonce("signer", false)
    expect(second).toBeGreaterThan(first)
    db.setDefaultAccount("master")
    expect(db.getDefaultAccount()?.alias).toBe("master")
  } finally {
    db.closeDb()
    vi.doUnmock("../paths.js")
    rmSync(dir, { recursive: true, force: true })
  }
})
