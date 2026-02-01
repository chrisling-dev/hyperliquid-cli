import React, { useState, useEffect } from "react"
import { Box, Text, render } from "ink"
import { Command } from "commander"
import { getContext, getOutputOptions } from "../../cli/program.js"
import { output, outputError } from "../../cli/output.js"
import { hideCursor, showCursor } from "../../cli/watch.js"
import { createBookWatcher, type BookLevel } from "../../lib/book-watcher.js"
import { WatchHeader, WatchFooter } from "../../cli/ink/index.js"
import { colors } from "../../cli/ink/theme.js"

const MAX_LEVELS = 10
const BAR_WIDTH = 20
const PRICE_WIDTH = 12
const SIZE_WIDTH = 12
const ORDERS_WIDTH = 4

// Unicode block characters for depth bar
const FULL_BLOCK = "█"

function createDepthBar(ratio: number, width: number): string {
  const filled = Math.max(1, Math.round(ratio * width))
  return FULL_BLOCK.repeat(Math.min(filled, width))
}

interface BookDisplayProps {
  coin: string
  bids: BookLevel[]
  asks: BookLevel[]
  isWatch?: boolean
  lastUpdated?: Date
}

function BookDisplay({
  coin,
  bids,
  asks,
  isWatch,
  lastUpdated,
}: BookDisplayProps): React.ReactElement {
  const displayBids = bids.slice(0, MAX_LEVELS)

  // Calculate cumulative sizes for depth
  // For asks: calculate cumulative from best ask (lowest price) BEFORE reversing for display
  // This ensures depth bars build away from the spread (smallest bar at best ask)
  const asksToProcess = asks.slice(0, MAX_LEVELS)
  let askCumulative = 0
  const asksWithCumulative = asksToProcess
    .map((level) => {
      askCumulative += parseFloat(level.sz)
      return { ...level, cumulative: askCumulative }
    })
    .reverse() // Reverse after cumulative calc for display (highest price at top)

  let bidCumulative = 0
  const bidsWithCumulative = displayBids.map((level) => {
    bidCumulative += parseFloat(level.sz)
    return { ...level, cumulative: bidCumulative }
  })

  // Find max cumulative for scaling (use same scale for both sides)
  // After reversing asks, first element has max cumulative (worst ask at top)
  const maxCumulative = Math.max(
    asksWithCumulative[0]?.cumulative || 0,
    bidsWithCumulative[bidsWithCumulative.length - 1]?.cumulative || 0,
  )

  // Best ask is now last element after reversing (closest to spread)
  const spread =
    asksWithCumulative.length > 0 && displayBids.length > 0
      ? (
          parseFloat(asksWithCumulative[asksWithCumulative.length - 1].px) -
          parseFloat(displayBids[0].px)
        ).toFixed(2)
      : null

  const totalWidth = PRICE_WIDTH + SIZE_WIDTH + ORDERS_WIDTH + BAR_WIDTH + 6 // 6 for spacing

  return (
    <Box flexDirection="column">
      {isWatch && <WatchHeader title={`${coin} Order Book`} lastUpdated={lastUpdated} />}
      {!isWatch && (
        <Box marginBottom={1}>
          <Text bold color={colors.header}>
            {coin} Order Book
          </Text>
        </Box>
      )}

      {/* Column headers */}
      <Box>
        <Box width={PRICE_WIDTH}>
          <Text color={colors.muted}>{"price".padEnd(PRICE_WIDTH)}</Text>
        </Box>
        <Text> </Text>
        <Box width={SIZE_WIDTH}>
          <Text color={colors.muted}>{"size".padEnd(SIZE_WIDTH)}</Text>
        </Box>
        <Text> </Text>
        <Box width={ORDERS_WIDTH}>
          <Text color={colors.muted}>{"#".padEnd(ORDERS_WIDTH)}</Text>
        </Box>
        <Text> </Text>
        <Box width={BAR_WIDTH}>
          <Text color={colors.muted}>{"depth".padEnd(BAR_WIDTH)}</Text>
        </Box>
      </Box>

      {/* Asks (sells) */}
      {asksWithCumulative.length > 0 ? (
        asksWithCumulative.map((level, i) => (
          <Box key={`ask-${i}`}>
            <Box width={PRICE_WIDTH}>
              <Text color={colors.loss}>{level.px.padEnd(PRICE_WIDTH)}</Text>
            </Box>
            <Text> </Text>
            <Box width={SIZE_WIDTH}>
              <Text>{level.sz.padEnd(SIZE_WIDTH)}</Text>
            </Box>
            <Text> </Text>
            <Box width={ORDERS_WIDTH}>
              <Text color={colors.muted}>{String(level.n).padEnd(ORDERS_WIDTH)}</Text>
            </Box>
            <Text> </Text>
            <Box width={BAR_WIDTH}>
              <Text color={colors.loss}>
                {createDepthBar(level.cumulative / maxCumulative, BAR_WIDTH)}
              </Text>
            </Box>
          </Box>
        ))
      ) : (
        <Text color={colors.muted}>No asks</Text>
      )}

      {/* Spread indicator */}
      {spread && (
        <Box>
          <Text color={colors.warning}>
            {"─".repeat(totalWidth / 2)} spread: {spread} {"─".repeat(totalWidth / 2)}
          </Text>
        </Box>
      )}

      {/* Bids (buys) */}
      {bidsWithCumulative.length > 0 ? (
        bidsWithCumulative.map((level, i) => (
          <Box key={`bid-${i}`}>
            <Box width={PRICE_WIDTH}>
              <Text color={colors.profit}>{level.px.padEnd(PRICE_WIDTH)}</Text>
            </Box>
            <Text> </Text>
            <Box width={SIZE_WIDTH}>
              <Text>{level.sz.padEnd(SIZE_WIDTH)}</Text>
            </Box>
            <Text> </Text>
            <Box width={ORDERS_WIDTH}>
              <Text color={colors.muted}>{String(level.n).padEnd(ORDERS_WIDTH)}</Text>
            </Box>
            <Text> </Text>
            <Box width={BAR_WIDTH}>
              <Text color={colors.profit}>
                {createDepthBar(level.cumulative / maxCumulative, BAR_WIDTH)}
              </Text>
            </Box>
          </Box>
        ))
      ) : (
        <Text color={colors.muted}>No bids</Text>
      )}

      {isWatch && <WatchFooter />}
    </Box>
  )
}

