import React from "react"
import { Box, Text, render } from "ink"
import { Command } from "commander"
import { getContext, getOutputOptions } from "../../cli/program.js"
import { output, outputError } from "../../cli/output.js"
import { Table, type Column } from "../../cli/ink/index.js"
import { colors } from "../../cli/ink/theme.js"

interface PerpMarketRow {
  coin: string
  maxLeverage: number
  szDecimals: number
}

interface SpotMarketRow {
  name: string
  baseCoin: string
  quoteCoin: string
}

interface MarketsDisplayProps {
  perpMarkets: PerpMarketRow[]
  spotMarkets: SpotMarketRow[]
}

function MarketsDisplay({ perpMarkets, spotMarkets }: MarketsDisplayProps): React.ReactElement {
  const perpColumns: Column<PerpMarketRow>[] = [
    { key: "coin", header: "Coin" },
    { key: "maxLeverage", header: "Max Leverage", align: "right" },
    { key: "szDecimals", header: "Size Decimals", align: "right" },
  ]

  const spotColumns: Column<SpotMarketRow>[] = [
    { key: "name", header: "Name" },
    { key: "baseCoin", header: "Base" },
    { key: "quoteCoin", header: "Quote" },
  ]

  return (
    <Box flexDirection="column">
      <Text bold color={colors.header}>Perpetual Markets ({perpMarkets.length}):</Text>
      <Box marginBottom={1}>
        <Table data={perpMarkets} columns={perpColumns} />
      </Box>

      <Text bold color={colors.header}>Spot Markets ({spotMarkets.length}):</Text>
      <Table data={spotMarkets} columns={spotColumns} />
    </Box>
  )
}

export function registerLsCommand(markets: Command): void {
  markets
    .command("ls")
    .description("List all markets (perps + spot)")
    .action(async function (this: Command) {
      const ctx = getContext(this)
      const outputOpts = getOutputOptions(this)

      try {
        const client = ctx.getPublicClient()

        // Fetch perp and spot metadata
        const [perpMeta, spotMeta] = await Promise.all([client.meta(), client.spotMeta()])

        const perpMarkets = perpMeta.universe.map((m) => ({
          coin: m.name,
          maxLeverage: m.maxLeverage,
          szDecimals: m.szDecimals,
        }))

        const spotMarkets = spotMeta.universe.map((m) => {
          const baseToken = spotMeta.tokens[m.tokens[0]]
          const quoteToken = spotMeta.tokens[m.tokens[1]]
          return {
            name: m.name,
            baseCoin: baseToken?.name || "?",
            quoteCoin: quoteToken?.name || "?",
          }
        })

        if (outputOpts.json) {
          output({ perpMarkets, spotMarkets }, outputOpts)
        } else {
          const { unmount, waitUntilExit } = render(
            <MarketsDisplay perpMarkets={perpMarkets} spotMarkets={spotMarkets} />
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
