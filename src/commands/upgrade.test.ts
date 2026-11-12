import { it, expect } from "vitest"
import { compareVersions } from "./upgrade.js"
it("compares beta and stable releases without losing prerelease identifiers", () => {
  expect(compareVersions("1.0.0-beta.1", "1.0.0-beta.2")).toBe(true)
  expect(compareVersions("1.0.0-beta.9", "1.0.0-beta.10")).toBe(true)
  expect(compareVersions("1.0.0-beta.1", "1.0.0")).toBe(true)
  expect(compareVersions("1.0.0", "1.0.0-beta.2")).toBe(false)
  expect(compareVersions("1.0.0-beta.1", "0.0.5")).toBe(false)
  expect(compareVersions("1.0.0-beta.1", "1.0.0-beta.1")).toBe(false)
})
