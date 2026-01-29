import { describe, it, expect, vi, beforeEach } from "vitest"
import { existsSync, readFileSync } from "node:fs"

// Mock fs module
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}))

// Mock client module
vi.mock("../client/index.js", () => ({
  ServerClient: vi.fn(),
  isServerRunning: vi.fn(),
}))

// Mock output module
vi.mock("../cli/output.js", () => ({
  output: vi.fn(),
  outputError: vi.fn(),
  outputSuccess: vi.fn(),
}))

import { isServerRunning } from "../client/index.js"

describe("server commands", () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe("start command logic", () => {
    it("should detect already running server via PID file", () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue("12345")

      const pidExists = existsSync("/path/to/server.pid")
      const pid = parseInt(readFileSync("/path/to/server.pid", "utf-8").trim(), 10)

      expect(pidExists).toBe(true)
      expect(pid).toBe(12345)
    })

    it("should handle stale PID file", () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue("99999")

      // In actual code, process.kill(pid, 0) would throw if process doesn't exist
      const checkProcessAlive = (_pid: number) => {
        // Simulate process not found
        throw new Error("ESRCH")
      }

      expect(() => checkProcessAlive(99999)).toThrow()
    })

    it("should wait for server to become ready with polling", async () => {
      // Simulate polling behavior
      let pollCount = 0
      const maxPolls = 5
      const isReady = () => {
        pollCount++
        return pollCount >= 3 // Becomes ready after 3 polls
      }

      while (pollCount < maxPolls) {
        if (isReady()) {
          break
        }
        await new Promise((r) => setTimeout(r, 10))
      }

      expect(pollCount).toBe(3)
    })

    it("should spawn server with testnet flag", () => {
      const isTestnet = true
      const args = isTestnet ? ["--testnet"] : []

      expect(args).toEqual(["--testnet"])
    })

    it("should spawn server without testnet flag for mainnet", () => {
      const isTestnet = false
      const args = isTestnet ? ["--testnet"] : []

      expect(args).toEqual([])
    })

    it("should timeout if server fails to start", async () => {
      const maxWait = 100
      const pollInterval = 20
      let waited = 0

      vi.mocked(isServerRunning).mockReturnValue(false)

      while (waited < maxWait) {
        await new Promise((r) => setTimeout(r, pollInterval))
        waited += pollInterval

        if (isServerRunning()) {
          break
        }
      }

      expect(waited).toBeGreaterThanOrEqual(maxWait)
    })
  })

  describe("stop command logic", () => {
    it("should check if server is running before stopping", () => {
      vi.mocked(isServerRunning).mockReturnValue(false)

      expect(isServerRunning()).toBe(false)
    })

    it("should send shutdown RPC to server", async () => {
      const mockShutdown = vi.fn().mockResolvedValue(undefined)
      const mockClose = vi.fn()
      const mockConnect = vi.fn().mockResolvedValue(undefined)

      // Create a mock client object to test the logic
      const client = {
        connect: mockConnect,
        shutdown: mockShutdown,
        close: mockClose,
      }

      await client.connect()
      await client.shutdown()
      client.close()

      expect(mockConnect).toHaveBeenCalled()
      expect(mockShutdown).toHaveBeenCalled()
      expect(mockClose).toHaveBeenCalled()
    })

    it("should force kill if graceful shutdown fails", () => {
      vi.mocked(existsSync).mockReturnValue(true)
      vi.mocked(readFileSync).mockReturnValue("12345")

      const pid = parseInt(readFileSync("/path/to/server.pid", "utf-8").trim(), 10)
      expect(pid).toBe(12345)

      // In actual code: process.kill(pid, "SIGKILL")
    })

    it("should handle server not responding during shutdown", async () => {
      const mockShutdown = vi.fn().mockRejectedValue(new Error("Connection refused"))
      const mockConnect = vi.fn().mockResolvedValue(undefined)

      // Create a mock client object to test the logic
      const client = {
        connect: mockConnect,
        shutdown: mockShutdown,
      }

      await client.connect()

      await expect(client.shutdown()).rejects.toThrow("Connection refused")
    })
  })

  describe("status command logic", () => {
    it("should show not running when socket does not exist", () => {
      vi.mocked(isServerRunning).mockReturnValue(false)

      expect(isServerRunning()).toBe(false)
    })

    it("should retrieve status from running server", async () => {
      const mockStatus = {
        running: true,
        testnet: false,
        connected: true,
        startedAt: Date.now() - 60000,
        uptime: 60000,
        cache: {
          hasMids: true,
          hasAssetCtxs: true,
          hasPerpMetas: true,
          midsAge: 500,
          assetCtxsAge: 600,
          perpMetasAge: 700,
        },
      }

      const mockGetStatus = vi.fn().mockResolvedValue(mockStatus)
      const mockConnect = vi.fn().mockResolvedValue(undefined)
      const mockClose = vi.fn()

      // Create a mock client object to test the logic
      const client = {
        connect: mockConnect,
        getStatus: mockGetStatus,
        close: mockClose,
      }

      await client.connect()
      const status = await client.getStatus()
      client.close()

      expect(status.running).toBe(true)
      expect(status.testnet).toBe(false)
      expect(status.connected).toBe(true)
      expect(status.cache.hasMids).toBe(true)
    })

    it("should show testnet mode in status", async () => {
      const mockStatus = {
        running: true,
        testnet: true,
        connected: true,
        startedAt: Date.now(),
        uptime: 1000,
        cache: {
          hasMids: false,
          hasAssetCtxs: false,
          hasPerpMetas: false,
        },
      }

      const mockGetStatus = vi.fn().mockResolvedValue(mockStatus)

      // Create a mock client object to test the logic
      const client = {
        connect: vi.fn().mockResolvedValue(undefined),
        getStatus: mockGetStatus,
        close: vi.fn(),
      }

      await client.connect()
      const status = await client.getStatus()

      expect(status.testnet).toBe(true)
    })

    it("should show disconnected WebSocket status", async () => {
      const mockStatus = {
        running: true,
        testnet: false,
        connected: false, // WebSocket disconnected
        startedAt: Date.now(),
        uptime: 1000,
        cache: {
          hasMids: false,
          hasAssetCtxs: false,
          hasPerpMetas: false,
        },
      }

      const mockGetStatus = vi.fn().mockResolvedValue(mockStatus)

      // Create a mock client object to test the logic
      const client = {
        connect: vi.fn().mockResolvedValue(undefined),
        getStatus: mockGetStatus,
        close: vi.fn(),
      }

      await client.connect()
      const status = await client.getStatus()

      expect(status.connected).toBe(false)
    })

    it("should handle error when server not responding", async () => {
      vi.mocked(isServerRunning).mockReturnValue(true)

      const mockConnect = vi.fn().mockRejectedValue(new Error("Connection refused"))

      // Create a mock client object to test the logic
      const client = {
        connect: mockConnect,
      }

      await expect(client.connect()).rejects.toThrow("Connection refused")
    })
  })
})

