import React, { useState, useEffect } from "react"
import { Box, Text, render } from "ink"
import { Command } from "commander"
import { getContext, getOutputOptions } from "../../cli/program.js"
import type { CLIContext } from "../../cli/context.js"
import { output, outputError } from "../../cli/output.js"
import { Table, type Column, WatchHeader, WatchFooter } from "../../cli/ink/index.js"
import { colors } from "../../cli/ink/theme.js"
import { hideCursor, showCursor } from "../../cli/watch.js"
import type { ServerClient } from "../../client/index.js"
import type { AllPerpMetasResponse, SpotMetaResponse } from "@nktkas/hyperliquid"
import type {
  AllDexsAssetCtxsEvent,
  SpotAssetCtxsEvent,
} from "@nktkas/hyperliquid/api/subscription"

interface MarketDataRow {
  coin: string
  pairName: string
  price: string
  priceChange: number | null // percentage change from prevDayPx
  volumeUsd: string
  funding: string | null // perps only
  openInterest: string | null // perps only
}

interface MarketsDisplayProps {
  perpMarkets: MarketDataRow[]
  spotMarkets: MarketDataRow[]
  isWatch?: boolean
  lastUpdated?: Date
  error?: string | null
}

function formatPriceChange(change: number | null): string {
  if (change === null) return "-"
  const sign = change >= 0 ? "+" : ""
  return `${sign}${change.toFixed(2)}%`
}

function MarketsDisplay({
  perpMarkets,
  spotMarkets,
  isWatch,
  lastUpdated,
  error,
}: MarketsDisplayProps): React.ReactElement {
  const columns: Column<MarketDataRow>[] = [
    { key: "coin", header: "Coin" },
    { key: "pairName", header: "Pair" },
    { key: "price", header: "Price", align: "right" },
    {
      key: "priceChange",
      header: "24h %",
      align: "right",
      render: (value) => {
        const change = value as number | null
        const formatted = formatPriceChange(change)
        if (change === null) return <Text color={colors.muted}>{formatted}</Text>
        return <Text color={change >= 0 ? colors.profit : colors.loss}>{formatted}</Text>
      },
    },
    { key: "volumeUsd", header: "24h Volume", align: "right" },
    {
      key: "funding",
      header: "Funding",
      align: "right",
      render: (value) => {
        const funding = value as string | null
        if (funding === null) return <Text color={colors.muted}>-</Text>
        const numValue = parseFloat(funding)
        const formatted = `${(numValue * 100).toFixed(4)}%`
        return <Text color={numValue >= 0 ? colors.profit : colors.loss}>{formatted}</Text>
      },
    },
    {
      key: "openInterest",
      header: "Open Interest",
      align: "right",
      render: (value) => {
        const oi = value as string | null
        if (oi === null) return <Text color={colors.muted}>-</Text>
        return <Text>{oi}</Text>
      },
    },
  ]

  const title = `All Markets (${perpMarkets.length} perps, ${spotMarkets.length} spot)`

  return (
    <Box flexDirection="column">
      {isWatch ? (
        <WatchHeader title={title} lastUpdated={lastUpdated} />
      ) : (
        <Text bold color={colors.header}>
          {title}:
        </Text>
      )}
      {error && (
        <Box marginBottom={1}>
          <Text color={colors.loss}>Error: {error} </Text>
          <Text color={colors.muted}>(reconnecting...)</Text>
        </Box>
      )}
      <Box marginBottom={1}>
        <Table data={[...perpMarkets, ...spotMarkets]} columns={columns} />
      </Box>
      {isWatch && <WatchFooter />}
    </Box>
  )
}

interface WatchMarketsProps {
  ctx: CLIContext
  isSpotOnly: boolean
  isPerpOnly: boolean
  isJson: boolean
}

interface MarketData {
  perpMarkets: MarketDataRow[]
  spotMarkets: MarketDataRow[]
}

async function fetchMarketData(
  serverClient: ServerClient,
  isSpotOnly: boolean,
  isPerpOnly: boolean,
): Promise<MarketData> {
  const perpMarkets: MarketDataRow[] = []
  const spotMarkets: MarketDataRow[] = []

  const spotMeta = await serverClient.getSpotMeta()

  if (!isPerpOnly) {
    // Fetch spot asset contexts and build spot markets
    const spotAssetCtxs = await serverClient.getSpotAssetCtxs()
    buildSpotMarkets(spotMeta.data, spotAssetCtxs.data, spotMarkets)
  }

  if (!isSpotOnly) {
    const allPerpMetas = await serverClient.getPerpMeta()
    const assetCtxs = await serverClient.getAssetCtxs()
    buildPerpMarkets(allPerpMetas.data, spotMeta.data, assetCtxs.data, perpMarkets)
  }

  return { perpMarkets, spotMarkets }
}

function calculatePriceChange(
  markPx: string | undefined,
  prevDayPx: string | undefined,
): number | null {
  if (!markPx || !prevDayPx) return null
  const current = parseFloat(markPx)
  const previous = parseFloat(prevDayPx)
  if (previous === 0 || isNaN(current) || isNaN(previous)) return null
  return ((current - previous) / previous) * 100
}

