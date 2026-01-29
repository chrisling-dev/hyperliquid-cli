import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createPriceWatcher } from "./price-watcher.js"

const mockSubscription = {
  unsubscribe: vi.fn().mockResolvedValue(undefined),
}

const mockSubscriptionClient = {
  allMids: vi.fn().mockResolvedValue(mockSubscription),
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
      allMids = vi.fn().mockResolvedValue(mockSubscription)
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

// Mock the server client
vi.mock("../client/index.js", () => ({
  tryConnectToServer: vi.fn().mockResolvedValue(null),
}))

describe("createPriceWatcher", () => {
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

  it("should create a price watcher with start and stop methods", () => {
    const watcher = createPriceWatcher({
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

  it("should start WebSocket connection and subscribe when no server", async () => {
    const watcher = createPriceWatcher({
      coin: "BTC",
      isTestnet: true,
      onUpdate,
      onError,
    })

    await watcher.start()

    // Verify ready was called on WebSocket transport
    expect(mockWsTransport.ready).toHaveBeenCalled()

    // Verify allMids subscription was created
    expect(mockSubscriptionClient.allMids).toHaveBeenCalledWith(
      { dex: "ALL_DEXS" },
      expect.any(Function),
    )
  })

  it("should handle stop when not started", async () => {
    const watcher = createPriceWatcher({
      coin: "BTC",
      isTestnet: false,
      onUpdate,
      onError,
    })

    // Should not throw when stopping without starting
    await expect(watcher.stop()).resolves.toBeUndefined()
  })

  it("should handle multiple stops gracefully", async () => {
    const watcher = createPriceWatcher({
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
