/**
 * Utilities for watch mode terminal display
 */

/**
 * Clear terminal screen and move cursor to top-left
 */
export function clearScreen(): void {
  process.stdout.write("\x1b[2J\x1b[H")
}

/**
 * Hide terminal cursor
 */
export function hideCursor(): void {
  process.stdout.write("\x1b[?25l")
}

/**
 * Show terminal cursor
 */
export function showCursor(): void {
  process.stdout.write("\x1b[?25h")
}

/**
 * Format current time as HH:MM:SS
 */
export function formatTimestamp(): string {
  const now = new Date()
  return now.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}
