import React, { useState, useEffect } from "react"
import { Box, Text, render } from "ink"
import { Command } from "commander"
import { WebSocketTransport, SubscriptionClient } from "@nktkas/hyperliquid"
import WebSocket from "ws"
import { getContext, getOutputOptions } from "../../cli/program.js"
import { output, outputError } from "../../cli/output.js"
import { validateAddress } from "../../lib/validation.js"
import { hideCursor, showCursor } from "../../cli/watch.js"
import { WatchHeader, WatchFooter } from "../../cli/ink/index.js"
import { colors } from "../../cli/ink/theme.js"
import type { Address } from "viem"
import type { ActiveAssetDataEvent } from "@nktkas/hyperliquid/api/subscription"

interface LeverageInfo {
  coin: string
  leverage: { value: number; type: string; rawUsd?: string }
  maxLeverage: number
  maxTradeSzs: [string, string]
  availableToTrade: [string, string]
  markPx: string
  position: { size: string; value: string } | null
  margin: {
    accountValue: string
    totalMarginUsed: string
    availableMargin: string
  }
}

interface LeverageDisplayProps {
  info: LeverageInfo
  isWatch?: boolean
  lastUpdated?: Date
}

function LeverageDisplay({
  info,
  isWatch,
  lastUpdated,
}: LeverageDisplayProps): React.ReactElement {
  const hasPosition = info.position !== null && parseFloat(info.position.size) !== 0

  return (
    <Box flexDirection="column">
      {isWatch && <WatchHeader title={`${info.coin} Leverage`} lastUpdated={lastUpdated} />}

      <Box flexDirection="column" marginBottom={1}>
        <Text bold color={colors.header}>
          {info.coin} Leverage Info
        </Text>
      </Box>

      <Box flexDirection="column">
        <Box>
          <Text>Leverage: </Text>
          <Text bold>
            {info.leverage.value}x {info.leverage.type}
          </Text>
        </Box>
        <Box>
          <Text>Max Leverage: </Text>
          <Text bold>{info.maxLeverage}x</Text>
        </Box>
        <Box>
          <Text>Mark Price: </Text>
          <Text bold>${info.markPx}</Text>
        </Box>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold color={colors.header}>
          Position
        </Text>
        {hasPosition ? (
          <>
            <Box>
              <Text>Size: </Text>
              <Text bold>{info.position!.size}</Text>
            </Box>
            <Box>
              <Text>Value: </Text>
              <Text bold>${info.position!.value}</Text>
            </Box>
          </>
        ) : (
          <Text color={colors.muted}>No position</Text>
        )}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold color={colors.header}>
          Trading Capacity
        </Text>
        <Box>
          <Text>Available to Trade: </Text>
          <Text bold color={colors.profit}>
            {info.availableToTrade[0]} / {info.availableToTrade[1]}
          </Text>
        </Box>
        <Box>
          <Text>Max Trade Size: </Text>
          <Text bold>
            {info.maxTradeSzs[0]} / {info.maxTradeSzs[1]}
          </Text>
        </Box>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text bold color={colors.header}>
          Margin
        </Text>
        <Box>
          <Text>Account Value: </Text>
          <Text bold>${info.margin.accountValue}</Text>
        </Box>
        <Box>
          <Text>Total Margin Used: </Text>
          <Text bold>${info.margin.totalMarginUsed}</Text>
        </Box>
        <Box>
          <Text>Available Margin: </Text>
          <Text bold color={colors.profit}>${info.margin.availableMargin}</Text>
        </Box>
      </Box>

      {isWatch && <WatchFooter />}
    </Box>
  )
}

interface WatchLeverageProps {
  coin: string
  user: Address
  maxLeverage: number
  initialMargin: { accountValue: string; totalMarginUsed: string; availableMargin: string }
  initialPosition: { size: string; value: string } | null
  isTestnet: boolean
  isJson: boolean
}

