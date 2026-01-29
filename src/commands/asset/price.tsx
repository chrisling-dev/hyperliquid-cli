import React, { useState, useEffect } from "react"
import { Box, Text, render } from "ink"
import { Command } from "commander"
import { getContext, getOutputOptions } from "../../cli/program.js"
import { output, outputError } from "../../cli/output.js"
import { hideCursor, showCursor } from "../../cli/watch.js"
import { createPriceWatcher } from "../../lib/price-watcher.js"
import { WatchHeader, WatchFooter } from "../../cli/ink/index.js"
import { colors } from "../../cli/ink/theme.js"

interface PriceDisplayProps {
  coin: string
  price: string
  isWatch?: boolean
  lastUpdated?: Date
}

function PriceDisplay({ coin, price, isWatch, lastUpdated }: PriceDisplayProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      {isWatch && <WatchHeader title={`${coin} Price`} lastUpdated={lastUpdated} />}
      <Box>
        <Text bold color={colors.header}>{coin}</Text>
        <Text>: </Text>
        <Text bold>{price}</Text>
      </Box>
      {isWatch && <WatchFooter />}
    </Box>
  )
}

interface WatchPriceProps {
  coin: string
  isTestnet: boolean
  isJson: boolean
}

function WatchPrice({ coin, isTestnet, isJson }: WatchPriceProps): React.ReactElement {
  const [price, setPrice] = useState<string>("-")
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const watcher = createPriceWatcher({
      coin,
      isTestnet,
      onUpdate: (newPrice) => {
        if (isJson) {
          console.log(JSON.stringify({ coin, price: newPrice, timestamp: new Date().toISOString() }))
          return
        }
        setPrice(newPrice)
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
    <PriceDisplay coin={coin} price={price} isWatch={true} lastUpdated={lastUpdated} />
  )
}

export function registerPriceCommand(asset: Command): void {
  asset
    .command("price")
    .description("Get price of a specific asset")
    .argument("<coin>", "Coin symbol (e.g., BTC, ETH)")
    .option("-w, --watch", "Watch mode - stream real-time updates")
    .action(async function (this: Command, coin: string, options: { watch?: boolean }) {
      const ctx = getContext(this)
      const outputOpts = getOutputOptions(this)
      const coinUpper = coin.toUpperCase()

      try {
        if (options.watch) {
          if (!outputOpts.json) {
            hideCursor()
          }

          const { unmount, waitUntilExit } = render(
            <WatchPrice coin={coinUpper} isTestnet={ctx.config.testnet} isJson={outputOpts.json} />
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
        let mids: Record<string, string>

        const serverClient = await ctx.getServerClient()
        if (serverClient) {
          try {
            const { data } = await serverClient.getPrices()
            mids = data
            serverClient.close()
          } catch {
            serverClient.close()
            const client = ctx.getPublicClient()
            mids = await client.allMids()
          }
        } else {
          const client = ctx.getPublicClient()
          mids = await client.allMids()
        }

        const price = mids[coinUpper]
        if (price === undefined) {
          outputError(`Coin not found: ${coinUpper}`)
          process.exit(1)
        }

        if (outputOpts.json) {
          output({ coin: coinUpper, price }, outputOpts)
        } else {
          const { unmount, waitUntilExit } = render(<PriceDisplay coin={coinUpper} price={price} />)
          await waitUntilExit()
          unmount()
        }
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
