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

  it("should read privateKey from env", () => {
    const testKey =
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    process.env.HYPERLIQUID_PRIVATE_KEY = testKey
    delete process.env.HYPERLIQUID_WALLET_ADDRESS

    const config = loadConfig(false)
    expect(config.privateKey).toBe(testKey)
  })

  it("should read walletAddress from env", () => {
    const testAddress = "0x1234567890abcdef1234567890abcdef12345678"
    process.env.HYPERLIQUID_WALLET_ADDRESS = testAddress
    delete process.env.HYPERLIQUID_PRIVATE_KEY

    const config = loadConfig(false)
    expect(config.walletAddress).toBe(testAddress)
  })

  it("should derive walletAddress from privateKey if not provided", () => {
    // This is a well-known test private key
    const testKey =
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    process.env.HYPERLIQUID_PRIVATE_KEY = testKey
    delete process.env.HYPERLIQUID_WALLET_ADDRESS

    const config = loadConfig(false)
    expect(config.privateKey).toBe(testKey)
    // The derived address for this key
    expect(config.walletAddress).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")
  })

  it("should use explicit walletAddress over derived one", () => {
    const testKey =
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    const explicitAddress = "0x1111111111111111111111111111111111111111"
    process.env.HYPERLIQUID_PRIVATE_KEY = testKey
    process.env.HYPERLIQUID_WALLET_ADDRESS = explicitAddress

    const config = loadConfig(false)
    expect(config.walletAddress).toBe(explicitAddress)
  })

  it("should return undefined for privateKey and walletAddress when env is empty", () => {
    delete process.env.HYPERLIQUID_PRIVATE_KEY
    delete process.env.HYPERLIQUID_WALLET_ADDRESS

    const config = loadConfig(false)
    expect(config.privateKey).toBeUndefined()
    expect(config.walletAddress).toBeUndefined()
  })
})
