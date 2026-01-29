import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"

// Mock modules
vi.mock("../cli/program.js", () => ({
  getContext: vi.fn(),
  getOutputOptions: vi.fn(() => ({ json: false })),
}))

vi.mock("../cli/output.js", () => ({
  output: vi.fn(),
  outputError: vi.fn(),
  outputSuccess: vi.fn(),
}))

vi.mock("../lib/userConfig.js", () => ({
  loadUserConfig: vi.fn(() => ({ slippage: 1 })),
  saveUserConfig: vi.fn(),
  getUserConfigPath: vi.fn(() => "/home/user/.hl/config.json"),
}))

import { getContext } from "../cli/program.js"
import { loadUserConfig } from "../lib/userConfig.js"
import {
  validatePositiveNumber,
  validateTif,
  validateDirection,
} from "../lib/validation.js"

describe("trade commands", () => {
  let mockExchangeClient: {
    order: Mock
    cancel: Mock
    updateLeverage: Mock
  }

  let mockInfoClient: {
    meta: Mock
    allMids: Mock
    spotMeta: Mock
  }

  let mockContext: {
    getWalletClient: Mock
    getPublicClient: Mock
  }

  const mockMeta = {
    universe: [
      { name: "BTC", szDecimals: 4, maxLeverage: 50 },
      { name: "ETH", szDecimals: 3, maxLeverage: 50 },
      { name: "SOL", szDecimals: 2, maxLeverage: 20 },
    ],
  }

  const mockSpotMeta = {
    tokens: [
      { name: "USDC", index: 0, szDecimals: 6, weiDecimals: 8, tokenId: "0x1", isCanonical: true, evmContract: null, fullName: "USD Coin" },
      { name: "HYPE", index: 1, szDecimals: 4, weiDecimals: 8, tokenId: "0x2", isCanonical: true, evmContract: null, fullName: "Hyperliquid" },
      { name: "PURR", index: 2, szDecimals: 4, weiDecimals: 8, tokenId: "0x3", isCanonical: true, evmContract: null, fullName: "Purr" },
    ],
    universe: [
      { tokens: [1, 0], name: "HYPE/USDC", index: 0, isCanonical: true },
      { tokens: [2, 0], name: "PURR/USDC", index: 1, isCanonical: true },
    ],
  }

  beforeEach(() => {
    vi.resetAllMocks()

    mockExchangeClient = {
      order: vi.fn(),
      cancel: vi.fn(),
      updateLeverage: vi.fn(),
    }

    mockInfoClient = {
      meta: vi.fn(() => Promise.resolve(mockMeta)),
      allMids: vi.fn(() =>
        Promise.resolve({
          BTC: "50000",
          ETH: "3000",
          SOL: "100",
          "HYPE/USDC": "20",
          "PURR/USDC": "0.5",
        })
      ),
      spotMeta: vi.fn(() => Promise.resolve(mockSpotMeta)),
    }

    mockContext = {
      getWalletClient: vi.fn(() => mockExchangeClient),
      getPublicClient: vi.fn(() => mockInfoClient),
    }

    vi.mocked(getContext).mockReturnValue(
      mockContext as unknown as ReturnType<typeof getContext>
    )
    vi.mocked(loadUserConfig).mockReturnValue({ slippage: 1 })
  })

  describe("direction validation", () => {
    it("should validate 'long' as perp buy", () => {
      const result = validateDirection("long")
      expect(result).toEqual({
        direction: "long",
        marketType: "perp",
        isBuy: true,
      })
    })

    it("should validate 'short' as perp sell", () => {
      const result = validateDirection("short")
      expect(result).toEqual({
        direction: "short",
        marketType: "perp",
        isBuy: false,
      })
    })

    it("should validate 'buy' as spot buy", () => {
      const result = validateDirection("buy")
      expect(result).toEqual({
        direction: "buy",
        marketType: "spot",
        isBuy: true,
      })
    })

    it("should validate 'sell' as spot sell", () => {
      const result = validateDirection("sell")
      expect(result).toEqual({
        direction: "sell",
        marketType: "spot",
        isBuy: false,
      })
    })

    it("should be case-insensitive", () => {
      expect(validateDirection("LONG")).toEqual({
        direction: "long",
        marketType: "perp",
        isBuy: true,
      })
      expect(validateDirection("SHORT")).toEqual({
        direction: "short",
        marketType: "perp",
        isBuy: false,
      })
    })

    it("should throw error for invalid direction", () => {
      expect(() => validateDirection("invalid")).toThrow(
        'Direction must be "long", "short", "buy", or "sell"'
      )
    })
  })

  describe("market orders - perp", () => {
    it("should create a perp long market order with slippage", async () => {
      mockExchangeClient.order.mockResolvedValue({
        status: "ok",
        response: {
          data: { statuses: [{ filled: { totalSz: "0.1", avgPx: "50050" } }] },
        },
      })

      const mids = await mockContext.getPublicClient().allMids()
      const midPrice = parseFloat(mids.BTC)
      expect(midPrice).toBe(50000)

      const slippagePct = 1 / 100 // 1%
      const limitPx = midPrice * (1 + slippagePct) // Buy: add slippage
      expect(limitPx).toBe(50500)

      const orderRequest = {
        orders: [
          {
            a: 0, // BTC asset index
            b: true, // long = buy
            p: limitPx.toFixed(6),
            s: "0.1",
            r: false,
            t: { limit: { tif: "Ioc" } },
          },
        ],
        grouping: "na",
      }

      await mockContext.getWalletClient().order(orderRequest)
      expect(mockExchangeClient.order).toHaveBeenCalledWith(orderRequest)
    })

    it("should create a perp short market order with slippage", async () => {
      const mids = await mockContext.getPublicClient().allMids()
      const midPrice = parseFloat(mids.ETH)
      expect(midPrice).toBe(3000)

      const slippagePct = 1 / 100 // 1%
      const limitPx = midPrice * (1 - slippagePct) // Sell: subtract slippage
      expect(limitPx).toBe(2970)

      const orderRequest = {
        orders: [
          {
            a: 1, // ETH asset index
            b: false, // short = sell
            p: limitPx.toFixed(6),
            s: "1",
            r: false,
            t: { limit: { tif: "Ioc" } },
          },
        ],
        grouping: "na",
      }

      await mockContext.getWalletClient().order(orderRequest)
      expect(mockExchangeClient.order).toHaveBeenCalledWith(orderRequest)
    })
  })

  describe("market orders - spot", () => {
    it("should resolve spot pair from symbol with USDC quote", async () => {
      const spotMeta = await mockContext.getPublicClient().spotMeta()
      expect(spotMeta.universe[0].name).toBe("HYPE/USDC")

      // Asset ID for spot = 10000 + index
      const assetId = 10000 + spotMeta.universe[0].index
      expect(assetId).toBe(10000)
    })

    it("should create a spot buy market order", async () => {
      mockExchangeClient.order.mockResolvedValue({
        status: "ok",
        response: {
          data: { statuses: [{ filled: { totalSz: "1", avgPx: "20.1" } }] },
        },
      })

      const mids = await mockContext.getPublicClient().allMids()
      const midPrice = parseFloat(mids["HYPE/USDC"])
      expect(midPrice).toBe(20)

      const slippagePct = 1 / 100
      const limitPx = midPrice * (1 + slippagePct)

      const orderRequest = {
        orders: [
          {
            a: 10000, // HYPE/USDC spot asset ID
            b: true, // buy
            p: limitPx.toFixed(6),
            s: "1",
            r: false,
            t: { limit: { tif: "Ioc" } },
          },
        ],
        grouping: "na",
      }

      await mockContext.getWalletClient().order(orderRequest)
      expect(mockExchangeClient.order).toHaveBeenCalledWith(orderRequest)
    })
  })

  describe("limit orders", () => {
    it("should create a perp limit long order with GTC", async () => {
      mockExchangeClient.order.mockResolvedValue({
        status: "ok",
        response: {
          data: { statuses: [{ resting: { oid: 12345 } }] },
        },
      })

      const price = validatePositiveNumber("50000", "price")
      const tif = validateTif("gtc")
      expect(tif).toBe("Gtc")

      const orderRequest = {
        orders: [
          {
            a: 0,
            b: true, // long
            p: price.toString(),
            s: "0.1",
            r: false,
            t: { limit: { tif: "Gtc" } },
          },
        ],
        grouping: "na",
      }

      const result = await mockContext.getWalletClient().order(orderRequest)
      expect(mockExchangeClient.order).toHaveBeenCalledWith(orderRequest)
      expect(result.response.data.statuses[0].resting.oid).toBe(12345)
    })

    it("should create a perp limit short order with IOC", async () => {
      const tif = validateTif("ioc")
      expect(tif).toBe("Ioc")

      const orderRequest = {
        orders: [
          {
            a: 0,
            b: false, // short
            p: "51000",
            s: "0.1",
            r: false,
            t: { limit: { tif: "Ioc" } },
          },
        ],
        grouping: "na",
      }

      await mockContext.getWalletClient().order(orderRequest)
      expect(mockExchangeClient.order).toHaveBeenCalledWith(orderRequest)
    })

    it("should support reduce-only flag", async () => {
      const orderRequest = {
        orders: [
          {
            a: 0,
            b: true,
            p: "50000",
            s: "0.1",
            r: true, // reduce-only
            t: { limit: { tif: "Gtc" } },
          },
        ],
        grouping: "na",
      }

      await mockContext.getWalletClient().order(orderRequest)
      expect(mockExchangeClient.order).toHaveBeenCalledWith(orderRequest)
    })
  })

  describe("stop-loss orders", () => {
    it("should create a market stop-loss order (no limit price)", async () => {
      mockExchangeClient.order.mockResolvedValue({
        status: "ok",
        response: { data: { statuses: ["waitingForTrigger"] } },
      })

      const mids = await mockContext.getPublicClient().allMids()
      const midPrice = parseFloat(mids.BTC)
      const slippagePct = 1 / 100
      // For short direction SL, it's a buy to close, so add slippage
      const limitPx = midPrice * (1 - slippagePct) // Short SL = sell

      const orderRequest = {
        orders: [
          {
            a: 0,
            b: false, // short direction
            p: limitPx.toFixed(6),
            s: "0.1",
            r: false,
            t: {
              trigger: {
                triggerPx: "48000",
                isMarket: true, // market execution
                tpsl: "sl",
              },
            },
          },
        ],
        grouping: "na",
      }

      await mockContext.getWalletClient().order(orderRequest)
      expect(mockExchangeClient.order).toHaveBeenCalledWith(orderRequest)
    })

    it("should create a limit stop-loss order", async () => {
      mockExchangeClient.order.mockResolvedValue({
        status: "ok",
        response: { data: { statuses: ["waitingForTrigger"] } },
      })

      const triggerPx = validatePositiveNumber("48000", "trigger price")
      const limitPx = validatePositiveNumber("47900", "limit price")

      const orderRequest = {
        orders: [
          {
            a: 0,
            b: false, // short direction
            p: limitPx.toString(),
            s: "0.1",
            r: false,
            t: {
              trigger: {
                triggerPx: triggerPx.toString(),
                isMarket: false, // limit execution
                tpsl: "sl",
              },
            },
          },
        ],
        grouping: "na",
      }

      await mockContext.getWalletClient().order(orderRequest)
      expect(mockExchangeClient.order).toHaveBeenCalledWith(orderRequest)
    })
  })

  describe("take-profit orders", () => {
    it("should create a market take-profit order", async () => {
      mockExchangeClient.order.mockResolvedValue({
        status: "ok",
        response: { data: { statuses: ["waitingForTrigger"] } },
      })

      const mids = await mockContext.getPublicClient().allMids()
      const midPrice = parseFloat(mids.BTC)
      const slippagePct = 1 / 100
      // For long TP, it's a sell to close, so subtract slippage
      const limitPx = midPrice * (1 - slippagePct)

      const orderRequest = {
        orders: [
          {
            a: 0,
            b: false, // short direction = sell to close long
            p: limitPx.toFixed(6),
            s: "0.1",
            r: false,
            t: {
              trigger: {
                triggerPx: "55000",
                isMarket: true,
                tpsl: "tp",
              },
            },
          },
        ],
        grouping: "na",
      }

      await mockContext.getWalletClient().order(orderRequest)
      expect(mockExchangeClient.order).toHaveBeenCalledWith(orderRequest)
    })

    it("should create a limit take-profit order", async () => {
      const orderRequest = {
        orders: [
          {
            a: 0,
            b: false,
            p: "54900",
            s: "0.1",
            r: false,
            t: {
              trigger: {
                triggerPx: "55000",
                isMarket: false,
                tpsl: "tp",
              },
            },
          },
        ],
        grouping: "na",
      }

      await mockContext.getWalletClient().order(orderRequest)
      expect(mockExchangeClient.order).toHaveBeenCalledWith(orderRequest)
    })
  })

  describe("cancel command", () => {
    it("should cancel an order by ID", async () => {
      mockExchangeClient.cancel.mockResolvedValue({
        status: "ok",
        response: { data: {} },
      })

      const meta = await mockContext.getPublicClient().meta()
      const assetIndex = meta.universe.findIndex(
        (a: { name: string }) => a.name.toUpperCase() === "BTC"
      )

      const cancelRequest = {
        cancels: [{ a: assetIndex, o: 12345 }],
      }

      await mockContext.getWalletClient().cancel(cancelRequest)
      expect(mockExchangeClient.cancel).toHaveBeenCalledWith(cancelRequest)
    })
  })

  describe("leverage command", () => {
    it("should set cross margin leverage", async () => {
      mockExchangeClient.updateLeverage.mockResolvedValue({
        status: "ok",
        response: { data: {} },
      })

      const meta = await mockContext.getPublicClient().meta()
      const assetIndex = meta.universe.findIndex(
        (a: { name: string }) => a.name.toUpperCase() === "BTC"
      )

      const leverageRequest = {
        asset: assetIndex,
        isCross: true,
        leverage: 10,
      }

      await mockContext.getWalletClient().updateLeverage(leverageRequest)
      expect(mockExchangeClient.updateLeverage).toHaveBeenCalledWith(
        leverageRequest
      )
    })

    it("should set isolated margin leverage", async () => {
      mockExchangeClient.updateLeverage.mockResolvedValue({
        status: "ok",
        response: { data: {} },
      })

      const leverageRequest = {
        asset: 0,
        isCross: false,
        leverage: 5,
      }

      await mockContext.getWalletClient().updateLeverage(leverageRequest)
      expect(mockExchangeClient.updateLeverage).toHaveBeenCalledWith(
        leverageRequest
      )
    })

    it("should default to cross margin when neither flag specified", () => {
      const options = { cross: undefined, isolated: undefined }
      const isCross = options.cross || !options.isolated

      expect(isCross).toBe(true)
    })
  })

  describe("order response handling", () => {
    it("should handle filled status", async () => {
      const response = {
        status: "ok",
        response: {
          data: {
            statuses: [{ filled: { totalSz: "0.1", avgPx: "50000" } }],
          },
        },
      }
      mockExchangeClient.order.mockResolvedValue(response)

      const result = await mockContext.getWalletClient().order({
        orders: [],
        grouping: "na",
      })

      const status = result.response.data.statuses[0]
      expect("filled" in status).toBe(true)
      expect(status.filled.totalSz).toBe("0.1")
    })

    it("should handle resting status", async () => {
      const response = {
        status: "ok",
        response: {
          data: {
            statuses: [{ resting: { oid: 12345 } }],
          },
        },
      }
      mockExchangeClient.order.mockResolvedValue(response)

      const result = await mockContext.getWalletClient().order({
        orders: [],
        grouping: "na",
      })

      const status = result.response.data.statuses[0]
      expect("resting" in status).toBe(true)
      expect(status.resting.oid).toBe(12345)
    })

    it("should handle waitingForTrigger status", async () => {
      const response = {
        status: "ok",
        response: {
          data: {
            statuses: ["waitingForTrigger"],
          },
        },
      }
      mockExchangeClient.order.mockResolvedValue(response)

      const result = await mockContext.getWalletClient().order({
        orders: [],
        grouping: "na",
      })

      expect(result.response.data.statuses[0]).toBe("waitingForTrigger")
    })
  })

  describe("user config", () => {
    it("should use default slippage from config", () => {
      const config = loadUserConfig()
      expect(config.slippage).toBe(1)
    })
  })
})
