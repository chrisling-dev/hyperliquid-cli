import React from "react"
import { Box, Text } from "ink"
import InkSpinner from "ink-spinner"
import { colors } from "../theme.js"

export interface SpinnerProps {
  label?: string
}

export function Spinner({ label = "Loading..." }: SpinnerProps): React.ReactElement {
  return (
    <Box>
      <Text color={colors.info}>
        <InkSpinner type="dots" />
      </Text>
      <Text> {label}</Text>
    </Box>
  )
}

export interface ErrorDisplayProps {
  message: string
}

export function ErrorDisplay({ message }: ErrorDisplayProps): React.ReactElement {
  return (
    <Box>
      <Text color={colors.loss}>Error: {message}</Text>
    </Box>
  )
}

export interface SuccessDisplayProps {
  message: string
}

export function SuccessDisplay({ message }: SuccessDisplayProps): React.ReactElement {
  return (
    <Box>
      <Text color={colors.profit}>{message}</Text>
    </Box>
  )
}
