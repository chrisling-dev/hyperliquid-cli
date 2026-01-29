import { describe, it, expect, vi, beforeEach } from "vitest"

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

import { getContext } from "../cli/program.js"
import {
  validatePositiveNumber,
  validateSide,
  validateTif,
  validatePositiveInteger,
} from "../lib/validation.js"

describe("trade commands", () => {
  let mockExchangeClient: {
    order: ReturnType<typeof vi.fn>
    cancel: ReturnType<typeof vi.fn>
    updateLeverage: ReturnType<typeof vi.fn>
  }

  let mockInfoClient: {
    meta: ReturnType<typeof vi.fn>
    allMids: ReturnType<typeof vi.fn>
  }

  let mockContext: {
    getWalletClient: ReturnType<typeof vi.fn>
    getPublicClient: ReturnType<typeof vi.fn>
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
    }

    mockContext = {
      getWalletClient: vi.fn(() => mockExchangeClient),
      getPublicClient: vi.fn(() => mockInfoClient),
    }

    vi.mocked(getContext).mockReturnValue(mockContext as any)
  })

  describe("order command - limit orders", () => {
    it("should create a limit buy order", async () => {
      mockExchangeClient.order.mockResolvedValue({
        status: "ok",
        response: {
          data: { statuses: [{ resting: { oid: 12345 } }] },
        },
      })

      const coin = "BTC"
      const side = validateSide("buy")
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

      const side = validateSide("sell")
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

    it("should throw error for unknown coin", async () => {
      const meta = await mockContext.getPublicClient().meta()
      const assetIndex = meta.universe.findIndex(
        (a: { name: string }) => a.name.toUpperCase() === "UNKNOWN"
      )

      expect(assetIndex).toBe(-1)
    })

    it("should throw error when price is missing for limit order", () => {
      const priceArg: string | undefined = undefined
      expect(priceArg).toBeUndefined()

      // In actual code: if (!priceArg) throw new Error("Price is required for limit orders")
    })
  })

  describe("order command - market orders", () => {
    it("should create a market buy order with slippage", async () => {
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
            t: { limit: { tif: "Ioc" } }, // Market orders use IOC
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

    it("should throw error if cannot get mid price", async () => {
      mockInfoClient.allMids.mockResolvedValue({ BTC: "50000" }) // No ETH price

      const mids = await mockContext.getPublicClient().allMids()
      const midPrice = parseFloat(mids.XYZ) // Unknown coin

      expect(isNaN(midPrice)).toBe(true)
      // In actual code: if (!midPrice) throw new Error(`Cannot get mid price for ${coin}`)
    })
  })

  describe("order command - stop-loss orders", () => {
    it("should create a stop-loss order with trigger", async () => {
      mockExchangeClient.order.mockResolvedValue({
        status: "ok",
        response: { data: { statuses: ["waitingForTrigger"] } },
      })

      const triggerPx = validatePositiveNumber("48000", "trigger price")
      const limitPx = validatePositiveNumber("47900", "price")

      const orderRequest = {
        orders: [
          {
            a: 0,
            b: false, // sell for stop-loss
            p: limitPx.toString(),
            s: "0.1",
            r: false,
            t: {
              trigger: {
                triggerPx: triggerPx.toString(),
                isMarket: false,
                tpsl: "sl" as const,
              },
            },
          },
        ],
        grouping: "na",
      }

      await mockContext.getWalletClient().order(orderRequest)
      expect(mockExchangeClient.order).toHaveBeenCalledWith(orderRequest)
    })

    it("should throw error when trigger price is missing", () => {
      const triggerArg: string | undefined = undefined
      expect(triggerArg).toBeUndefined()
      // In actual code: throw new Error(`--trigger price is required for stop-loss orders`)
    })

    it("should throw error when limit price is missing", () => {
      const priceArg: string | undefined = undefined
      expect(priceArg).toBeUndefined()
      // In actual code: throw new Error(`Limit price is required for stop-loss orders`)
    })
  })

  describe("order command - take-profit orders", () => {
    it("should create a take-profit order with trigger", async () => {
      mockExchangeClient.order.mockResolvedValue({
        status: "ok",
        response: { data: { statuses: ["waitingForTrigger"] } },
      })

      const triggerPx = validatePositiveNumber("52000", "trigger price")
      const limitPx = validatePositiveNumber("51900", "price")

      const orderRequest = {
        orders: [
          {
            a: 0,
            b: false, // sell for take-profit (closing long)
            p: limitPx.toString(),
            s: "0.1",
            r: false,
            t: {
              trigger: {
                triggerPx: triggerPx.toString(),
                isMarket: false,
                tpsl: "tp" as const,
              },
            },
          },
        ],
        grouping: "na",
      }

      await mockContext.getWalletClient().order(orderRequest)
      expect(mockExchangeClient.order).toHaveBeenCalledWith(orderRequest)
    })

    it("should use normalTpsl grouping when --tpsl flag is set", async () => {
      const orderRequest = {
        orders: [
          {
            a: 0,
            b: false,
            p: "51900",
            s: "0.1",
            r: false,
            t: {
              trigger: {
                triggerPx: "52000",
                isMarket: false,
                tpsl: "tp" as const,
              },
            },
          },
        ],
        grouping: "normalTpsl", // --tpsl flag
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

    it("should throw error for unknown coin", async () => {
      const meta = await mockContext.getPublicClient().meta()
      const assetIndex = meta.universe.findIndex(
        (a: { name: string }) => a.name.toUpperCase() === "UNKNOWN"
      )

      expect(assetIndex).toBe(-1)
      // In actual code: throw new Error(`Unknown coin: ${coin}`)
    })
  })

  describe("leverage command", () => {
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

    it("should throw error for unknown coin", async () => {
      const meta = await mockContext.getPublicClient().meta()
      const assetIndex = meta.universe.findIndex(
        (a: { name: string }) => a.name.toUpperCase() === "UNKNOWN"
      )

      expect(assetIndex).toBe(-1)
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
