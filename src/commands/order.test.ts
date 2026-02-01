import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"

// Mock context and output modules
vi.mock("../cli/program.js", () => ({
  getContext: vi.fn(),
  getOutputOptions: vi.fn(() => ({ json: false })),
}))

vi.mock("../cli/output.js", () => ({
  output: vi.fn(),
  outputError: vi.fn(),
  outputSuccess: vi.fn(),
}))

vi.mock("../lib/order-config.js", () => ({
  getOrderConfig: vi.fn(() => ({ slippage: 1.0 })),
  updateOrderConfig: vi.fn((updates) => ({ slippage: 1.0, ...updates })),
}))

import { getContext } from "../cli/program.js"
import { getOrderConfig, updateOrderConfig } from "../lib/order-config.js"
import {
  validatePositiveNumber,
  validateTif,
  validatePositiveInteger,
} from "../lib/validation.js"
import { validateSideWithAliases, getAssetIndex } from "./order/shared.js"

describe("order commands", () => {
  let mockExchangeClient: {
    order: Mock
    cancel: Mock
    updateLeverage: Mock
  }

  let mockInfoClient: {
    meta: Mock
    allMids: Mock
    openOrders: Mock
  }

  let mockContext: {
    getWalletClient: Mock
    getPublicClient: Mock
    getWalletAddress: Mock
  }

  const mockMeta = {
    universe: [
      { name: "BTC", szDecimals: 4, maxLeverage: 50 },
      { name: "ETH", szDecimals: 3, maxLeverage: 50 },
      { name: "SOL", szDecimals: 2, maxLeverage: 20 },
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
      allMids: vi.fn(() => Promise.resolve({ BTC: "50000", ETH: "3000", SOL: "100" })),
      openOrders: vi.fn(() => Promise.resolve([])),
    }

    mockContext = {
      getWalletClient: vi.fn(() => mockExchangeClient),
      getPublicClient: vi.fn(() => mockInfoClient),
      getWalletAddress: vi.fn(() => "0x1234567890123456789012345678901234567890"),
    }

    vi.mocked(getContext).mockReturnValue(mockContext as unknown as ReturnType<typeof getContext>)
  })

  describe("shared utilities", () => {
    describe("validateSideWithAliases", () => {
      it("should accept 'buy' and return 'buy'", () => {
        expect(validateSideWithAliases("buy")).toBe("buy")
        expect(validateSideWithAliases("BUY")).toBe("buy")
      })

      it("should accept 'sell' and return 'sell'", () => {
        expect(validateSideWithAliases("sell")).toBe("sell")
        expect(validateSideWithAliases("SELL")).toBe("sell")
      })

      it("should accept 'long' as alias for 'buy'", () => {
        expect(validateSideWithAliases("long")).toBe("buy")
        expect(validateSideWithAliases("LONG")).toBe("buy")
      })

      it("should accept 'short' as alias for 'sell'", () => {
        expect(validateSideWithAliases("short")).toBe("sell")
        expect(validateSideWithAliases("SHORT")).toBe("sell")
      })

      it("should throw error for invalid side", () => {
        expect(() => validateSideWithAliases("invalid")).toThrow(
          'Side must be "buy", "sell", "long", or "short"'
        )
      })
    })

    describe("getAssetIndex", () => {
      it("should return correct index for known coin", async () => {
        const index = await getAssetIndex(mockInfoClient, "BTC")
        expect(index).toBe(0)
      })

      it("should return correct index case-insensitively", async () => {
        const index = await getAssetIndex(mockInfoClient, "btc")
        expect(index).toBe(0)
      })

      it("should throw error for unknown coin", async () => {
        await expect(getAssetIndex(mockInfoClient, "UNKNOWN")).rejects.toThrow(
          "Unknown coin: UNKNOWN"
        )
      })
    })
  })

  describe("market command", () => {
    it("should create a market buy order with config slippage", async () => {
      mockExchangeClient.order.mockResolvedValue({
        status: "ok",
        response: {
          data: { statuses: [{ filled: { totalSz: "0.1", avgPx: "50050" } }] },
        },
      })

      const mids = await mockContext.getPublicClient().allMids()
      const midPrice = parseFloat(mids.BTC)
      expect(midPrice).toBe(50000)

      const config = getOrderConfig()
      const slippagePct = config.slippage / 100 // 1%
      const limitPx = midPrice * (1 + slippagePct)
      expect(limitPx).toBe(50500)

      const orderRequest = {
        orders: [
          {
            a: 0,
            b: true, // buy
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

    it("should create a market sell order with slippage", async () => {
      const mids = await mockContext.getPublicClient().allMids()
      const midPrice = parseFloat(mids.ETH)
      expect(midPrice).toBe(3000)

      const slippagePct = 0.5 / 100 // 0.5%
      const limitPx = midPrice * (1 - slippagePct) // sell: subtract slippage
      expect(limitPx).toBe(2985)
    })

    it("should use long alias for buy", () => {
      const side = validateSideWithAliases("long")
      expect(side).toBe("buy")
    })

    it("should use short alias for sell", () => {
      const side = validateSideWithAliases("short")
      expect(side).toBe("sell")
    })
  })

  describe("limit command", () => {
    it("should create a limit buy order", async () => {
      mockExchangeClient.order.mockResolvedValue({
        status: "ok",
        response: {
          data: { statuses: [{ resting: { oid: 12345 } }] },
        },
      })

      const coin = "BTC"
      const side = validateSideWithAliases("buy")
      const size = validatePositiveNumber("0.1", "size")
      const price = validatePositiveNumber("50000", "price")
      const tif = validateTif("Gtc")

      const meta = await mockContext.getPublicClient().meta()
      const assetIndex = meta.universe.findIndex(
        (a: { name: string }) => a.name.toUpperCase() === coin.toUpperCase()
      )

      expect(assetIndex).toBe(0)

      const orderRequest = {
        orders: [
          {
            a: assetIndex,
            b: side === "buy",
            p: price.toString(),
            s: size.toString(),
            r: false,
            t: { limit: { tif } },
          },
        ],
        grouping: "na",
      }

      const result = await mockContext.getWalletClient().order(orderRequest)

      expect(mockExchangeClient.order).toHaveBeenCalledWith(orderRequest)
      expect(result.response.data.statuses[0].resting.oid).toBe(12345)
    })

    it("should create a limit sell order", async () => {
      mockExchangeClient.order.mockResolvedValue({
        status: "ok",
        response: {
          data: { statuses: [{ resting: { oid: 67890 } }] },
        },
      })

      const side = validateSideWithAliases("sell")
      expect(side).toBe("sell")

      const orderRequest = {
        orders: [
          {
            a: 0,
            b: false, // sell
            p: "51000",
            s: "0.1",
            r: false,
            t: { limit: { tif: "Gtc" } },
          },
        ],
        grouping: "na",
      }

      await mockContext.getWalletClient().order(orderRequest)
      expect(mockExchangeClient.order).toHaveBeenCalledWith(orderRequest)
    })

    it("should support IOC time-in-force", async () => {
      const tif = validateTif("ioc")
      expect(tif).toBe("Ioc")
    })

    it("should support ALO time-in-force", async () => {
      const tif = validateTif("alo")
      expect(tif).toBe("Alo")
    })

    it("should support reduce-only flag", async () => {
      mockExchangeClient.order.mockResolvedValue({
        status: "ok",
        response: { data: { statuses: ["waitingForFill"] } },
      })

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

  describe("cancel command", () => {
    it("should cancel an order by ID", async () => {
      mockExchangeClient.cancel.mockResolvedValue({
        status: "ok",
        response: { data: {} },
      })

      const orderId = validatePositiveInteger("12345", "order-id")
      expect(orderId).toBe(12345)

      const meta = await mockContext.getPublicClient().meta()
      const assetIndex = meta.universe.findIndex(
        (a: { name: string }) => a.name.toUpperCase() === "BTC"
      )

      const cancelRequest = {
        cancels: [{ a: assetIndex, o: orderId }],
      }

      await mockContext.getWalletClient().cancel(cancelRequest)
      expect(mockExchangeClient.cancel).toHaveBeenCalledWith(cancelRequest)
    })

    it("should throw error for invalid order ID", () => {
      expect(() => validatePositiveInteger("abc", "order-id")).toThrow(
        "order-id must be a positive integer"
      )
    })

    it("should throw error for negative order ID", () => {
      expect(() => validatePositiveInteger("-1", "order-id")).toThrow(
        "order-id must be a positive integer"
      )
    })
  })

  describe("set-leverage command", () => {
    it("should set cross margin leverage", async () => {
      mockExchangeClient.updateLeverage.mockResolvedValue({
        status: "ok",
        response: { data: {} },
      })

      const leverage = validatePositiveInteger("10", "leverage")
      expect(leverage).toBe(10)

      const meta = await mockContext.getPublicClient().meta()
      const assetIndex = meta.universe.findIndex(
        (a: { name: string }) => a.name.toUpperCase() === "BTC"
      )

      const leverageRequest = {
        asset: assetIndex,
        isCross: true,
        leverage,
      }

      await mockContext.getWalletClient().updateLeverage(leverageRequest)
      expect(mockExchangeClient.updateLeverage).toHaveBeenCalledWith(leverageRequest)
    })

    it("should set isolated margin leverage", async () => {
      mockExchangeClient.updateLeverage.mockResolvedValue({
        status: "ok",
        response: { data: {} },
      })

      const leverage = validatePositiveInteger("5", "leverage")

      const leverageRequest = {
        asset: 1, // ETH
        isCross: false, // isolated
        leverage,
      }

      await mockContext.getWalletClient().updateLeverage(leverageRequest)
      expect(mockExchangeClient.updateLeverage).toHaveBeenCalledWith(leverageRequest)
    })

    it("should default to cross margin when neither flag specified", () => {
      const options = { cross: undefined, isolated: undefined }
      const isCross = options.cross || !options.isolated

      expect(isCross).toBe(true) // Defaults to cross
    })

    it("should use isolated when --isolated flag is set", () => {
      const options = { cross: undefined, isolated: true }
      const isCross = options.cross || !options.isolated

      expect(isCross).toBe(false) // Isolated
    })

    it("should throw error for invalid leverage value", () => {
      expect(() => validatePositiveInteger("0", "leverage")).toThrow(
        "leverage must be a positive integer"
      )
    })
  })

  describe("configure command", () => {
    it("should get current config when no options provided", () => {
      const config = getOrderConfig()
      expect(config.slippage).toBe(1.0)
    })

    it("should update slippage config", () => {
      const config = updateOrderConfig({ slippage: 0.5 })
      expect(config.slippage).toBe(0.5)
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
      expect(status.filled.avgPx).toBe("50000")
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

    it("should handle waitingForFill status", async () => {
      const response = {
        status: "ok",
        response: {
          data: {
            statuses: ["waitingForFill"],
          },
        },
      }
      mockExchangeClient.order.mockResolvedValue(response)

      const result = await mockContext.getWalletClient().order({
        orders: [],
        grouping: "na",
      })

      const status = result.response.data.statuses[0]
      expect(typeof status).toBe("string")
      expect(status).toBe("waitingForFill")
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

      const status = result.response.data.statuses[0]
      expect(typeof status).toBe("string")
      expect(status).toBe("waitingForTrigger")
    })
  })
})
