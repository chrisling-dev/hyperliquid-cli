import React from "react"
import { Box, render } from "ink"
import { Command } from "commander"
import { getContext, getOutputOptions } from "../../cli/program.js"
import { output, outputError } from "../../cli/output.js"
import { Table, type Column } from "../../cli/ink/index.js"

interface PriceRow {
  coin: string
  price: string
}

interface PricesDisplayProps {
  prices: PriceRow[]
}

function PricesDisplay({ prices }: PricesDisplayProps): React.ReactElement {
  const columns: Column<PriceRow>[] = [
    { key: "coin", header: "Coin" },
    { key: "price", header: "Mid Price", align: "right" },
  ]

  return (
    <Box flexDirection="column">
      <Table data={prices} columns={columns} />
    </Box>
  )
}

export function registerPricesCommand(markets: Command): void {
  markets
    .command("prices")
    .description("Get mid prices for all assets")
    .action(async function (this: Command) {
      const ctx = getContext(this)
      const outputOpts = getOutputOptions(this)

      try {
        let mids: Record<string, string>

        // Try server cache first
        const serverClient = await ctx.getServerClient()
        if (serverClient) {
          try {
            const { data } = await serverClient.getPrices()
            mids = data
            serverClient.close()
          } catch {
            serverClient.close()
            const client = ctx.getPublicClient()
            mids = await client.allMids({ dex: "ALL_DEXS" })
          }
        } else {
          const client = ctx.getPublicClient()
          mids = await client.allMids()
        }

        const prices = Object.entries(mids)
          .map(([coin, price]) => ({ coin, price }))
          .sort((a, b) => a.coin.localeCompare(b.coin))

        if (outputOpts.json) {
          output(prices, outputOpts)
        } else {
          const { unmount, waitUntilExit } = render(<PricesDisplay prices={prices} />)
          await waitUntilExit()
          unmount()
        }
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
