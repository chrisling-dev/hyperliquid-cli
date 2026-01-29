import React from "react"
import { Box, Text } from "ink"
import { colors } from "../theme.js"

export interface Column<T> {
  key: keyof T
  header: string
  width?: number
  align?: "left" | "right"
  render?: (value: T[keyof T], row: T) => React.ReactNode
}

export interface TableProps<T> {
  data: T[]
  columns: Column<T>[]
  emptyMessage?: string
}

function calculateColumnWidths<T>(
  data: T[],
  columns: Column<T>[]
): Map<keyof T, number> {
  const widths = new Map<keyof T, number>()

  for (const col of columns) {
    if (col.width) {
      widths.set(col.key, col.width)
      continue
    }

    let maxWidth = col.header.length
    for (const row of data) {
      const value = row[col.key]
      const strValue = value === null || value === undefined ? "" : String(value)
      maxWidth = Math.max(maxWidth, strValue.length)
    }
    widths.set(col.key, maxWidth)
  }

  return widths
}

function padValue(value: string, width: number, align: "left" | "right"): string {
  if (align === "right") {
    return value.padStart(width)
  }
  return value.padEnd(width)
}

export function Table<T extends object>({
  data,
  columns,
  emptyMessage = "No data",
}: TableProps<T>): React.ReactElement {
  if (data.length === 0) {
    return (
      <Box>
        <Text color={colors.muted}>{emptyMessage}</Text>
      </Box>
    )
  }

  const widths = calculateColumnWidths(data, columns)

  return (
    <Box flexDirection="column">
      {/* Header row */}
      <Box>
        {columns.map((col, i) => (
          <Box key={String(col.key)} marginRight={i < columns.length - 1 ? 2 : 0}>
            <Text color={colors.header} bold>
              {padValue(col.header, widths.get(col.key) || col.header.length, col.align || "left")}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Separator */}
      <Box>
        {columns.map((col, i) => (
          <Box key={String(col.key)} marginRight={i < columns.length - 1 ? 2 : 0}>
            <Text color={colors.muted}>
              {"-".repeat(widths.get(col.key) || col.header.length)}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Data rows */}
      {data.map((row, rowIndex) => (
        <Box key={rowIndex}>
          {columns.map((col, colIndex) => {
            const value = row[col.key]
            const width = widths.get(col.key) || col.header.length
            const align = col.align || "left"

            if (col.render) {
              return (
                <Box key={String(col.key)} marginRight={colIndex < columns.length - 1 ? 2 : 0}>
                  <Box width={width} justifyContent={align === "right" ? "flex-end" : "flex-start"}>
                    {col.render(value, row)}
                  </Box>
                </Box>
              )
            }

            const strValue = value === null || value === undefined ? "" : String(value)
            return (
              <Box key={String(col.key)} marginRight={colIndex < columns.length - 1 ? 2 : 0}>
                <Text>{padValue(strValue, width, align)}</Text>
              </Box>
            )
          })}
        </Box>
      ))}
    </Box>
  )
}
