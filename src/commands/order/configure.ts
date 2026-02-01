import { Command } from "commander"
import { getOutputOptions } from "../../cli/program.js"
import { output, outputError, outputSuccess } from "../../cli/output.js"
import { getOrderConfig, updateOrderConfig } from "../../lib/order-config.js"

export function registerConfigureCommand(order: Command): void {
  order
    .command("configure")
    .description("Configure order preferences")
    .option("--slippage <pct>", "Set default slippage percentage for market orders")
    .action(async function (
      this: Command,
      options: {
        slippage?: string
      }
    ) {
      const outputOpts = getOutputOptions(this)

      try {
        if (options.slippage) {
          const slippage = parseFloat(options.slippage)
          if (isNaN(slippage) || slippage < 0) {
            throw new Error("Slippage must be a non-negative number")
          }

          const config = updateOrderConfig({ slippage })

          if (outputOpts.json) {
            output(config, outputOpts)
          } else {
            outputSuccess(`Slippage set to ${slippage}%`)
          }
        } else {
          // Show current config
          const config = getOrderConfig()

          if (outputOpts.json) {
            output(config, outputOpts)
          } else {
            outputSuccess(`Current configuration:`)
            console.log(`  Slippage: ${config.slippage}%`)
          }
        }
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
