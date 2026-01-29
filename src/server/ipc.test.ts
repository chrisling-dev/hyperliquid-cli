import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { ServerCache } from "./cache.js"

// Type for status result
interface StatusResult {
  running: boolean
  testnet: boolean
  connected: boolean
  startedAt: number
  uptime: number
  cache: {
    hasMids: boolean
    hasAssetCtxs: boolean
    hasPerpMetas: boolean
    midsAge?: number
    assetCtxsAge?: number
    perpMetasAge?: number
  }
}

// We need to test the handleRequest logic. Since IPCServer is a class with private methods,
// we'll test it by creating a minimal test harness that exposes the request handling.

// Extract the request handling logic for testing
function createRequestHandler(
  cache: ServerCache,
  isTestnet: boolean,
  startedAt: number,
  isConnected: () => boolean
) {
  return function handleRequest(request: {
    id: string
    method: string
    params?: Record<string, unknown>
  }) {
    const { id, method, params } = request

    switch (method) {
      case "getPrices": {
        const entry = cache.getAllMids()
        if (!entry) {
          return { id, error: "No data available" }
        }
        const coin = params?.coin as string | undefined
        if (coin) {
          const price = entry.data[coin.toUpperCase()]
          if (price === undefined) {
            return { id, error: `Coin not found: ${coin}` }
          }
          return { id, result: { [coin.toUpperCase()]: price }, cached_at: entry.updatedAt }
        }
        return { id, result: entry.data, cached_at: entry.updatedAt }
      }

      case "getAssetCtxs": {
        const entry = cache.getAllDexsAssetCtxs()
        if (!entry) {
          return { id, error: "No data available" }
        }
        return { id, result: entry.data, cached_at: entry.updatedAt }
      }

      case "getPerpMeta": {
        const entry = cache.getAllPerpMetas()
        if (!entry) {
          return { id, error: "No data available" }
        }
        return { id, result: entry.data, cached_at: entry.updatedAt }
      }

      case "getStatus": {
        const cacheStatus = cache.getStatus()
        return {
          id,
          result: {
            running: true,
            testnet: isTestnet,
            connected: isConnected(),
            startedAt: startedAt,
            uptime: Date.now() - startedAt,
            cache: cacheStatus,
          },
        }
      }

      case "shutdown": {
        return { id, result: { ok: true } }
      }

      default:
        return { id, error: `Unknown method: ${method}` }
    }
  }
}

