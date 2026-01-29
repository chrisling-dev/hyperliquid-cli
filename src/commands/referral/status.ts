import { Command } from "commander"
import { getContext, getOutputOptions } from "../../cli/program.js"
import { output, outputError } from "../../cli/output.js"

export function registerStatusCommand(referral: Command): void {
  referral
    .command("status")
    .description("Get referral status")
    .action(async function (this: Command) {
      const ctx = getContext(this)
      const outputOpts = getOutputOptions(this)

      try {
        const client = ctx.getPublicClient()
        const user = ctx.getWalletAddress()
        const result = await client.referral({ user })

        if (outputOpts.json) {
          output(result, outputOpts)
        } else {
          if (!result) {
            console.log("No referral information found")
          } else {
            output(result, outputOpts)
          }
        }
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