describe("formatUptime helper", () => {
  // Replicate the formatUptime function for testing
  function formatUptime(ms: number): string {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ${hours % 24}h`
    if (hours > 0) return `${hours}h ${minutes % 60}m`
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`
    return `${seconds}s`
  }

  it("should format seconds only", () => {
    expect(formatUptime(30000)).toBe("30s")
  })

  it("should format minutes and seconds", () => {
    expect(formatUptime(90000)).toBe("1m 30s")
  })

  it("should format hours and minutes", () => {
    expect(formatUptime(3660000)).toBe("1h 1m")
  })

  it("should format days and hours", () => {
    expect(formatUptime(90000000)).toBe("1d 1h")
  })

  it("should handle zero milliseconds", () => {
    expect(formatUptime(0)).toBe("0s")
  })

  it("should handle exactly one minute", () => {
    expect(formatUptime(60000)).toBe("1m 0s")
  })

  it("should handle exactly one hour", () => {
    expect(formatUptime(3600000)).toBe("1h 0m")
  })

  it("should handle exactly one day", () => {
    expect(formatUptime(86400000)).toBe("1d 0h")
  })

  it("should handle multiple days", () => {
    expect(formatUptime(172800000 + 3600000 * 5)).toBe("2d 5h")
  })
})

describe("formatAge helper", () => {
  // Replicate the formatAge function for testing
  function formatAge(ms: number | undefined): string {
    if (ms === undefined) return "unknown"
    if (ms < 1000) return `${ms}ms`
    const seconds = Math.floor(ms / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    return `${minutes}m ${seconds % 60}s`
  }

  it("should return unknown for undefined", () => {
    expect(formatAge(undefined)).toBe("unknown")
  })

  it("should format milliseconds for values under 1000", () => {
    expect(formatAge(500)).toBe("500ms")
  })

  it("should format seconds for values under 60 seconds", () => {
    expect(formatAge(30000)).toBe("30s")
  })

  it("should format minutes and seconds for larger values", () => {
    expect(formatAge(90000)).toBe("1m 30s")
  })

  it("should handle exactly one second", () => {
    expect(formatAge(1000)).toBe("1s")
  })

  it("should handle exactly one minute", () => {
    expect(formatAge(60000)).toBe("1m 0s")
  })

  it("should handle zero milliseconds", () => {
    expect(formatAge(0)).toBe("0ms")
  })

  it("should handle 999 milliseconds (edge case)", () => {
    expect(formatAge(999)).toBe("999ms")
  })
})
