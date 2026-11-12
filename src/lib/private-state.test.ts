import { it, expect } from "vitest"
import { mkdtempSync, mkdirSync, writeFileSync, statSync, symlinkSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { secureStateDirectory, secureStateFile } from "./private-state.js"
import { coreEnvironment } from "../core/environment.js"
it("tightens existing state permissions and rejects redirected files", () => {
  const root = mkdtempSync(join(tmpdir(), "hl-private-"))
  try {
    const dir = join(root, "state")
    mkdirSync(dir, { mode: 0o755 })
    secureStateDirectory(dir)
    expect(statSync(dir).mode & 0o777).toBe(0o700)
    const file = join(dir, "db")
    writeFileSync(file, "fixture", { mode: 0o644 })
    secureStateFile(file)
    expect(statSync(file).mode & 0o777).toBe(0o600)
    symlinkSync(file, join(dir, "link"))
    expect(() => secureStateFile(join(dir, "link"))).toThrow("regular file")
    symlinkSync(dir, join(root, "link"))
    expect(() => secureStateDirectory(join(root, "link"))).toThrow("real directory")
  } finally { rmSync(root, { recursive: true, force: true }) }
})
it("does not pass credentials or code injection options to the read-only core", () => {
  expect(coreEnvironment({ PATH: "/bin", HL_HOME: "/tmp/hl", HTTPS_PROXY: "http://proxy",
    HYPERLIQUID_PRIVATE_KEY: "secret", CUSTOM_WALLET_KEY: "secret", NPM_TOKEN: "secret",
    NODE_OPTIONS: "--import malicious.js", AWS_SECRET_ACCESS_KEY: "secret",
  })).toEqual({ PATH: "/bin", HL_HOME: "/tmp/hl", HTTPS_PROXY: "http://proxy" })
})