function WatchLeverage({
  coin,
  user,
  maxLeverage,
  initialMargin,
  initialPosition,
  isTestnet,
  isJson,
}: WatchLeverageProps): React.ReactElement {
  const [info, setInfo] = useState<LeverageInfo | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let wsTransport: WebSocketTransport | null = null
    let subscriptionClient: SubscriptionClient | null = null
    let subscription: { unsubscribe(): Promise<void> } | null = null

    async function start() {
      try {
        wsTransport = new WebSocketTransport({
          isTestnet,
          reconnect: { WebSocket: WebSocket as unknown as typeof globalThis.WebSocket },
        })
        subscriptionClient = new SubscriptionClient({ transport: wsTransport })

        await wsTransport.ready()

        subscription = await subscriptionClient.activeAssetData(
          { user, coin },
          (data: ActiveAssetDataEvent) => {
            const leverageInfo: LeverageInfo = {
              coin: data.coin,
              leverage: data.leverage,
              maxLeverage,
              maxTradeSzs: data.maxTradeSzs,
              availableToTrade: data.availableToTrade,
              markPx: data.markPx,
              position: initialPosition,
              margin: initialMargin,
            }

            if (isJson) {
              console.log(
                JSON.stringify({
                  ...formatJsonOutput(leverageInfo),
                  timestamp: new Date().toISOString(),
                }),
              )
              return
            }

            setInfo(leverageInfo)
            setLastUpdated(new Date())
            setError(null)
          },
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    }

    start()

    return () => {
      if (subscription) {
        subscription.unsubscribe().catch(() => {})
      }
      if (wsTransport) {
        wsTransport.close().catch(() => {})
      }
    }
  }, [coin, user, maxLeverage, initialMargin, initialPosition, isTestnet, isJson])

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

  if (!info) {
    return <Text color={colors.muted}>Loading...</Text>
  }

  return <LeverageDisplay info={info} isWatch={true} lastUpdated={lastUpdated} />
}

function formatJsonOutput(info: LeverageInfo): object {
  return {
    coin: info.coin,
    leverage: info.leverage,
    maxLeverage: info.maxLeverage,
    markPx: info.markPx,
    maxTradeSzs: info.maxTradeSzs,
    availableToTrade: info.availableToTrade,
    position: info.position,
    margin: info.margin,
  }
}

async function getMaxLeverage(
  publicClient: { allPerpMetas: () => Promise<Array<{ universe: Array<{ name: string; maxLeverage: number }> }>> },
  coin: string,
): Promise<number> {
  const allPerpMetas = await publicClient.allPerpMetas()

  for (const dex of allPerpMetas) {
    const asset = dex.universe.find((a) => a.name === coin)
    if (asset) {
      return asset.maxLeverage
    }
  }

  // Default if not found
  return 50
}

export function registerLeverageCommand(asset: Command): void {
  asset
    .command("leverage")
    .description("Get leverage and margin info for a specific asset")
    .argument("<coin>", "Coin symbol (e.g., BTC, ETH, AAPL)")
    .option("--user <address>", "User address (defaults to configured wallet)")
    .option("-w, --watch", "Watch mode - stream real-time updates")
    .action(async function (this: Command, coin: string, options: { user?: string; watch?: boolean }) {
      const ctx = getContext(this)
      const outputOpts = getOutputOptions(this)

      try {
        let user: Address
        if (options.user) {
          user = validateAddress(options.user)
        } else {
          user = ctx.getWalletAddress()
        }

        const client = ctx.getPublicClient()

        // Fetch all required data in parallel
        const [activeAssetDataResult, clearinghouseState, maxLeverage] = await Promise.all([
          client.activeAssetData({ user, coin }),
          client.clearinghouseState({ user }),
          getMaxLeverage(client, coin),
        ])

        // Extract position for this coin
        type Position = {
          coin: string
          szi: string
          positionValue: string
        }

        const position = clearinghouseState.assetPositions
          .map((p: { position: Position }) => p.position)
          .find((p: Position) => p.coin === coin)

        const marginSummary = clearinghouseState.marginSummary
        const accountValue = parseFloat(marginSummary.accountValue)
        const totalMarginUsed = parseFloat(marginSummary.totalMarginUsed)
        const availableMargin = Math.max(0, accountValue - totalMarginUsed)

        const positionInfo = position && parseFloat(position.szi) !== 0
          ? { size: position.szi, value: position.positionValue }
          : null

        const marginInfo = {
          accountValue: marginSummary.accountValue,
          totalMarginUsed: marginSummary.totalMarginUsed,
          availableMargin: availableMargin.toFixed(2),
        }

        if (options.watch) {
          if (!outputOpts.json) {
            hideCursor()
          }

          const { unmount, waitUntilExit } = render(
            <WatchLeverage
              coin={coin}
              user={user}
              maxLeverage={maxLeverage}
              initialMargin={marginInfo}
              initialPosition={positionInfo}
              isTestnet={ctx.config.testnet}
              isJson={outputOpts.json}
            />,
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

        // Non-watch mode: display the data
        const info: LeverageInfo = {
          coin,
          leverage: activeAssetDataResult.leverage,
          maxLeverage,
          maxTradeSzs: activeAssetDataResult.maxTradeSzs,
          availableToTrade: activeAssetDataResult.availableToTrade,
          markPx: activeAssetDataResult.markPx,
          position: positionInfo,
          margin: marginInfo,
        }

        if (outputOpts.json) {
          output(formatJsonOutput(info), outputOpts)
        } else {
          const { unmount, waitUntilExit } = render(<LeverageDisplay info={info} />)
          await waitUntilExit()
          unmount()
        }
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
