import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { audit, type Snapshot } from "./audit.js"
const snapshot = JSON.parse(
  readFileSync(
    new URL("../../api-docs-snapshot.json", import.meta.url),
    "utf8",
  ),
) as Snapshot
describe("deterministic docs audit", () => {
  it("parses every current documented request section without interpreting response tables as inputs", () => {
    const result = audit(snapshot, snapshot)
    expect(result.errors).toEqual([])
    expect(result.missing).toEqual([])
    expect(result.missingFields).toEqual([])
    expect(result.status).toBe("covered")
    expect(result.documentedMethods).toBeGreaterThan(100)
  })
  it("reports a new method and field, and reproducibly detects changed request text", () => {
    const updated = structuredClone(snapshot)
    const page = updated.pages.find((p) => p.url.endsWith("/info-endpoint.md"))!
    page.text = page.text
      .replace('"allMids"', '"futureMethod"')
      .replace("DEX name. Defaults", "New behavior. Defaults")
    const result = audit(updated, snapshot)
    expect(
      result.missing.some((m) => m.command === "hl info futureMethod"),
    ).toBe(true)
    expect(result.removed.some((m) => m.command === "hl info allMids")).toBe(
      true,
    )
    expect(audit(updated, snapshot)).toEqual(result)
  })
  it("never treats an unreadable or missing documentation section as up to date", () => {
    const updated = structuredClone(snapshot)
    const page = updated.pages.find((p) =>
      p.url.endsWith("/exchange-endpoint.md"),
    )!
    page.text = page.text.replace('"type": "order"', '"unknown": "order"')
    expect(audit(updated, snapshot).errors.length).toBeGreaterThan(0)
    expect(audit({ format: 1, pages: [] }).status).toBe("inconclusive")
  })
})

it("flags protocol-only changes and newly linked unknown API pages for review", () => {
  const updated = structuredClone(snapshot)
  updated.pages.find((p) => p.url.endsWith("/signing.md"))!.text +=
    "\nNew signing requirement."
  expect(audit(updated, snapshot).status).toBe("review-required")
  expect(audit(updated, snapshot).changedPages).toHaveLength(1)
  updated.pages.push({
    url: "https://hyperliquid.gitbook.io/hyperliquid-docs/for-developers/api/new-family.md",
    text: "New API",
  })
  expect(
    audit(updated, snapshot).errors.some((e) => e.includes("new-family")),
  ).toBe(true)
})
