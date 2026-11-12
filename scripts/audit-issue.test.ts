import { it, expect, vi } from "vitest"
import { mkdtempSync, writeFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import sync from "./audit-issue.mjs"
const marker = "<!-- hyperliquid-cli:api-audit -->"
const healthy = { status: "covered", missing: [], missingFields: [], changed: [], changedPages: [], removed: [], errors: [] }
it("creates once, updates, closes on recovery, and reopens the same issue", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hl-audit-issue-"))
  const reportPath = join(dir, "report.json")
  const issues: { number: number; body: string; state: string }[] = []
  const api = {
    listForRepo: vi.fn(),
    create: vi.fn(async (data) => { issues.push({ ...data, number: 1, state: "open" }) }),
    update: vi.fn(async (data) => { Object.assign(issues.find(i => i.number === data.issue_number)!, data) }),
  }
  const github = { rest: { issues: api }, paginate: vi.fn(async () => issues) }
  const context = { repo: { owner: "owner", repo: "repo" }, runId: 123 }
  const run = async (report: unknown, outcome = "failure") => {
    writeFileSync(reportPath, JSON.stringify(report))
    await sync({ github, context, reportPath, outcome })
  }
  try {
    await run(healthy, "success")
    expect(api.create).not.toHaveBeenCalled()
    await run({ ...healthy, status: "outdated", missing: ["newMethod"] })
    await run({ ...healthy, status: "review-required", changedPages: ["signing"] })
    expect(api.create).toHaveBeenCalledTimes(1)
    expect(issues[0].body).toContain("signing")
    await run(healthy, "success")
    expect(issues[0].state).toBe("closed")
    await run({ ...healthy, status: "inconclusive", errors: ["parser failed"] })
    expect(issues[0].state).toBe("open")
    expect(api.create).toHaveBeenCalledTimes(1)
    await run(null)
    expect(issues[0].body).toContain("did not produce a valid report")
    expect(issues[0].state).toBe("open")
    issues.push({ number: 2, state: "open", body: marker })
    issues.push({ number: 3, state: "open", body: "Unrelated issue" })
    await run(null)
    expect(issues[1].state).toBe("closed")
    expect(issues[2].state).toBe("open")
  } finally { rmSync(dir, { recursive: true, force: true }) }
})
