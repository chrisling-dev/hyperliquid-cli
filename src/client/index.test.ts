import { describe, it, expect, vi, beforeEach } from "vitest"
import { isServerRunning } from "./index.js"
import { existsSync } from "node:fs"

// Mock the fs module
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
}))

describe("isServerRunning", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("should return true when socket file exists", () => {
    vi.mocked(existsSync).mockReturnValue(true)
    expect(isServerRunning()).toBe(true)
  })

  it("should return false when socket file does not exist", () => {
    vi.mocked(existsSync).mockReturnValue(false)
    expect(isServerRunning()).toBe(false)
  })
})

describe("ServerClient", () => {
  // Note: Full integration tests for ServerClient require a running server.
  // Unit tests here focus on the exported helpers and type checking.

  describe("types", () => {
    it("should export ServerStatus type with expected shape", async () => {
      // This is a compile-time check - if types are wrong, this won't compile
      const mockStatus: import("./index.js").ServerStatus = {
        running: true,
        testnet: false,
        connected: true,
        startedAt: Date.now(),
        uptime: 1000,
        cache: {
          hasMids: true,
          hasAssetCtxs: true,
          hasPerpMetas: true,
          midsAge: 100,
          assetCtxsAge: 200,
          perpMetasAge: 300,
        },
      }

      expect(mockStatus.running).toBe(true)
      expect(mockStatus.cache.hasMids).toBe(true)
    })

    it("should allow optional cache age fields", () => {
      const mockStatus: import("./index.js").ServerStatus = {
        running: true,
        testnet: true,
        connected: false,
        startedAt: Date.now(),
        uptime: 0,
        cache: {
          hasMids: false,
          hasAssetCtxs: false,
          hasPerpMetas: false,
          // No age fields when has* is false
        },
      }

      expect(mockStatus.cache.midsAge).toBeUndefined()
    })
  })
})

describe("tryConnectToServer", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("should return null when server is not running", async () => {
    vi.mocked(existsSync).mockReturnValue(false)

    const { tryConnectToServer } = await import("./index.js")
    const result = await tryConnectToServer()
    expect(result).toBeNull()
  })

  // Note: Testing successful connection requires mocking net.connect
  // which is complex. Integration tests should cover this scenario.
})
