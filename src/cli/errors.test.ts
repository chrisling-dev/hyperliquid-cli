import { afterEach, expect, it, vi } from "vitest"
import { CLIError, formatError, errorColorsEnabled } from "./errors.js"
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})
it("separates the problem, explanation and next step", () => {
  expect(
    formatError(
      new CLIError(
        "Missing required parameter: --coin",
        "Supply a flag or JSON input.",
        "hl info l2Book --help",
      ),
      { color: false },
    ),
  ).toBe(
    "Error: Missing required parameter: --coin\n\n  Supply a flag or JSON input.\n\n  Try: hl info l2Book --help\n",
  )
})
it("colors terminal labels while keeping explicit JSON free of ANSI codes", () => {
  const error = new CLIError(
    "Missing --coin",
    undefined,
    "hl info l2Book --help",
  )
  expect(formatError(error, { color: true })).toContain("\x1b[1;31mError")
  expect(JSON.parse(formatError(error, { json: true, color: true }))).toEqual({
    error: "Missing --coin",
    hint: "hl info l2Book --help",
  })
})
it("uses plain diagnostics for redirected stderr and respects NO_COLOR", () => {
  expect(errorColorsEnabled(false, {})).toBe(false)
  expect(errorColorsEnabled(true, { NO_COLOR: "" })).toBe(false)
  expect(errorColorsEnabled(true, { TERM: "xterm-256color" })).toBe(true)
})
it("formats ordinary failures without exposing a stack trace", () => {
  expect(formatError(new Error("Connection failed"), { color: false })).toBe(
    "Error: Connection failed\n",
  )
})