function formatVolume(volume: string | undefined): string {
  if (!volume) return "N/A"
  const num = parseFloat(volume)
  if (isNaN(num)) return "N/A"
  return num.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function buildSpotMarkets(
  spotMeta: SpotMetaResponse,
  spotAssetCtxs: SpotAssetCtxsEvent,
  spotMarkets: MarketDataRow[],
): void {
  // Create a map of coin -> context for quick lookup
  const ctxMap = new Map<string, SpotAssetCtxsEvent[number]>()
  for (const ctx of spotAssetCtxs) {
    ctxMap.set(ctx.coin, ctx)
  }

  // Iterate over spot universe
  for (const pair of spotMeta.universe) {
    const baseToken = spotMeta.tokens[pair.tokens[0]]
    const quoteToken = spotMeta.tokens[pair.tokens[1]]
    const ctx = ctxMap.get(pair.name)

    spotMarkets.push({
      coin: pair.name,
      pairName: `[Spot] ${baseToken?.name || "?"}/${quoteToken?.name || "?"}`,
      price: ctx?.markPx ?? "?",
      priceChange: calculatePriceChange(ctx?.markPx, ctx?.prevDayPx),
      volumeUsd: formatVolume(ctx?.dayNtlVlm),
      funding: null, // spot markets don't have funding
      openInterest: null, // spot markets don't have OI
    })
  }
}

function buildPerpMarkets(
  allPerpMetas: AllPerpMetasResponse,
  spotMeta: SpotMetaResponse,
  assetCtxs: AllDexsAssetCtxsEvent,
  perpMarkets: MarketDataRow[],
): void {
  allPerpMetas.forEach((m, index) => {
    const collateralToken = spotMeta.tokens[m.collateralToken]
    const dexCtxs = assetCtxs.ctxs.find((dexName) =>
      index === 0 ? dexName[0] === "" : dexName[0] === m.universe[0]?.name?.split(":")[0],
    )

    m.universe.forEach((market, uIndex) => {
      const assetCtx = dexCtxs?.[1][uIndex]
      const displayName = index === 0 ? market.name : `${market.name.split(":")[1]}`
      perpMarkets.push({
        coin: market.name,
        pairName: `${displayName}/${collateralToken?.name || "?"} ${market.maxLeverage}x${index === 0 ? "" : " @" + m.universe[0]?.name?.split(":")[0]}`,
        price: assetCtx?.markPx ?? "?",
        priceChange: calculatePriceChange(assetCtx?.markPx, assetCtx?.prevDayPx),
        volumeUsd: formatVolume(assetCtx?.dayNtlVlm),
        funding: assetCtx?.funding ?? null,
        openInterest: assetCtx?.openInterest ? formatVolume(assetCtx.openInterest) : null,
      })
    })
  })
}

function WatchMarkets({
  ctx,
  isSpotOnly,
  isPerpOnly,
  isJson,
}: WatchMarketsProps): React.ReactElement {
  const [marketData, setMarketData] = useState<MarketData>({ perpMarkets: [], spotMarkets: [] })
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const poll = async () => {
      try {
        const serverClient = await ctx.getServerClient()
        if (!serverClient) {
          setError("Server not running. Start with: hl server start")
        } else {
          const data = await fetchMarketData(serverClient, isSpotOnly, isPerpOnly)
          // Don't close - the client is cached and reused across polls

          if (!cancelled) {
            if (isJson) {
              console.log(JSON.stringify({ ...data, timestamp: new Date().toISOString() }))
            } else {
              setMarketData(data)
              setLastUpdated(new Date())
              setError(null)
            }
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err))
        }
      } finally {
        if (!cancelled) {
          timeoutId = setTimeout(poll, 250)
        }
      }
    }

    poll()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [ctx, isSpotOnly, isPerpOnly, isJson])

  if (isJson) {
    return <Text color={colors.muted}>Streaming JSON...</Text>
  }

  return (
    <MarketsDisplay
      perpMarkets={marketData.perpMarkets}
      spotMarkets={marketData.spotMarkets}
      isWatch={true}
      lastUpdated={lastUpdated}
      error={error}
    />
  )
}

export function registerLsCommand(markets: Command): void {
  markets
    .command("ls")
    .option("--spot-only", "List only spot markets", false)
    .option("--perp-only", "List only perpetual markets", false)
    .option("-w, --watch", "Watch mode - stream real-time updates")
    .description("List all markets (perps + spot)")
    .action(async function (
      this: Command,
      options: { spotOnly?: boolean; perpOnly?: boolean; watch?: boolean },
    ) {
      const ctx = getContext(this)
      const outputOpts = getOutputOptions(this)

      const isSpotOnly = options.spotOnly ?? false
      const isPerpOnly = options.perpOnly ?? false

      try {
        if (options.watch) {
          if (!outputOpts.json) {
            hideCursor()
          }

          const { unmount, waitUntilExit } = render(
            <WatchMarkets
              ctx={ctx}
              isSpotOnly={isSpotOnly}
              isPerpOnly={isPerpOnly}
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

        // Non-watch mode: fetch once
        const serverClient = await ctx.getServerClient()
        if (serverClient) {
          const { perpMarkets, spotMarkets } = await fetchMarketData(
            serverClient,
            isSpotOnly,
            isPerpOnly,
          )
          serverClient.close()

          if (outputOpts.json) {
            output({ perpMarkets, spotMarkets }, outputOpts)
          } else {
            const { unmount, waitUntilExit } = render(
              <MarketsDisplay perpMarkets={perpMarkets} spotMarkets={spotMarkets} />,
            )
            await waitUntilExit()
            unmount()
          }
        } else {
          outputError("Server not running. Start with: hl server start")
          process.exit(1)
        }
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