describe("IPC Request Handler", () => {
  let cache: ServerCache
  let handleRequest: ReturnType<typeof createRequestHandler>
  let startedAt: number

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2024-01-01T00:00:00Z"))
    startedAt = Date.now() - 60000 // Started 1 minute ago (calculated after fake timers set)
    cache = new ServerCache()
    handleRequest = createRequestHandler(cache, false, startedAt, () => true)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("getPrices", () => {
    it("should return error when cache is empty", () => {
      const response = handleRequest({ id: "1", method: "getPrices" })
      expect(response.error).toBe("No data available")
    })

    it("should return all prices when no coin specified", () => {
      cache.setAllMids({ BTC: "50000", ETH: "3000" })

      const response = handleRequest({ id: "1", method: "getPrices" })
      expect(response.error).toBeUndefined()
      expect(response.result).toEqual({ BTC: "50000", ETH: "3000" })
      expect(response.cached_at).toBeDefined()
    })

    it("should return single price when coin is specified", () => {
      cache.setAllMids({ BTC: "50000", ETH: "3000" })

      const response = handleRequest({
        id: "1",
        method: "getPrices",
        params: { coin: "btc" },
      })
      expect(response.result).toEqual({ BTC: "50000" })
    })

    it("should handle uppercase coin param", () => {
      cache.setAllMids({ BTC: "50000" })

      const response = handleRequest({
        id: "1",
        method: "getPrices",
        params: { coin: "BTC" },
      })
      expect(response.result).toEqual({ BTC: "50000" })
    })

    it("should return error for unknown coin", () => {
      cache.setAllMids({ BTC: "50000" })

      const response = handleRequest({
        id: "1",
        method: "getPrices",
        params: { coin: "UNKNOWN" },
      })
      expect(response.error).toBe("Coin not found: UNKNOWN")
    })
  })

  describe("getAssetCtxs", () => {
    it("should return error when cache is empty", () => {
      const response = handleRequest({ id: "1", method: "getAssetCtxs" })
      expect(response.error).toBe("No data available")
    })

    it("should return asset contexts when available", () => {
      const mockData = {
        ctxs: [
          [
            "",
            [
              {
                dayNtlVlm: "1000000",
                funding: "0.0001",
                impactPxs: null,
                markPx: "50000",
                midPx: "50000",
                openInterest: "500",
                oraclePx: "50000",
                premium: null,
                prevDayPx: "49000",
                dayBaseVlm: "20",
              },
            ],
          ],
        ],
      }
      cache.setAllDexsAssetCtxs(mockData as Parameters<typeof cache.setAllDexsAssetCtxs>[0])

      const response = handleRequest({ id: "1", method: "getAssetCtxs" })
      expect(response.error).toBeUndefined()
      expect(response.result).toEqual(mockData)
      expect(response.cached_at).toBeDefined()
    })
  })

  describe("getPerpMeta", () => {
    it("should return error when cache is empty", () => {
      const response = handleRequest({ id: "1", method: "getPerpMeta" })
      expect(response.error).toBe("No data available")
    })

    it("should return perp metadata when available", () => {
      const mockData = {
        universe: [
          { name: "BTC", szDecimals: 4, maxLeverage: 50 },
          { name: "ETH", szDecimals: 3, maxLeverage: 50 },
        ],
      }
      cache.setAllPerpMetas(mockData)

      const response = handleRequest({ id: "1", method: "getPerpMeta" })
      expect(response.error).toBeUndefined()
      expect(response.result).toEqual(mockData)
      expect(response.cached_at).toBeDefined()
    })
  })

  describe("getStatus", () => {
    it("should return server status", () => {
      cache.setAllMids({ BTC: "50000" })

      const response = handleRequest({ id: "1", method: "getStatus" })
      expect(response.error).toBeUndefined()

      const result = response.result as StatusResult
      expect(result.running).toBe(true)
      expect(result.testnet).toBe(false)
      expect(result.connected).toBe(true)
      expect(result.startedAt).toBe(startedAt)
      expect(result.uptime).toBeGreaterThan(0)
      expect(result.cache.hasMids).toBe(true)
      expect(result.cache.hasAssetCtxs).toBe(false)
    })

    it("should reflect testnet mode", () => {
      const testnetHandler = createRequestHandler(cache, true, startedAt, () => true)
      const response = testnetHandler({ id: "1", method: "getStatus" })

      const result = response.result as StatusResult
      expect(result.testnet).toBe(true)
    })

    it("should reflect disconnected state", () => {
      const disconnectedHandler = createRequestHandler(cache, false, startedAt, () => false)
      const response = disconnectedHandler({ id: "1", method: "getStatus" })

      const result = response.result as StatusResult
      expect(result.connected).toBe(false)
    })
  })

  describe("shutdown", () => {
    it("should return ok result", () => {
      const response = handleRequest({ id: "1", method: "shutdown" })
      expect(response.error).toBeUndefined()
      expect(response.result).toEqual({ ok: true })
    })
  })

  describe("unknown method", () => {
    it("should return error for unknown method", () => {
      const response = handleRequest({ id: "1", method: "unknownMethod" })
      expect(response.error).toBe("Unknown method: unknownMethod")
    })
  })

  describe("request ID preservation", () => {
    it("should preserve request ID in response", () => {
      const response = handleRequest({ id: "test-123", method: "shutdown" })
      expect(response.id).toBe("test-123")
    })
  })
})
