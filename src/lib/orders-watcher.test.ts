import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createOrdersWatcher } from "./orders-watcher.js"

const mockSubscription = {
  unsubscribe: vi.fn().mockResolvedValue(undefined),
}

const mockSubscriptionClient = {
  orderUpdates: vi.fn().mockResolvedValue(mockSubscription),
}

const mockWsTransport = {
  ready: vi.fn().mockResolvedValue(undefined),
  close: vi.fn().mockResolvedValue(undefined),
}

const mockOpenOrders = [
  { oid: 123, coin: "BTC", side: "B", sz: "0.001", limitPx: "85000", timestamp: 1700000000000 },
]

const mockInfoClient = {
  openOrders: vi.fn().mockResolvedValue(mockOpenOrders),
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
      orderUpdates = vi.fn().mockResolvedValue(mockSubscription)
      constructor() {
        Object.assign(this, mockSubscriptionClient)
      }
    },
    HttpTransport: class MockHttpTransport {},
    InfoClient: class MockInfoClient {
      openOrders = vi.fn().mockResolvedValue(mockOpenOrders)
      constructor() {
        Object.assign(this, mockInfoClient)
      }
    },
  }
})

// Mock ws module
vi.mock("ws", () => ({
  default: class MockWebSocket {},
}))

describe("createOrdersWatcher", () => {
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

  it("should create an orders watcher with start and stop methods", () => {
    const watcher = createOrdersWatcher({
      user: "0x1234567890123456789012345678901234567890",
      isTestnet: false,
      onUpdate,
      onError,
    })

    expect(watcher).toHaveProperty("start")
    expect(watcher).toHaveProperty("stop")
    expect(typeof watcher.start).toBe("function")
    expect(typeof watcher.stop).toBe("function")
  })

  it("should start WebSocket connection and subscribe to orderUpdates", async () => {
    const watcher = createOrdersWatcher({
      user: "0x1234567890123456789012345678901234567890",
      isTestnet: true,
      onUpdate,
      onError,
    })

    await watcher.start()

    // Verify ready was called on WebSocket transport
    expect(mockWsTransport.ready).toHaveBeenCalled()

    // Verify orderUpdates subscription was created
    expect(mockSubscriptionClient.orderUpdates).toHaveBeenCalledWith(
      { user: "0x1234567890123456789012345678901234567890" },
      expect.any(Function),
    )

    // Verify initial orders were fetched and callback called
    expect(mockInfoClient.openOrders).toHaveBeenCalled()
    expect(onUpdate).toHaveBeenCalledWith(mockOpenOrders)
  })

  it("should handle stop when not started", async () => {
    const watcher = createOrdersWatcher({
      user: "0x1234567890123456789012345678901234567890",
      isTestnet: false,
      onUpdate,
      onError,
    })

    // Should not throw when stopping without starting
    await expect(watcher.stop()).resolves.toBeUndefined()
  })

  it("should handle multiple stops gracefully", async () => {
    const watcher = createOrdersWatcher({
      user: "0x1234567890123456789012345678901234567890",
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
