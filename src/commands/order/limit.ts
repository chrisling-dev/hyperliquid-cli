import { Command } from "commander"
import { getContext, getOutputOptions } from "../../cli/program.js"
import { output, outputError, outputSuccess } from "../../cli/output.js"
import { validatePositiveNumber, validateTif } from "../../lib/validation.js"
import { validateSideWithAliases, getAssetIndex } from "./shared.js"

export function registerLimitCommand(order: Command): void {
  order
    .command("limit")
    .description("Place a limit order")
    .argument("<side>", "Order side: buy, sell, long, or short")
    .argument("<size>", "Order size")
    .argument("<coin>", "Coin symbol (e.g., BTC, ETH)")
    .argument("<price>", "Limit price")
    .option("--tif <tif>", "Time-in-force: Gtc, Ioc, Alo", "Gtc")
    .option("--reduce-only", "Reduce-only order")
    .action(async function (
      this: Command,
      sideArg: string,
      sizeArg: string,
      coin: string,
      priceArg: string,
      options: {
        tif?: string
        reduceOnly?: boolean
      }
    ) {
      const ctx = getContext(this)
      const outputOpts = getOutputOptions(this)

      try {
        const client = ctx.getWalletClient()
        const publicClient = ctx.getPublicClient()

        const side = validateSideWithAliases(sideArg)
        const size = validatePositiveNumber(sizeArg, "size")
        const limitPx = validatePositiveNumber(priceArg, "price")
        const tif = validateTif(options.tif || "Gtc")
        const isBuy = side === "buy"

        const assetIndex = await getAssetIndex(publicClient, coin)

        const orderRequest = {
          orders: [
            {
              a: assetIndex,
              b: isBuy,
              p: limitPx.toString(),
              s: size.toString(),
              r: options.reduceOnly || false,
              t: { limit: { tif } },
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
              outputSuccess(
                `Order filled: ${status.filled.totalSz} @ ${status.filled.avgPx}`
              )
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
