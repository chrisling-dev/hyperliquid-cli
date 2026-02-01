import { describe, it, expect, beforeEach, vi, afterEach } from "vitest"
import { ServerCache, type AllMidsData } from "./cache.js"
import { AllPerpMetasResponse } from "@nktkas/hyperliquid"
import { AllDexsAssetCtxsEvent } from "@nktkas/hyperliquid/api/subscription"

describe("ServerCache", () => {
  let cache: ServerCache

  beforeEach(() => {
    cache = new ServerCache()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe("allMids", () => {
    it("should return null when no data is set", () => {
      expect(cache.getAllMids()).toBeNull()
    })

    it("should store and retrieve allMids data", () => {
      const data: AllMidsData = {
        BTC: "50000.5",
        ETH: "3000.25",
      }

      vi.setSystemTime(new Date("2024-01-01T00:00:00Z"))
      cache.setAllMids(data)

      const result = cache.getAllMids()
      expect(result).not.toBeNull()
      expect(result!.data).toEqual(data)
      expect(result!.updatedAt).toBe(Date.now())
    })

    it("should update timestamp on each set", () => {
      const data: AllMidsData = { BTC: "50000" }

      vi.setSystemTime(new Date("2024-01-01T00:00:00Z"))
      cache.setAllMids(data)
      const firstTime = cache.getAllMids()!.updatedAt

      vi.advanceTimersByTime(1000)
      cache.setAllMids({ BTC: "51000" })
      const secondTime = cache.getAllMids()!.updatedAt

      expect(secondTime - firstTime).toBe(1000)
    })
  })

  describe("allDexsAssetCtxs", () => {
    it("should return null when no data is set", () => {
      expect(cache.getAllDexsAssetCtxs()).toBeNull()
    })

    it("should store and retrieve asset contexts", () => {
      const data: AllDexsAssetCtxsEvent = {
        ctxs: [
          [
            "",
            [
              {
                dayNtlVlm: "1000000",
                funding: "0.0001",
                impactPxs: ["50000", "50001"],
                markPx: "50000.5",
                midPx: "50000",
                openInterest: "500",
                oraclePx: "50000.1",
                premium: "0.0002",
                prevDayPx: "49000",
                dayBaseVlm: "20",
              },
            ],
          ],
        ],
      }

      vi.setSystemTime(new Date("2024-01-01T12:00:00Z"))
      cache.setAllDexsAssetCtxs(data)

      const result = cache.getAllDexsAssetCtxs()
      expect(result).not.toBeNull()
      expect(result!.data).toEqual(data)
      expect(result!.updatedAt).toBe(Date.now())
    })
  })

  describe("allPerpMetas", () => {
    it("should return null when no data is set", () => {
      expect(cache.getAllPerpMetas()).toBeNull()
    })

    it("should store and retrieve perp metadata", () => {
      const data: AllPerpMetasResponse = [
        {
          universe: [
            { name: "BTC", szDecimals: 4, maxLeverage: 50, marginTableId: 0 },
            { name: "ETH", szDecimals: 3, maxLeverage: 50, marginTableId: 0 },
          ],
          marginTables: [],
          collateralToken: 0,
        },
      ]

      vi.setSystemTime(new Date("2024-01-01T06:00:00Z"))
      cache.setAllPerpMetas(data)

      const result = cache.getAllPerpMetas()
      expect(result).not.toBeNull()
      expect(result!.data).toEqual(data)
      expect(result!.updatedAt).toBe(Date.now())
    })

    it("should handle onlyIsolated flag", () => {
      const data: AllPerpMetasResponse = [
        {
          universe: [
            { name: "MEME", szDecimals: 0, maxLeverage: 10, onlyIsolated: true, marginTableId: 0 },
          ],
          marginTables: [],
          collateralToken: 0,
        },
      ]

      cache.setAllPerpMetas(data)
      const result = cache.getAllPerpMetas()
      expect(result!.data[0].universe[0].onlyIsolated).toBe(true)
    })
  })

  describe("getStatus", () => {
    it("should return all false when cache is empty", () => {
      const status = cache.getStatus()
      expect(status.hasMids).toBe(false)
      expect(status.hasAssetCtxs).toBe(false)
      expect(status.hasPerpMetas).toBe(false)
      expect(status.midsAge).toBeUndefined()
      expect(status.assetCtxsAge).toBeUndefined()
      expect(status.perpMetasAge).toBeUndefined()
    })

    it("should return true for populated caches", () => {
      cache.setAllMids({ BTC: "50000" })
      cache.setAllDexsAssetCtxs({ ctxs: [] })
      cache.setAllPerpMetas([{ universe: [], marginTables: [], collateralToken: 0 }])

      const status = cache.getStatus()
      expect(status.hasMids).toBe(true)
      expect(status.hasAssetCtxs).toBe(true)
      expect(status.hasPerpMetas).toBe(true)
    })

    it("should calculate correct age for each cache", () => {
      vi.setSystemTime(new Date("2024-01-01T00:00:00Z"))
      cache.setAllMids({ BTC: "50000" })

      vi.advanceTimersByTime(1000)
      cache.setAllDexsAssetCtxs({ ctxs: [] })

      vi.advanceTimersByTime(2000)
      cache.setAllPerpMetas([{ universe: [], marginTables: [], collateralToken: 0 }])

      vi.advanceTimersByTime(500)

      const status = cache.getStatus()
      expect(status.midsAge).toBe(3500) // 1000 + 2000 + 500
      expect(status.assetCtxsAge).toBe(2500) // 2000 + 500
      expect(status.perpMetasAge).toBe(500)
    })

    it("should handle partial cache population", () => {
      cache.setAllMids({ BTC: "50000" })
      // Don't set assetCtxs or perpMetas

      const status = cache.getStatus()
      expect(status.hasMids).toBe(true)
      expect(status.hasAssetCtxs).toBe(false)
      expect(status.hasPerpMetas).toBe(false)
      expect(status.midsAge).toBeDefined()
      expect(status.assetCtxsAge).toBeUndefined()
      expect(status.perpMetasAge).toBeUndefined()
    })
  })
})
