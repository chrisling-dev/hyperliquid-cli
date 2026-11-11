import { it, expect, vi, beforeEach } from "vitest"
import { privateKeyToAccount } from "viem/accounts"
const mocks = vi.hoisted(() => ({
  request: vi.fn(),
  role: vi.fn(),
  nonce: vi.fn(),
}))
vi.mock("@nktkas/hyperliquid", () => ({
  HttpTransport: class {
    isTestnet = true
    request = mocks.request
  },
  InfoClient: class {
    userRole = mocks.role
  },
}))
vi.mock("../lib/db/index.js", () => ({
  getDb: () => ({
    transaction: (fn: () => number) => ({ immediate: fn }),
    prepare: (sql: string) => ({
      get: () => undefined,
      run: () => {
        mocks.nonce(sql)
      },
    }),
  }),
}))
import { execute, resolveInput } from "./execution.js"
import { getMethod } from "./registry.js"
const privateKey = `0x${"1".repeat(64)}` as const
const walletAddress = privateKeyToAccount(privateKey).address
const config = {
  testnet: true,
  privateKey,
  walletAddress,
  account: { alias: "master", type: "master" as const },
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.role.mockResolvedValue({ role: "user" })
  mocks.request.mockResolvedValue({
    status: "ok",
    response: { type: "default" },
  })
})
it("submits a nested info request without SDK flattening or credentials", async () => {
  const m = getMethod("info", "candleSnapshot")
  const params = resolveInput(
    m,
    { req: { coin: "BTC", interval: "1h", startTime: 0 } },
    { testnet: true },
  )
  await execute(m, params, { testnet: true })
  expect(mocks.request).toHaveBeenCalledWith("info", {
    type: "candleSnapshot",
    ...params,
  })
  expect(mocks.role).not.toHaveBeenCalled()
})
it("uses the SDK for L1 and user-signed payloads; never submits private keys", async () => {
  for (const [name, input] of [
    [
      "order",
      {
        orders: [
          {
            a: 0,
            b: true,
            p: "100",
            s: "0.1",
            r: false,
            t: { limit: { tif: "Gtc" } },
          },
        ],
      },
    ],
    ["usdSend", { destination: walletAddress, amount: "1" }],
  ] as const) {
    const m = getMethod("exchange", name)
    await execute(m, resolveInput(m, input, config), config)
  }
  const payloads = mocks.request.mock.calls.map((call) => call[1])
  expect(payloads[0].action.type).toBe("order")
  expect(payloads[0].signature).toHaveProperty("r")
  expect(payloads[1].action.hyperliquidChain).toBe("Testnet")
  expect(JSON.stringify(payloads)).not.toContain(privateKey)
})
it("rejects a mislabeled agent before a master-only action can be signed", async () => {
  mocks.role.mockResolvedValue({ role: "agent", data: { user: walletAddress } })
  await expect(
    execute(
      getMethod("exchange", "usdSend"),
      { destination: walletAddress, amount: "1" },
      config,
    ),
  ).rejects.toThrow("agent")
  expect(mocks.request).not.toHaveBeenCalled()
})
it("signs explicit SDK-gap actions and propagates exchange failures", async () => {
  const m = getMethod("exchange", "trailingStop")
  const params = resolveInput(
    m,
    {
      asset: 0,
      isBuy: false,
      sz: "0.1",
      reduceOnly: true,
      retracement: { pct: "2%" },
      activationPx: null,
    },
    config,
  )
  await execute(m, params, config)
  expect(mocks.request.mock.calls[0][1].action).toEqual({
    type: "trailingStop",
    ...params,
  })
  mocks.request.mockResolvedValue({ status: "err", response: "rejected" })
  await expect(execute(m, params, config)).rejects.toThrow("rejected")
})

it("signs reviewed deployer extensions and rejects their obsolete shapes", async () => {
  for (const [name, params] of [
    ["activateOutcomeDeployer", { activate: { venueName: "ab" } }],
    [
      "outcomeDeploy",
      {
        venue: "ab",
        operation: {
          registerStandaloneOutcomeFromTemplate: {
            id: "abc",
            keywordToValue: [["expiry", "20260801-0600"]],
            deployerFeeScale: "1",
          },
        },
      },
    ],
    ["spotDeploy", { enableAlignedQuoteToken: { token: 1 } }],
    [
      "perpDeploy",
      {
        star: {
          dex: "test",
          operation: { proxy: [walletAddress, { modifyApproval: true }] },
        },
      },
    ],
  ] as const) {
    const method = getMethod("exchange", name)
    const resolved = resolveInput(method, params, config)
    await execute(method, resolved, config)
    expect(mocks.request.mock.calls.at(-1)![1].action).toEqual({
      type: name,
      ...resolved,
    })
  }
  expect(() =>
    resolveInput(
      getMethod("exchange", "activateOutcomeDeployer"),
      { isDeactivate: true },
      config,
    ),
  ).toThrow()
  await expect(
    execute(
      getMethod("exchange", "outcomeDeploy"),
      {},
      { ...config, testnet: false },
    ),
  ).rejects.toThrow("testnet-only")
})
