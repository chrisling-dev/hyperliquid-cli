import { beforeEach, describe, expect, it, vi } from "vitest"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
vi.mock("../lib/config.js", () => ({
  loadConfig: vi.fn(() => ({ testnet: false })),
}))
vi.mock("../core/client.js", () => ({ stream: vi.fn() }))
vi.mock("../api/execution.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/execution.js")>()),
  execute: vi.fn(async () => ({})),
}))
import { createProgram } from "../cli/program.js"
import { loadConfig } from "../lib/config.js"
import { execute } from "../api/execution.js"
import { stream } from "../core/client.js"
import { inputSchema } from "../api/parameter-help.js"
import { getMethod, requiredInputs } from "../api/registry.js"
const run = (...args: string[]) =>
  createProgram().parseAsync(args, { from: "user" })
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(loadConfig).mockReturnValue({ testnet: false })
  vi.spyOn(console, "log").mockImplementation(() => {})
})
describe("API command input boundary", () => {
  it.each([
    ["info", "l2Book"],
    ["ws", "l2Book"],
    ["exchange", "order"],
  ])(
    "rejects missing %s %s inputs before account loading or execution",
    async (family, method) => {
      await expect(run(family, method)).rejects.toThrow(
        "Missing required parameter",
      )
      expect(loadConfig).not.toHaveBeenCalled()
      expect(execute).not.toHaveBeenCalled()
      expect(stream).not.toHaveBeenCalled()
    },
  )
  it("accepts required parameters from flags, inline JSON, and a file", async () => {
    const dir = await mkdtemp(join(tmpdir(), "hl-input-"))
    try {
      const file = join(dir, "input.json")
      await writeFile(file, '{"coin":"BTC"}')
      for (const args of [
        ["--coin", "BTC"],
        ["--data", '{"coin":"BTC"}'],
        ["--input", file],
      ]) {
        await run("info", "l2Book", ...args)
        expect(execute).toHaveBeenLastCalledWith(
          expect.objectContaining({ name: "l2Book" }),
          { coin: "BTC" },
          { testnet: false },
          expect.any(Object),
        )
      }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
  it("rejects invalid provided values without any request or stream", async () => {
    await expect(
      run("info", "l2Book", "--coin", "BTC", "--nSigFigs", "99"),
    ).rejects.toThrow("nSigFigs")
    await expect(run("ws", "l2Book", "--data", '{"coin":123}')).rejects.toThrow(
      "coin",
    )
    expect(execute).not.toHaveBeenCalled()
    expect(stream).not.toHaveBeenCalled()
  })
  it("allows a selected account to satisfy user but errors locally when neither is supplied", async () => {
    await expect(run("info", "clearinghouseState")).rejects.toThrow("--user")
    expect(execute).not.toHaveBeenCalled()
    const user = "0x0000000000000000000000000000000000000001"
    vi.mocked(loadConfig).mockReturnValue({
      testnet: false,
      walletAddress: user,
    })
    await run("info", "clearinghouseState")
    expect(execute).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ user }),
      expect.anything(),
      expect.anything(),
    )
  })
  it("does not require every field of mutually exclusive action variants", () => {
    expect(
      requiredInputs(getMethod("exchange", "activateOutcomeDeployer")),
    ).toEqual([])
  })
  it("shows parameters without SDK or request-envelope metadata", async () => {
    await run("schema", "info", "l2Book")
    const output = vi.mocked(console.log).mock.calls.at(-1)![0]
    expect(output).toContain("coin  required  string")
    expect(output).toContain("nSigFigs  optional  2 | 3 | 4 | 5")
    expect(output).not.toContain('"request"')
    expect(Object.keys(inputSchema(getMethod("info", "l2Book")))).toEqual([
      "coin",
      "nSigFigs",
      "mantissa",
    ])
    await run("schema", "info", "l2Book", "--json")
    expect(
      JSON.parse(vi.mocked(console.log).mock.calls.at(-1)![0]).coin.required,
    ).toBe(true)
  })
})

it.each([
  [[], undefined],
  [["--fast"], true],
  [["--fast", "true"], true],
  [["--fast", "false"], false],
  [["--fast=false"], false],
])("accepts optional boolean values: %j", async (flags, fast) => {
  await run("ws", "l2Book", "--coin", "BTC", ...flags)
  expect(stream).toHaveBeenLastCalledWith(false, "l2Book",
    fast === undefined ? { coin: "BTC" } : { coin: "BTC", fast }, expect.any(Function))
})
it("handles bare booleans before another flag and rejects invalid or duplicate values", async () => {
  await run("ws", "l2Book", "--fast", "--coin", "BTC")
  expect(stream).toHaveBeenLastCalledWith(false, "l2Book", { coin: "BTC", fast: true }, expect.any(Function))
  vi.mocked(stream).mockClear()
  await expect(run("ws", "l2Book", "--coin", "BTC", "--fast", "1")).rejects.toThrow()
  await expect(run("ws", "l2Book", "--fast", "--data", '{"coin":"BTC","fast":false}')).rejects.toThrow("both")
  expect(stream).not.toHaveBeenCalled()
})
it("accepts bare required exchange booleans without defaulting omitted inputs", async () => {
  await expect(run("exchange", "updateLeverage", "--asset", "0", "--leverage", "5", "--dry-run")).rejects.toThrow("--isCross")
  vi.mocked(loadConfig).mockReturnValue({ testnet: false, privateKey: `0x${"1".repeat(64)}` })
  await run("exchange", "updateLeverage", "--asset", "0", "--leverage", "5", "--isCross", "--dry-run")
  expect(JSON.parse(vi.mocked(console.log).mock.calls.at(-1)![0]).params.isCross).toBe(true)
  expect(execute).not.toHaveBeenCalled()
})
