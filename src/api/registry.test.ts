import { describe, it, expect } from "vitest"
import {
  methods,
  getMethod,
  inputFields,
  validateInput,
  parseFlag,
  manifest,
} from "./registry.js"
import { assertPermission, resolveInput } from "./execution.js"
import { createProgram } from "../cli/program.js"
const address = "0x0000000000000000000000000000000000000001"
const key = `0x${"1".repeat(64)}` as const
const order = {
  orders: [
    {
      a: 0,
      b: true,
      p: "123.4500",
      s: "0.01",
      r: false,
      t: { limit: { tif: "Gtc" } },
    },
  ],
}
describe("API registry and account capabilities", () => {
  it("registers every reviewed method exactly once", () => {
    const ids = methods.map((m) => `${m.family}.${m.name}`)
    expect(new Set(ids).size).toBe(ids.length)
    const program = createProgram()
    for (const m of methods)
      expect(
        program.commands
          .find((c) => c.name() === m.family)
          ?.commands.some((c) => c.name() === m.name),
      ).toBe(true)
    expect(program.commands.map((c) => c.name())).not.toContain("order")
    expect(
      program.commands
        .find((c) => c.name() === "account")
        ?.commands.map((c) => c.name()),
    ).toEqual(["add", "ls", "set-default", "remove"])
  })
  it("preserves decimal strings and validates nested orders", () => {
    const m = getMethod("exchange", "order")
    expect(validateInput(m, order).orders).toEqual([
      { ...order.orders[0], p: "123.45" },
    ])
    expect(() =>
      validateInput(m, { ...order, orders: [{ ...order.orders[0], typo: 1 }] }),
    ).toThrow("Unknown field")
    expect(() =>
      validateInput(m, {
        ...order,
        orders: [{ ...order.orders[0], t: { limit: { tif: "WRONG" } } }],
      }),
    ).toThrow()
    expect(() => validateInput(m, { ...order, type: "usdSend" })).toThrow(
      "system-managed",
    )
  })
  it("exposes action variants and API envelopes", () => {
    expect(inputFields(getMethod("info", "candleSnapshot"))).toHaveProperty(
      "req",
    )
    expect(
      Object.keys(inputFields(getMethod("exchange", "spotDeploy"))).length,
    ).toBeGreaterThan(1)
    expect(
      manifest(getMethod("exchange", "usdSend")).parameters,
    ).not.toHaveProperty("signatureChainId")
    expect(
      validateInput(getMethod("exchange", "scheduleCancel"), { time: 100 }),
    ).toEqual({ time: 100 })
    expect(() =>
      validateInput(getMethod("exchange", "noop"), { nonce: 1.5 }),
    ).toThrow()
  })
  it("defaults the user address but respects explicit user overrides", () => {
    const m = getMethod("info", "clearinghouseState")
    expect(
      resolveInput(m, {}, { testnet: false, walletAddress: address }).user,
    ).toBe(address)
    const other = "0x0000000000000000000000000000000000000002"
    expect(
      resolveInput(
        m,
        { user: other },
        { testnet: false, walletAddress: address },
      ).user,
    ).toBe(other)
    expect(() => resolveInput(m, {}, { testnet: false })).toThrow("user")
    expect(resolveInput(m, { user: address }, { testnet: false }).user).toBe(
      address,
    )
  })
  it("distinguishes reads, trading and master-only actions", () => {
    const agent = {
      testnet: false,
      privateKey: key,
      account: { alias: "agent", type: "api_wallet" as const },
    }
    expect(() =>
      assertPermission(getMethod("exchange", "order"), { testnet: false }),
    ).toThrow("signing")
    expect(() =>
      assertPermission(getMethod("exchange", "order"), agent),
    ).not.toThrow()
    expect(() =>
      assertPermission(getMethod("exchange", "usdSend"), agent),
    ).toThrow("master")
    // L1 actions are not automatically agent-authorized.
    expect(() =>
      assertPermission(getMethod("exchange", "vaultTransfer"), agent),
    ).toThrow("master")
    expect(() =>
      assertPermission(getMethod("exchange", "agentSendAsset"), agent),
    ).not.toThrow()
    expect(() =>
      assertPermission(getMethod("exchange", "usdSend"), {
        ...agent,
        account: { alias: "owner", type: "master" },
      }),
    ).not.toThrow()
  })
  it("parses typed flags without turning decimal strings into floats", () => {
    expect(
      parseFlag(
        "0.000001",
        inputFields(getMethod("exchange", "usdSend")).amount,
      ),
    ).toBe("0.000001")
    expect(
      parseFlag(
        "false",
        inputFields(getMethod("exchange", "updateLeverage")).isCross,
      ),
    ).toBe(false)
  })
})

it("rejects mutually exclusive variants instead of silently discarding fields", () => {
  expect(() =>
    validateInput(getMethod("exchange", "activateOutcomeDeployer"), {
      activate: { venueName: "ab" },
      deactivate: null,
    }),
  ).toThrow()
  expect(() =>
    validateInput(getMethod("exchange", "trailingStop"), {
      asset: 0,
      isBuy: false,
      sz: "1",
      reduceOnly: true,
      retracement: { pct: "2%", px: "10" },
      activationPx: null,
    }),
  ).toThrow()
})
