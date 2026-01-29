import { Command } from "commander"
import { getContext, getOutputOptions } from "../cli/program.js"
import { output, outputError, outputSuccess } from "../cli/output.js"
import {
  validatePositiveNumber,
  validateTif,
  validateDirection,
} from "../lib/validation.js"
import { loadUserConfig } from "../lib/userConfig.js"
import { resolveSpotPair, resolvePerpAsset } from "../lib/spotResolver.js"

export function registerTradeCommands(program: Command): void {
  const trade = program
    .command("trade")
    .description("Execute trades (requires authentication)")

  // Market order subcommand
  trade
    .command("market")
    .description("Place a market order")
    .argument("<direction>", "Direction: long|short (perp) or buy|sell (spot)")
    .argument("<size>", "Order size")
    .argument("<coin>", "Coin symbol (BTC, ETH) or pair (BTC/USDC for spot)")
    .option("-r, --reduce-only", "Reduce-only order")
    .option("--slippage <pct>", "Slippage percentage (overrides config)")
    .action(async function (
      this: Command,
      directionArg: string,
      sizeArg: string,
      coin: string,
      options: {
        reduceOnly?: boolean
        slippage?: string
      }
    ) {
      const ctx = getContext(this)
      const outputOpts = getOutputOptions(this)

      try {
        const client = ctx.getWalletClient()
        const publicClient = ctx.getPublicClient()

        const { marketType, isBuy } = validateDirection(directionArg)
        const size = validatePositiveNumber(sizeArg, "size")

        // Get slippage from option or config
        const userConfig = loadUserConfig()
        const slippagePct =
          (options.slippage
            ? parseFloat(options.slippage)
            : userConfig.slippage) / 100

        let assetIndex: number
        let coinName: string

        if (marketType === "perp") {
          const perp = await resolvePerpAsset(publicClient, coin)
          assetIndex = perp.assetIndex
          coinName = perp.name
        } else {
          const spotPair = await resolveSpotPair(publicClient, coin)
          assetIndex = spotPair.assetId
          coinName = spotPair.name
        }

        // Get mid price for slippage calculation
        const mids = await publicClient.allMids()
        const midKey = marketType === "perp" ? coinName : coinName
        const midPrice = parseFloat(mids[midKey])
        if (!midPrice) {
          throw new Error(`Cannot get mid price for ${coinName}`)
        }

        const limitPx = isBuy
          ? midPrice * (1 + slippagePct)
          : midPrice * (1 - slippagePct)

        const orderRequest: Parameters<typeof client.order>[0] = {
          orders: [
            {
              a: assetIndex,
              b: isBuy,
              p: limitPx.toFixed(6),
              s: size.toString(),
              r: options.reduceOnly || false,
              t: { limit: { tif: "Ioc" } },
            },
          ],
          grouping: "na",
        }

        const result = await client.order(orderRequest)
        handleOrderResult(result, outputOpts)
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })

  // Limit order subcommand
  trade
    .command("limit")
    .description("Place a limit order")
    .argument("<direction>", "Direction: long|short (perp) or buy|sell (spot)")
    .argument("<size>", "Order size")
    .argument("<coin>", "Coin symbol (BTC, ETH) or pair (BTC/USDC for spot)")
    .argument("<price>", "Limit price")
    .option("-r, --reduce-only", "Reduce-only order")
    .option("--tif <tif>", "Time-in-force: gtc|ioc|alo", "gtc")
    .action(async function (
      this: Command,
      directionArg: string,
      sizeArg: string,
      coin: string,
      priceArg: string,
      options: {
        reduceOnly?: boolean
        tif?: string
      }
    ) {
      const ctx = getContext(this)
      const outputOpts = getOutputOptions(this)

      try {
        const client = ctx.getWalletClient()
        const publicClient = ctx.getPublicClient()

        const { marketType, isBuy } = validateDirection(directionArg)
        const size = validatePositiveNumber(sizeArg, "size")
        const price = validatePositiveNumber(priceArg, "price")
        const tif = validateTif(options.tif || "gtc")

        let assetIndex: number

        if (marketType === "perp") {
          const perp = await resolvePerpAsset(publicClient, coin)
          assetIndex = perp.assetIndex
        } else {
          const spotPair = await resolveSpotPair(publicClient, coin)
          assetIndex = spotPair.assetId
        }

        const orderRequest: Parameters<typeof client.order>[0] = {
          orders: [
            {
              a: assetIndex,
              b: isBuy,
              p: price.toString(),
              s: size.toString(),
              r: options.reduceOnly || false,
              t: { limit: { tif } },
            },
          ],
          grouping: "na",
        }

        const result = await client.order(orderRequest)
        handleOrderResult(result, outputOpts)
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })

  // Stop-loss subcommand
  trade
    .command("sl")
    .description("Place a stop-loss order")
    .argument("<direction>", "Direction: long|short (perp) or buy|sell (spot)")
    .argument("<size>", "Order size")
    .argument("<coin>", "Coin symbol (BTC, ETH) or pair (BTC/USDC for spot)")
    .argument("<trigger>", "Trigger price")
    .option("--limit <price>", "Limit price (market execution if omitted)")
    .option("-r, --reduce-only", "Reduce-only order")
    .option("--slippage <pct>", "Slippage percentage for market SL (overrides config)")
    .action(async function (
      this: Command,
      directionArg: string,
      sizeArg: string,
      coin: string,
      triggerArg: string,
      options: {
        limit?: string
        reduceOnly?: boolean
        slippage?: string
      }
    ) {
      const ctx = getContext(this)
      const outputOpts = getOutputOptions(this)

      try {
        const client = ctx.getWalletClient()
        const publicClient = ctx.getPublicClient()

        const { marketType, isBuy } = validateDirection(directionArg)
        const size = validatePositiveNumber(sizeArg, "size")
        const triggerPx = validatePositiveNumber(triggerArg, "trigger price")

        let assetIndex: number
        let coinName: string

        if (marketType === "perp") {
          const perp = await resolvePerpAsset(publicClient, coin)
          assetIndex = perp.assetIndex
          coinName = perp.name
        } else {
          const spotPair = await resolveSpotPair(publicClient, coin)
          assetIndex = spotPair.assetId
          coinName = spotPair.name
        }

        let limitPx: number
        let isMarket: boolean

        if (options.limit) {
          limitPx = validatePositiveNumber(options.limit, "limit price")
          isMarket = false
        } else {
          // Market SL: use mid price with slippage
          const userConfig = loadUserConfig()
          const slippagePct =
            (options.slippage
              ? parseFloat(options.slippage)
              : userConfig.slippage) / 100

          const mids = await publicClient.allMids()
          const midPrice = parseFloat(mids[coinName])
          if (!midPrice) {
            throw new Error(`Cannot get mid price for ${coinName}`)
          }

          limitPx = isBuy
            ? midPrice * (1 + slippagePct)
            : midPrice * (1 - slippagePct)
          isMarket = true
        }

        const orderRequest: Parameters<typeof client.order>[0] = {
          orders: [
            {
              a: assetIndex,
              b: isBuy,
              p: limitPx.toFixed(6),
              s: size.toString(),
              r: options.reduceOnly || false,
              t: {
                trigger: {
                  triggerPx: triggerPx.toString(),
                  isMarket,
                  tpsl: "sl",
                },
              },
            },
          ],
          grouping: "na",
        }

        const result = await client.order(orderRequest)
        handleOrderResult(result, outputOpts)
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })

  // Take-profit subcommand
  trade
    .command("tp")
    .description("Place a take-profit order")
    .argument("<direction>", "Direction: long|short (perp) or buy|sell (spot)")
    .argument("<size>", "Order size")
    .argument("<coin>", "Coin symbol (BTC, ETH) or pair (BTC/USDC for spot)")
    .argument("<trigger>", "Trigger price")
    .option("--limit <price>", "Limit price (market execution if omitted)")
    .option("-r, --reduce-only", "Reduce-only order")
    .option("--slippage <pct>", "Slippage percentage for market TP (overrides config)")
    .action(async function (
      this: Command,
      directionArg: string,
      sizeArg: string,
      coin: string,
      triggerArg: string,
      options: {
        limit?: string
        reduceOnly?: boolean
        slippage?: string
      }
    ) {
      const ctx = getContext(this)
      const outputOpts = getOutputOptions(this)

      try {
        const client = ctx.getWalletClient()
        const publicClient = ctx.getPublicClient()

        const { marketType, isBuy } = validateDirection(directionArg)
        const size = validatePositiveNumber(sizeArg, "size")
        const triggerPx = validatePositiveNumber(triggerArg, "trigger price")

        let assetIndex: number
        let coinName: string

        if (marketType === "perp") {
          const perp = await resolvePerpAsset(publicClient, coin)
          assetIndex = perp.assetIndex
          coinName = perp.name
        } else {
          const spotPair = await resolveSpotPair(publicClient, coin)
          assetIndex = spotPair.assetId
          coinName = spotPair.name
        }

        let limitPx: number
        let isMarket: boolean

        if (options.limit) {
          limitPx = validatePositiveNumber(options.limit, "limit price")
          isMarket = false
        } else {
          // Market TP: use mid price with slippage
          const userConfig = loadUserConfig()
          const slippagePct =
            (options.slippage
              ? parseFloat(options.slippage)
              : userConfig.slippage) / 100

          const mids = await publicClient.allMids()
          const midPrice = parseFloat(mids[coinName])
          if (!midPrice) {
            throw new Error(`Cannot get mid price for ${coinName}`)
          }

          limitPx = isBuy
            ? midPrice * (1 + slippagePct)
            : midPrice * (1 - slippagePct)
          isMarket = true
        }

        const orderRequest: Parameters<typeof client.order>[0] = {
          orders: [
            {
              a: assetIndex,
              b: isBuy,
              p: limitPx.toFixed(6),
              s: size.toString(),
              r: options.reduceOnly || false,
              t: {
                trigger: {
                  triggerPx: triggerPx.toString(),
                  isMarket,
                  tpsl: "tp",
                },
              },
            },
          ],
          grouping: "na",
        }

        const result = await client.order(orderRequest)
        handleOrderResult(result, outputOpts)
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}

// Helper function to handle order results
function handleOrderResult(
  result: {
    response: {
      data: {
        statuses: Array<
          | string
          | { filled: { totalSz: string; avgPx: string } }
          | { resting: { oid: number } }
        >
      }
    }
  },
  outputOpts: { json: boolean }
): void {
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
}
