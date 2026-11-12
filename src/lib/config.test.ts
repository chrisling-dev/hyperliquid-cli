import { describe, it, expect, vi, beforeEach } from "vitest"
vi.mock("./db/index.js", () => ({
  getAccountByAlias: vi.fn(),
  getDefaultAccount: vi.fn(),
}))
import { getAccountByAlias, getDefaultAccount } from "./db/index.js"
import { loadConfig } from "./config.js"
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("HYPERLIQUID_PRIVATE_KEY", "")
  vi.stubEnv("HYPERLIQUID_WALLET_ADDRESS", "")
})
describe("account selection", () => {
  it("errors for explicit missing aliases rather than silently using another account", () => {
    expect(() => loadConfig(false, "missing")).toThrow("not found")
    expect(getDefaultAccount).not.toHaveBeenCalled()
  })
  it("selects explicit alias before the default account", () => {
    vi.mocked(getAccountByAlias).mockReturnValue({
      alias: "selected",
      type: "readonly",
      userAddress: "0x123",
      apiWalletPrivateKey: null,
    } as never)
    expect(loadConfig(true, "selected")).toMatchObject({
      testnet: true,
      account: { alias: "selected", type: "readonly" },
    })
  })
  it("allows public reads with no configured account", () =>
    expect(loadConfig(false)).toMatchObject({
      testnet: false,
      privateKey: undefined,
      walletAddress: undefined,
    }))
})
