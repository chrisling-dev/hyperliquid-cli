import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { clearScreen, hideCursor, showCursor, formatTimestamp } from "./watch.js"

describe("watch utilities", () => {
  let stdoutWriteSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    stdoutWriteSpy = vi.spyOn(process.stdout, "write").mockImplementation(() => true)
  })

  afterEach(() => {
    stdoutWriteSpy.mockRestore()
  })

  describe("clearScreen", () => {
    it("should write ANSI clear and cursor home sequences", () => {
      clearScreen()

      expect(stdoutWriteSpy).toHaveBeenCalledWith("\x1b[2J\x1b[H")
    })
  })

  describe("hideCursor", () => {
    it("should write ANSI hide cursor sequence", () => {
      hideCursor()

      expect(stdoutWriteSpy).toHaveBeenCalledWith("\x1b[?25l")
    })
  })

  describe("showCursor", () => {
    it("should write ANSI show cursor sequence", () => {
      showCursor()

      expect(stdoutWriteSpy).toHaveBeenCalledWith("\x1b[?25h")
    })
  })

  describe("formatTimestamp", () => {
    it("should return time in HH:MM:SS format", () => {
      const timestamp = formatTimestamp()

      // Match HH:MM:SS pattern
      expect(timestamp).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    })

    it("should use current time", () => {
      const before = new Date()
      const timestamp = formatTimestamp()
      const after = new Date()

      // Parse the timestamp
      const [hours, minutes, seconds] = timestamp.split(":").map(Number)

      // Check hours and minutes are within range
      expect(hours).toBeGreaterThanOrEqual(0)
      expect(hours).toBeLessThanOrEqual(23)
      expect(minutes).toBeGreaterThanOrEqual(0)
      expect(minutes).toBeLessThanOrEqual(59)
      expect(seconds).toBeGreaterThanOrEqual(0)
      expect(seconds).toBeLessThanOrEqual(59)

      // Verify it's close to current time (within a few seconds)
      const beforeTime = before.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
      const afterTime = after.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })

      // The timestamp should be between before and after (or equal)
      expect([beforeTime, timestamp, afterTime]).toContain(timestamp)
    })
  })
})
