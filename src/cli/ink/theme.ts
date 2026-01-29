/**
 * Color theme for CLI output
 */
export const colors = {
  profit: "green",
  loss: "red",
  neutral: "white",
  muted: "gray",
  header: "cyan",
  warning: "yellow",
  info: "blue",
} as const

export type ThemeColor = (typeof colors)[keyof typeof colors]

/**
 * Get the appropriate color for a PnL value
 */
export function getPnLColor(value: number): ThemeColor {
  if (value > 0) return colors.profit
  if (value < 0) return colors.loss
  return colors.neutral
}

/**
 * Get the appropriate color for a percentage change
 */
export function getChangeColor(value: number): ThemeColor {
  if (value > 0) return colors.profit
  if (value < 0) return colors.loss
  return colors.neutral
}
