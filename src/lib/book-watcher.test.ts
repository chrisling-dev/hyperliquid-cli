import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createBookWatcher } from "./book-watcher.js"

const mockSubscription = {
  unsubscribe: vi.fn().mockResolvedValue(undefined),
}

const mockSubscriptionClient = {
  l2Book: vi.fn().mockResolvedValue(mockSubscription),
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
      l2Book = vi.fn().mockResolvedValue(mockSubscription)
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

describe("createBookWatcher", () => {
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

  it("should create a book watcher with start and stop methods", () => {
    const watcher = createBookWatcher({
      coin: "BTC",
      isTestnet: false,
      onUpdate,
      onError,
    })

    expect(watcher).toHaveProperty("start")
    expect(watcher).toHaveProperty("stop")
    expect(typeof watcher.start).toBe("function")
    expect(typeof watcher.stop).toBe("function")
  })

  it("should start WebSocket connection and subscribe to l2Book", async () => {
    const watcher = createBookWatcher({
      coin: "BTC",
      isTestnet: true,
      onUpdate,
      onError,
    })

    await watcher.start()

    // Verify ready was called on WebSocket transport
    expect(mockWsTransport.ready).toHaveBeenCalled()

    // Verify l2Book subscription was created with correct coin
    expect(mockSubscriptionClient.l2Book).toHaveBeenCalledWith(
      { coin: "BTC" },
      expect.any(Function),
    )
  })

  it("should subscribe to correct coin", async () => {
    const watcher = createBookWatcher({
      coin: "ETH",
      isTestnet: false,
      onUpdate,
      onError,
    })

    await watcher.start()

    expect(mockSubscriptionClient.l2Book).toHaveBeenCalledWith(
      { coin: "ETH" },
      expect.any(Function),
    )
  })

  it("should handle stop when not started", async () => {
    const watcher = createBookWatcher({
      coin: "BTC",
      isTestnet: false,
      onUpdate,
      onError,
    })

    // Should not throw when stopping without starting
    await expect(watcher.stop()).resolves.toBeUndefined()
  })

  it("should handle multiple stops gracefully", async () => {
    const watcher = createBookWatcher({
      coin: "BTC",
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

describe("BookLevel type", () => {
  it("should match expected structure", () => {
    const mockBookData = {
      coin: "BTC",
      bids: [
        { px: "89500", sz: "1.5", n: 3 },
        { px: "89499", sz: "2.0", n: 5 },
      ],
      asks: [
        { px: "89501", sz: "1.0", n: 2 },
        { px: "89502", sz: "3.0", n: 4 },
      ],
      time: 1700000000000,
    }

    expect(mockBookData.bids).toHaveLength(2)
    expect(mockBookData.asks).toHaveLength(2)
    expect(mockBookData.bids[0].px).toBe("89500")
    expect(mockBookData.asks[0].px).toBe("89501")
  })
})
