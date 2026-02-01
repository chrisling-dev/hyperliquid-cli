import { Command } from "commander"
import { getContext, getOutputOptions } from "../../cli/program.js"
import { output, outputError, outputSuccess } from "../../cli/output.js"
import { validatePositiveNumber } from "../../lib/validation.js"
import { getOrderConfig } from "../../lib/order-config.js"
import { validateSideWithAliases, getAssetIndex } from "./shared.js"

export function registerMarketCommand(order: Command): void {
  order
    .command("market")
    .description("Place a market order")
    .argument("<side>", "Order side: buy, sell, long, or short")
    .argument("<size>", "Order size")
    .argument("<coin>", "Coin symbol (e.g., BTC, ETH)")
    .option("--reduce-only", "Reduce-only order")
    .option("--slippage <pct>", "Slippage percentage (overrides config)")
    .action(async function (
      this: Command,
      sideArg: string,
      sizeArg: string,
      coin: string,
      options: {
        reduceOnly?: boolean
        slippage?: string
      },
    ) {
      const ctx = getContext(this)
      const outputOpts = getOutputOptions(this)

      try {
        const client = ctx.getWalletClient()
        const publicClient = ctx.getPublicClient()

        const side = validateSideWithAliases(sideArg)
        const size = validatePositiveNumber(sizeArg, "size")
        const isBuy = side === "buy"

        const assetIndex = await getAssetIndex(publicClient, coin)

        // Get slippage from option or config
        const config = getOrderConfig()
        const slippagePct =
          (options.slippage ? parseFloat(options.slippage) : config.slippage) / 100

        // Market order: IOC at mid price + slippage
        const mids = await publicClient.allMids()
        const midPrice = parseFloat(mids[coin])
        if (!midPrice) {
          throw new Error(`Cannot get mid price for ${coin}`)
        }

        const limitPx = isBuy ? midPrice * (1 + slippagePct) : midPrice * (1 - slippagePct)

        const orderRequest = {
          orders: [
            {
              a: assetIndex,
              b: isBuy,
              p: limitPx.toFixed(6),
              s: size.toString(),
              r: options.reduceOnly || false,
              t: { limit: { tif: "Ioc" as const } },
            },
          ],
          grouping: "na" as const,
        }

        const result = await client.order(orderRequest)

        if (outputOpts.json) {
          output(result, outputOpts)
        } else {
          const statuses = result.response.data.statuses
          for (const status of statuses) {
            if (typeof status === "string") {
              outputSuccess(`Order status: ${status}`)
            } else if ("filled" in status) {
              outputSuccess(`Order filled: ${status.filled.totalSz} @ ${status.filled.avgPx}`)
            } else if ("resting" in status) {
              outputSuccess(`Order placed: ID ${status.resting.oid}`)
            }
          }
        }
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
