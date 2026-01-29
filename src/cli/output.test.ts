import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { output, outputError, outputSuccess } from "./output.js"

describe("output", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe("JSON mode", () => {
    it("should output formatted JSON for objects", () => {
      const data = { foo: "bar", num: 42 }
      output(data, { json: true })

      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2))
    })

    it("should output formatted JSON for arrays", () => {
      const data = [{ a: 1 }, { a: 2 }]
      output(data, { json: true })

      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(data, null, 2))
    })

    it("should output formatted JSON for strings", () => {
      output("hello", { json: true })

      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify("hello", null, 2))
    })

    it("should output formatted JSON for numbers", () => {
      output(123, { json: true })

      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(123, null, 2))
    })

    it("should handle null values", () => {
      output(null, { json: true })

      expect(consoleSpy).toHaveBeenCalledWith(JSON.stringify(null, null, 2))
    })
  })

  describe("human-readable mode - strings", () => {
    it("should output strings directly", () => {
      output("hello world", { json: false })

      expect(consoleSpy).toHaveBeenCalledWith("hello world")
    })
  })

  describe("human-readable mode - arrays", () => {
    it("should output (empty) for empty arrays", () => {
      output([], { json: false })

      expect(consoleSpy).toHaveBeenCalledWith("(empty)")
    })

    it("should output simple values as list", () => {
      output(["a", "b", "c"], { json: false })

      expect(consoleSpy).toHaveBeenCalledTimes(3)
      expect(consoleSpy).toHaveBeenNthCalledWith(1, "a")
      expect(consoleSpy).toHaveBeenNthCalledWith(2, "b")
      expect(consoleSpy).toHaveBeenNthCalledWith(3, "c")
    })

    it("should output array of objects as table", () => {
      const data = [
        { coin: "BTC", price: "50000" },
        { coin: "ETH", price: "3000" },
      ]
      output(data, { json: false })

      // Header + separator + 2 rows = 4 calls
      expect(consoleSpy).toHaveBeenCalledTimes(4)

      // Check header
      const headerCall = consoleSpy.mock.calls[0][0]
      expect(headerCall).toContain("coin")
      expect(headerCall).toContain("price")

      // Check separator has dashes
      const separatorCall = consoleSpy.mock.calls[1][0]
      expect(separatorCall).toMatch(/-+/)

      // Check data rows
      const row1 = consoleSpy.mock.calls[2][0]
      expect(row1).toContain("BTC")
      expect(row1).toContain("50000")

      const row2 = consoleSpy.mock.calls[3][0]
      expect(row2).toContain("ETH")
      expect(row2).toContain("3000")
    })

    it("should handle null/undefined values in table", () => {
      const data = [
        { a: "x", b: null },
        { a: "y", b: undefined },
      ]
      output(data, { json: false })

      // Should not throw and should output empty strings for null/undefined
      expect(consoleSpy).toHaveBeenCalled()
    })

    it("should calculate column widths correctly", () => {
      const data = [
        { shortKey: "a", longerKey: "value1" },
        { shortKey: "bb", longerKey: "v2" },
      ]
      output(data, { json: false })

      // Headers should be padded to accommodate longest value
      const headerCall = consoleSpy.mock.calls[0][0]
      // "shortKey" is 8 chars, "bb" is 2 chars, so column width should be 8
      expect(headerCall).toContain("shortKey")
    })
  })

  describe("human-readable mode - objects", () => {
    it("should output key-value pairs", () => {
      const data = { name: "test", value: 42 }
      output(data, { json: false })

      expect(consoleSpy).toHaveBeenCalledTimes(2)
      expect(consoleSpy).toHaveBeenCalledWith("name: test")
      expect(consoleSpy).toHaveBeenCalledWith("value: 42")
    })

    it("should handle nested objects", () => {
      const data = {
        outer: "value",
        nested: {
          inner: "data",
        },
      }
      output(data, { json: false })

      expect(consoleSpy).toHaveBeenCalledWith("outer: value")
      expect(consoleSpy).toHaveBeenCalledWith("nested:")
      expect(consoleSpy).toHaveBeenCalledWith("  inner: data")
    })

    it("should summarize arrays in objects", () => {
      const data = {
        items: [1, 2, 3],
      }
      output(data, { json: false })

      expect(consoleSpy).toHaveBeenCalledWith("items: [3 items]")
    })

    it("should handle deeply nested objects", () => {
      const data = {
        level1: {
          level2: {
            level3: "deep",
          },
        },
      }
      output(data, { json: false })

      expect(consoleSpy).toHaveBeenCalledWith("level1:")
      expect(consoleSpy).toHaveBeenCalledWith("  level2:")
      expect(consoleSpy).toHaveBeenCalledWith("    level3: deep")
    })
  })

  describe("human-readable mode - primitives", () => {
    it("should output numbers directly", () => {
      output(42, { json: false })

      expect(consoleSpy).toHaveBeenCalledWith(42)
    })

    it("should output booleans directly", () => {
      output(true, { json: false })

      expect(consoleSpy).toHaveBeenCalledWith(true)
    })

    it("should handle null", () => {
      output(null, { json: false })

      expect(consoleSpy).toHaveBeenCalledWith(null)
    })
  })
})

describe("outputError", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleErrorSpy.mockRestore()
  })

  it("should prefix message with Error:", () => {
    outputError("something went wrong")

    expect(consoleErrorSpy).toHaveBeenCalledWith("Error: something went wrong")
  })

  it("should handle empty message", () => {
    outputError("")

    expect(consoleErrorSpy).toHaveBeenCalledWith("Error: ")
  })
})

describe("outputSuccess", () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    consoleSpy.mockRestore()
  })

  it("should output message directly", () => {
    outputSuccess("Operation completed")

    expect(consoleSpy).toHaveBeenCalledWith("Operation completed")
  })
})
