import { Command } from "commander"
import { getContext, getOutputOptions } from "../../cli/program.js"
import { output, outputError, outputSuccess } from "../../cli/output.js"
import { validatePositiveInteger } from "../../lib/validation.js"
import { getAssetIndex } from "./shared.js"

export function registerSetLeverageCommand(order: Command): void {
  order
    .command("set-leverage")
    .description("Set leverage for a coin")
    .argument("<coin>", "Coin symbol")
    .argument("<leverage>", "Leverage value")
    .option("--cross", "Use cross margin")
    .option("--isolated", "Use isolated margin")
    .action(async function (
      this: Command,
      coin: string,
      leverageArg: string,
      options: { cross?: boolean; isolated?: boolean },
    ) {
      const ctx = getContext(this)
      const outputOpts = getOutputOptions(this)

      try {
        const client = ctx.getWalletClient()
        const publicClient = ctx.getPublicClient()

        const leverage = validatePositiveInteger(leverageArg, "leverage")
        const assetIndex = await getAssetIndex(publicClient, coin)

        // Default to cross margin if neither specified
        const isCross = options.cross || !options.isolated

        const result = await client.updateLeverage({
          asset: assetIndex,
          isCross,
          leverage,
        })

        if (outputOpts.json) {
          output(result, outputOpts)
        } else {
          outputSuccess(
            `Leverage set to ${leverage}x (${isCross ? "cross" : "isolated"}) for ${coin}`,
          )
        }
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
