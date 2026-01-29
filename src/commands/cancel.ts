import { Command } from "commander"
import { getContext, getOutputOptions } from "../cli/program.js"
import { output, outputError, outputSuccess } from "../cli/output.js"
import { validatePositiveInteger } from "../lib/validation.js"
import { resolvePerpAsset } from "../lib/spotResolver.js"

export function registerCancelCommand(program: Command): void {
  program
    .command("cancel")
    .description("Cancel an order (requires authentication)")
    .argument("<coin>", "Coin symbol (e.g., BTC, ETH)")
    .argument("<order-id>", "Order ID to cancel")
    .action(async function (
      this: Command,
      coin: string,
      orderIdArg: string
    ) {
      const ctx = getContext(this)
      const outputOpts = getOutputOptions(this)

      try {
        const client = ctx.getWalletClient()
        const publicClient = ctx.getPublicClient()

        const orderId = validatePositiveInteger(orderIdArg, "order-id")

        // Get asset index from meta
        const perp = await resolvePerpAsset(publicClient, coin)

        const result = await client.cancel({
          cancels: [{ a: perp.assetIndex, o: orderId }],
        })

        if (outputOpts.json) {
          output(result, outputOpts)
        } else {
          outputSuccess(`Order ${orderId} cancelled`)
        }
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
