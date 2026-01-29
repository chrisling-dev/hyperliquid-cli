import React from "react"
import { Box, Text } from "ink"
import { colors } from "../theme.js"
import { formatTimestamp } from "../../watch.js"

export interface WatchHeaderProps {
  title: string
  lastUpdated?: Date
}

export function WatchHeader({ title, lastUpdated }: WatchHeaderProps): React.ReactElement {
  const timestamp = lastUpdated
    ? lastUpdated.toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : formatTimestamp()

  return (
    <Box marginBottom={1}>
      <Text bold>{title}</Text>
      <Text color={colors.muted}> (watching)</Text>
      <Box flexGrow={1} />
      <Text color={colors.muted}>Last updated: {timestamp}</Text>
    </Box>
  )
}

export interface WatchFooterProps {
  message?: string
}

export function WatchFooter({ message = "Press Ctrl+C to exit" }: WatchFooterProps): React.ReactElement {
  return (
    <Box marginTop={1}>
      <Text color={colors.muted}>{message}</Text>
    </Box>
  )
}
