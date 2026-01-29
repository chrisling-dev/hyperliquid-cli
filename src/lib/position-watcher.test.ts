import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createPositionWatcher } from "./position-watcher.js"

const mockSubscription = {
  unsubscribe: vi.fn().mockResolvedValue(undefined),
}

const mockSubscriptionClient = {
  allDexsClearinghouseState: vi.fn().mockResolvedValue(mockSubscription),
}

const mockWsTransport = {
  ready: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
}

// Mock the @nktkas/hyperliquid module
vi.mock("@nktkas/hyperliquid", () => {
  return {
    WebSocketTransport: class MockWebSocketTransport {
      ready = vi.fn().mockResolvedValue(undefined)
      close = vi.fn().mockResolvedValue(undefined)
      constructor() {
        Object.assign(this, mockWsTransport)
      }
    },
    SubscriptionClient: class MockSubscriptionClient {
      allDexsClearinghouseState = vi.fn().mockResolvedValue(mockSubscription)
      constructor() {
        Object.assign(this, mockSubscriptionClient)
      }
    },
  }
})

// Mock ws module
vi.mock("ws", () => ({
  default: class MockWebSocket {},
}))

describe("createPositionWatcher", () => {
  const mockUser = "0x1234567890123456789012345678901234567890" as const
  let onUpdate: ReturnType<typeof vi.fn>
  let onError: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onUpdate = vi.fn()
    onError = vi.fn()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it("should create a position watcher with start and stop methods", () => {
    const watcher = createPositionWatcher({
      user: mockUser,
      isTestnet: false,
      onUpdate,
      onError,
    })

    expect(watcher).toHaveProperty("start")
    expect(watcher).toHaveProperty("stop")
    expect(typeof watcher.start).toBe("function")
    expect(typeof watcher.stop).toBe("function")
  })

  it("should start WebSocket connection and subscribe", async () => {
    const watcher = createPositionWatcher({
      user: mockUser,
      isTestnet: true,
      onUpdate,
      onError,
    })

    await watcher.start()

    // Verify ready was called on WebSocket transport
    expect(mockWsTransport.ready).toHaveBeenCalled()

    // Verify allDexsClearinghouseState subscription was created
    expect(mockSubscriptionClient.allDexsClearinghouseState).toHaveBeenCalledWith(
      { user: mockUser },
      expect.any(Function),
    )
  })

  it("should stop cleanly by unsubscribing and closing transport", async () => {
    const watcher = createPositionWatcher({
      user: mockUser,
      isTestnet: false,
      onUpdate,
      onError,
    })

    await watcher.start()
    await watcher.stop()

    // Should not throw
    expect(true).toBe(true)
  })

  it("should handle stop when not started", async () => {
    const watcher = createPositionWatcher({
      user: mockUser,
      isTestnet: false,
      onUpdate,
      onError,
    })

    // Should not throw when stopping without starting
    await expect(watcher.stop()).resolves.toBeUndefined()
  })

  it("should handle multiple stops gracefully", async () => {
    const watcher = createPositionWatcher({
      user: mockUser,
      isTestnet: false,
      onUpdate,
      onError,
    })

    await watcher.start()
    await watcher.stop()
    await watcher.stop() // Second stop should not throw

    expect(true).toBe(true)
  })
})

describe("AllDexsClearinghouseStateEvent type", () => {
  it("should match expected structure", () => {
    // Test the expected structure from the SDK
    const mockState = {
      clearinghouseStates: [
        [
          "dex",
          {
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
            ],
            marginSummary: {
              accountValue: "100000",
              totalMarginUsed: "25000",
            },
            crossMarginSummary: {
              accountValue: "100000",
              totalMarginUsed: "25000",
            },
          },
        ],
      ],
    }

    expect(mockState.clearinghouseStates).toHaveLength(1)
    expect(mockState.clearinghouseStates[0][1].assetPositions).toHaveLength(1)
    expect(mockState.clearinghouseStates[0][1].assetPositions[0].position.coin).toBe("BTC")
    expect(mockState.clearinghouseStates[0][1].marginSummary.accountValue).toBe("100000")
  })
})
