import React from "react"
import { Text } from "ink"
import { getPnLColor } from "../theme.js"

export interface PnLProps {
  value: number | string
  showSign?: boolean
  decimals?: number
}

export function PnL({ value, showSign = true, decimals = 2 }: PnLProps): React.ReactElement {
  const numValue = typeof value === "string" ? parseFloat(value) : value

  if (isNaN(numValue)) {
    return <Text color="gray">-</Text>
  }

  const color = getPnLColor(numValue)
  const sign = showSign && numValue > 0 ? "+" : ""
  const formatted = `${sign}${numValue.toFixed(decimals)}`

  return <Text color={color}>{formatted}</Text>
}

export interface PnLPercentProps {
  value: number | string
  decimals?: number
}

export function PnLPercent({ value, decimals = 2 }: PnLPercentProps): React.ReactElement {
  const numValue = typeof value === "string" ? parseFloat(value) : value

  if (isNaN(numValue)) {
    return <Text color="gray">-</Text>
  }

  const color = getPnLColor(numValue)
  const sign = numValue > 0 ? "+" : ""
  const formatted = `${sign}${numValue.toFixed(decimals)}%`

  return <Text color={color}>{formatted}</Text>
}