interface WatchBookProps {
  coin: string
  isTestnet: boolean
  isJson: boolean
}

function WatchBook({ coin, isTestnet, isJson }: WatchBookProps): React.ReactElement {
  const [bids, setBids] = useState<BookLevel[]>([])
  const [asks, setAsks] = useState<BookLevel[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const watcher = createBookWatcher({
      coin,
      isTestnet,
      onUpdate: (data) => {
        if (isJson) {
          console.log(JSON.stringify({ ...data, timestamp: new Date().toISOString() }))
          return
        }
        setBids(data.bids)
        setAsks(data.asks)
        setLastUpdated(new Date())
        setError(null)
      },
      onError: (err) => {
        setError(err.message)
      },
    })

    watcher.start()

    return () => {
      watcher.stop()
    }
  }, [coin, isTestnet, isJson])

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color={colors.loss}>Error: {error}</Text>
        <Text color={colors.muted}>Reconnecting...</Text>
      </Box>
    )
  }

  if (isJson) {
    return <Text color={colors.muted}>Streaming JSON...</Text>
  }

  return (
    <BookDisplay coin={coin} bids={bids} asks={asks} isWatch={true} lastUpdated={lastUpdated} />
  )
}

export function registerBookCommand(asset: Command): void {
  asset
    .command("book")
    .description("Get order book for a coin")
    .argument("<coin>", "Coin symbol (e.g., BTC, ETH)")
    .option("-w, --watch", "Watch mode - stream real-time updates")
    .action(async function (this: Command, coin: string, options: { watch?: boolean }) {
      const ctx = getContext(this)
      const outputOpts = getOutputOptions(this)
      const coinUpper = coin

      try {
        if (options.watch) {
          if (!outputOpts.json) {
            hideCursor()
          }

          const { unmount, waitUntilExit } = render(
            <WatchBook coin={coinUpper} isTestnet={ctx.config.testnet} isJson={outputOpts.json} />,
          )

          const cleanup = () => {
            if (!outputOpts.json) {
              showCursor()
            }
            unmount()
          }

          process.on("SIGINT", () => {
            cleanup()
            process.exit(0)
          })
          process.on("SIGTERM", () => {
            cleanup()
            process.exit(0)
          })

          await waitUntilExit()
          return
        }

        // Non-watch mode: fetch once
        const client = ctx.getPublicClient()
        const book = await client.l2Book({ coin: coinUpper })

        if (!book) {
          outputError(`No order book data for ${coinUpper}`)
          process.exit(1)
        }

        const levels = book.levels as [BookLevel[], BookLevel[]]
        const bookBids = levels[0] || []
        const bookAsks = levels[1] || []

        if (outputOpts.json) {
          output(book, outputOpts)
        } else {
          const { unmount, waitUntilExit } = render(
            <BookDisplay coin={coinUpper} bids={bookBids} asks={bookAsks} />,
          )
          await waitUntilExit()
          unmount()
        }
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
