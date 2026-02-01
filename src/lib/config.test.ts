import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { loadConfig } from "./config.js"

describe("loadConfig", () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it("should return testnet: false when called with false", () => {
    delete process.env.HYPERLIQUID_PRIVATE_KEY
    delete process.env.HYPERLIQUID_WALLET_ADDRESS
    const config = loadConfig(false)
    expect(config.testnet).toBe(false)
  })

  it("should return testnet: true when called with true", () => {
    delete process.env.HYPERLIQUID_PRIVATE_KEY
    delete process.env.HYPERLIQUID_WALLET_ADDRESS
    const config = loadConfig(true)
    expect(config.testnet).toBe(true)
  })
})
