import { describe, it, expect } from "vitest"
import {
  validateAddress,
  validatePrivateKey,
  validatePositiveNumber,
  validatePositiveInteger,
  validateSide,
  validateTif,
} from "./validation.js"

describe("validateAddress", () => {
  it("should accept valid ethereum address", () => {
    const address = "0x1234567890abcdef1234567890abcdef12345678"
    expect(validateAddress(address)).toBe(address)
  })

  it("should accept uppercase hex characters", () => {
    const address = "0x1234567890ABCDEF1234567890ABCDEF12345678"
    expect(validateAddress(address)).toBe(address)
  })

  it("should reject address without 0x prefix", () => {
    expect(() => validateAddress("1234567890abcdef1234567890abcdef12345678")).toThrow(
      "Invalid address"
    )
  })

  it("should reject address with wrong length", () => {
    expect(() => validateAddress("0x1234567890abcdef")).toThrow("Invalid address")
  })

  it("should reject address with invalid characters", () => {
    expect(() => validateAddress("0x1234567890abcdef1234567890abcdef1234567g")).toThrow(
      "Invalid address"
    )
  })
})

describe("validatePrivateKey", () => {
  it("should accept valid private key (64 hex chars)", () => {
    const key =
      "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
    expect(validatePrivateKey(key)).toBe(key)
  })

  it("should accept uppercase hex characters", () => {
    const key =
      "0x1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF1234567890ABCDEF"
    expect(validatePrivateKey(key)).toBe(key)
  })

  it("should reject key without 0x prefix", () => {
    expect(() =>
      validatePrivateKey(
        "1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
      )
    ).toThrow("Invalid private key format")
  })

  it("should reject key with wrong length", () => {
    expect(() => validatePrivateKey("0x1234567890abcdef")).toThrow(
      "Invalid private key format"
    )
  })
})

describe("validatePositiveNumber", () => {
  it("should accept positive integers", () => {
    expect(validatePositiveNumber("42", "value")).toBe(42)
  })

  it("should accept positive decimals", () => {
    expect(validatePositiveNumber("3.14", "price")).toBe(3.14)
  })

  it("should accept very small positive numbers", () => {
    expect(validatePositiveNumber("0.0001", "size")).toBe(0.0001)
  })

  it("should reject zero", () => {
    expect(() => validatePositiveNumber("0", "amount")).toThrow(
      "amount must be a positive number"
    )
  })

  it("should reject negative numbers", () => {
    expect(() => validatePositiveNumber("-5", "price")).toThrow(
      "price must be a positive number"
    )
  })

  it("should reject non-numeric strings", () => {
    expect(() => validatePositiveNumber("abc", "size")).toThrow(
      "size must be a positive number"
    )
  })

  it("should reject empty string", () => {
    expect(() => validatePositiveNumber("", "value")).toThrow(
      "value must be a positive number"
    )
  })
})

describe("validatePositiveInteger", () => {
  it("should accept positive integers", () => {
    expect(validatePositiveInteger("42", "count")).toBe(42)
  })

  it("should truncate decimals to integers", () => {
    expect(validatePositiveInteger("3.9", "leverage")).toBe(3)
  })

  it("should reject zero", () => {
    expect(() => validatePositiveInteger("0", "leverage")).toThrow(
      "leverage must be a positive integer"
    )
  })

  it("should reject negative integers", () => {
    expect(() => validatePositiveInteger("-5", "leverage")).toThrow(
      "leverage must be a positive integer"
    )
  })

  it("should reject non-numeric strings", () => {
    expect(() => validatePositiveInteger("abc", "count")).toThrow(
      "count must be a positive integer"
    )
  })
})

describe("validateSide", () => {
  it("should accept 'buy' lowercase", () => {
    expect(validateSide("buy")).toBe("buy")
  })

  it("should accept 'sell' lowercase", () => {
    expect(validateSide("sell")).toBe("sell")
  })

  it("should accept 'BUY' uppercase and normalize to lowercase", () => {
    expect(validateSide("BUY")).toBe("buy")
  })

  it("should accept 'SELL' uppercase and normalize to lowercase", () => {
    expect(validateSide("SELL")).toBe("sell")
  })

  it("should accept mixed case 'Buy'", () => {
    expect(validateSide("Buy")).toBe("buy")
  })

  it("should reject invalid side", () => {
    expect(() => validateSide("long")).toThrow('Side must be "buy" or "sell"')
  })

  it("should reject empty string", () => {
    expect(() => validateSide("")).toThrow('Side must be "buy" or "sell"')
  })
})

describe("validateTif", () => {
  it("should accept 'gtc' and return 'Gtc'", () => {
    expect(validateTif("gtc")).toBe("Gtc")
  })

  it("should accept 'ioc' and return 'Ioc'", () => {
    expect(validateTif("ioc")).toBe("Ioc")
  })

  it("should accept 'alo' and return 'Alo'", () => {
    expect(validateTif("alo")).toBe("Alo")
  })

  it("should accept uppercase 'GTC' and normalize", () => {
    expect(validateTif("GTC")).toBe("Gtc")
  })

  it("should accept mixed case 'Ioc'", () => {
    expect(validateTif("Ioc")).toBe("Ioc")
  })

  it("should reject invalid tif", () => {
    expect(() => validateTif("fok")).toThrow(
      'Time-in-force must be "Gtc", "Ioc", or "Alo"'
    )
  })

  it("should reject empty string", () => {
    expect(() => validateTif("")).toThrow(
      'Time-in-force must be "Gtc", "Ioc", or "Alo"'
    )
  })
})
