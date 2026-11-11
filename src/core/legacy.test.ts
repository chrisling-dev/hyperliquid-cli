import { it, expect, vi } from "vitest"
import { mkdtempSync, writeFileSync, existsSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
it("cleans stale files but never signals a live unrelated PID", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hl-legacy-test-"))
  vi.stubEnv("HL_HOME", dir)
  vi.resetModules()
  vi.doMock("../lib/paths.js", () => ({ HL_DIR: dir }))
  const { cleanupLegacy } = await import("./legacy.js")
  try {
    writeFileSync(join(dir, "server.pid"), "99999999")
    writeFileSync(join(dir, "server.json"), "{}")
    const cleaned = await cleanupLegacy()
    expect(cleaned).toHaveLength(2)
    writeFileSync(join(dir, "server.pid"), String(process.pid))
    await expect(cleanupLegacy()).rejects.toThrow("refusing to signal")
    expect(existsSync(join(dir, "server.pid"))).toBe(true)
  } finally {
    vi.doUnmock("../lib/paths.js")
    vi.unstubAllEnvs()
    rmSync(dir, { recursive: true, force: true })
  }
})
