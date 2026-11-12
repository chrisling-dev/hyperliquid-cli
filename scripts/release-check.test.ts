import { it, expect } from "vitest"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
it("rejects mismatched release tags and prerelease flags before publishing", () => {
  const cwd = mkdtempSync(join(tmpdir(), "hl-release-test-"))
  const script = resolve("scripts/release-check.mjs")
  const eventPath = join(cwd, "event.json")
  try {
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ version: "1.0.0-beta.1" }))
    const run = (release: object) => {
      writeFileSync(eventPath, JSON.stringify({ release }))
      return () => execFileSync(process.execPath, [script], {
        cwd, env: { ...process.env, GITHUB_EVENT_PATH: eventPath, GITHUB_OUTPUT: join(cwd, "output") },
        stdio: "pipe",
      })
    }
    expect(run({ tag_name: "v1.0.0-beta.2", prerelease: true })).toThrow(/tag must match/)
    expect(run({ tag_name: "v1.0.0-beta.1", prerelease: false })).toThrow(/must be marked prerelease/)
    writeFileSync(join(cwd, "package.json"), JSON.stringify({ version: "1.0.0" }))
    expect(run({ tag_name: "v1.0.0", prerelease: true })).toThrow(/stable releases must not/)
  } finally { rmSync(cwd, { recursive: true, force: true }) }
})
