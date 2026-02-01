import { describe, it, expect, vi, beforeEach, type Mock } from "vitest"

// Mock context and output modules
vi.mock("../cli/program.js", () => ({
  getContext: vi.fn(),
  getOutputOptions: vi.fn(() => ({ json: false })),
}))

vi.mock("../cli/output.js", () => ({
  output: vi.fn(),
  outputError: vi.fn(),
}))

import { getContext } from "../cli/program.js"

describe("info commands", () => {
  let mockInfoClient: {
    allMids: Mock
    meta: Mock
    allPerpMetas: Mock
    metaAndAssetCtxs: Mock
    l2Book: Mock
    clearinghouseState: Mock
    openOrders: Mock
  }

  let mockServerClient: {
    getPrices: Mock
    getPerpMeta: Mock
    getAssetCtxs: Mock
    close: Mock
  }

  let mockContext: {
    getPublicClient: Mock
    getServerClient: Mock
    getWalletAddress: Mock
  }

  beforeEach(() => {
    vi.resetAllMocks()

    mockInfoClient = {
      allMids: vi.fn(),
      meta: vi.fn(),
      allPerpMetas: vi.fn(),
      metaAndAssetCtxs: vi.fn(),
      l2Book: vi.fn(),
      clearinghouseState: vi.fn(),
      openOrders: vi.fn(),
    }

    mockServerClient = {
      getPrices: vi.fn(),
      getPerpMeta: vi.fn(),
      getAssetCtxs: vi.fn(),
      close: vi.fn(),
    }

    mockContext = {
      getPublicClient: vi.fn(() => mockInfoClient),
      getServerClient: vi.fn(() => Promise.resolve(null)),
      getWalletAddress: vi.fn(() => "0x1234567890abcdef1234567890abcdef12345678"),
    }

    vi.mocked(getContext).mockReturnValue(mockContext as unknown as ReturnType<typeof getContext>)
  })

  describe("meta command logic", () => {
    it("should return meta from HTTP when no server", async () => {
      const meta = {
        universe: [
          { name: "BTC", szDecimals: 4, maxLeverage: 50 },
          { name: "ETH", szDecimals: 3, maxLeverage: 50 },
        ],
      }
      mockInfoClient.meta.mockResolvedValue(meta)

      const result = await mockContext.getPublicClient().meta()
      expect(result).toEqual(meta)
    })

    it("should return meta from server cache when available", async () => {
      const cachedMeta = {
        universe: [{ name: "BTC", szDecimals: 4, maxLeverage: 50 }],
      }
      mockServerClient.getPerpMeta.mockResolvedValue({
        data: cachedMeta,
        cached_at: Date.now(),
      })
      mockContext.getServerClient.mockResolvedValue(mockServerClient)

      const serverClient = await mockContext.getServerClient()
      const { data } = await serverClient!.getPerpMeta()

      expect(data).toEqual(cachedMeta)
    })
  })

  describe("allPerpMetas command logic", () => {
    it("should return allPerpMetas from HTTP when no server", async () => {
      const metas = {
        universe: [
          { name: "BTC", szDecimals: 4, maxLeverage: 50 },
          { name: "ETH", szDecimals: 3, maxLeverage: 50, onlyIsolated: true },
        ],
      }
      mockInfoClient.allPerpMetas.mockResolvedValue(metas)

      const result = await mockContext.getPublicClient().allPerpMetas()
      expect(result).toEqual(metas)
    })
  })

  describe("markets command logic", () => {
    it("should combine meta and asset contexts", async () => {
      const meta = {
        universe: [
          { name: "BTC", szDecimals: 4, maxLeverage: 50 },
          { name: "ETH", szDecimals: 3, maxLeverage: 50 },
        ],
      }
      const contexts = [
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
        {
          dayNtlVlm: "500000",
          funding: "0.0002",
          impactPxs: null,
          markPx: "3000",
          midPx: "3000",
          openInterest: "200",
          oraclePx: "3000",
          premium: null,
          prevDayPx: "2900",
          dayBaseVlm: "10",
        },
      ]
      mockInfoClient.metaAndAssetCtxs.mockResolvedValue([meta, contexts])

      const data = await mockContext.getPublicClient().metaAndAssetCtxs()
      const [metaResult, contextsResult] = data

      const markets = metaResult.universe.map(
        (asset: { name: string; szDecimals: number; maxLeverage: number }, i: number) => ({
          coin: asset.name,
          szDecimals: asset.szDecimals,
          maxLeverage: asset.maxLeverage,
          ...contextsResult[i],
        })
      )

      expect(markets).toHaveLength(2)
      expect(markets[0].coin).toBe("BTC")
      expect(markets[0].markPx).toBe("50000")
      expect(markets[1].coin).toBe("ETH")
      expect(markets[1].markPx).toBe("3000")
    })
  })

  describe("book command logic", () => {
    it("should always use HTTP for fresh order book", async () => {
      const book = {
        levels: [
          [
            { px: "50000", sz: "1.5", n: 3 },
            { px: "49999", sz: "2.0", n: 5 },
          ],
          [
            { px: "50001", sz: "1.0", n: 2 },
            { px: "50002", sz: "3.0", n: 4 },
          ],
        ],
      }
      mockInfoClient.l2Book.mockResolvedValue(book)

      const result = await mockContext.getPublicClient().l2Book({ coin: "BTC" })
      expect(mockInfoClient.l2Book).toHaveBeenCalledWith({ coin: "BTC" })
      expect(result).toEqual(book)
    })

    it("should normalize coin to uppercase", async () => {
      mockInfoClient.l2Book.mockResolvedValue({ levels: [] })

      const coin = "btc"
      await mockContext.getPublicClient().l2Book({ coin: coin.toUpperCase() })

      expect(mockInfoClient.l2Book).toHaveBeenCalledWith({ coin: "BTC" })
    })
  })

  describe("positions command logic", () => {
    it("should filter out zero-size positions", async () => {
      const state = {
        assetPositions: [
          {
            position: {
              coin: "BTC",
              szi: "0.5",
              entryPx: "50000",
              positionValue: "25000",
              unrealizedPnl: "500",
              leverage: { type: "cross", value: 10 },
              liquidationPx: "45000",
            },
          },
          {
            position: {
              coin: "ETH",
              szi: "0", // Zero size - should be filtered
              entryPx: "3000",
              positionValue: "0",
              unrealizedPnl: "0",
              leverage: { type: "cross", value: 10 },
              liquidationPx: null,
            },
          },
        ],
        marginSummary: { accountValue: "100000", totalMarginUsed: "25000" },
        crossMarginSummary: {},
      }
      mockInfoClient.clearinghouseState.mockResolvedValue(state)

      const user = mockContext.getWalletAddress()
      const result = await mockContext.getPublicClient().clearinghouseState({ user })

      const positions = result.assetPositions
        .map((p: { position: { szi: string } }) => p.position)
        .filter((p: { szi: string }) => parseFloat(p.szi) !== 0)

      expect(positions).toHaveLength(1)
      expect(positions[0].coin).toBe("BTC")
    })

    it("should use custom user address when provided", async () => {
      const customAddress = "0xabcdef1234567890abcdef1234567890abcdef12"
      mockInfoClient.clearinghouseState.mockResolvedValue({
        assetPositions: [],
        marginSummary: {},
        crossMarginSummary: {},
      })

      await mockContext.getPublicClient().clearinghouseState({ user: customAddress })

      expect(mockInfoClient.clearinghouseState).toHaveBeenCalledWith({
        user: customAddress,
      })
    })

    it("should use default wallet address when no user specified", () => {
      const defaultAddress = mockContext.getWalletAddress()
      expect(defaultAddress).toBe("0x1234567890abcdef1234567890abcdef12345678")
    })
  })

  describe("orders command logic", () => {
    it("should format open orders", async () => {
      const orders = [
        {
          oid: 123,
          coin: "BTC",
          side: "B",
          sz: "0.1",
          limitPx: "50000",
          timestamp: 1700000000000,
        },
        {
          oid: 456,
          coin: "ETH",
          side: "A",
          sz: "1.0",
          limitPx: "3000",
          timestamp: 1700000001000,
        },
      ]
      mockInfoClient.openOrders.mockResolvedValue(orders)

      const user = mockContext.getWalletAddress()
      const result = await mockContext.getPublicClient().openOrders({ user })

      const formatted = result.map((o: typeof orders[0]) => ({
        oid: o.oid,
        coin: o.coin,
        side: o.side,
        sz: o.sz,
        limitPx: o.limitPx,
        timestamp: o.timestamp,
      }))

      expect(formatted).toHaveLength(2)
      expect(formatted[0].oid).toBe(123)
      expect(formatted[1].coin).toBe("ETH")
    })

    it("should handle empty orders list", async () => {
      mockInfoClient.openOrders.mockResolvedValue([])

      const user = mockContext.getWalletAddress()
      const result = await mockContext.getPublicClient().openOrders({ user })

      expect(result).toHaveLength(0)
    })
  })
})
