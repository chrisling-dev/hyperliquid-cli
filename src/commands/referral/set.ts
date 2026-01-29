import { Command } from "commander"
import { getContext, getOutputOptions } from "../../cli/program.js"
import { output, outputError, outputSuccess } from "../../cli/output.js"

export function registerSetCommand(referral: Command): void {
  referral
    .command("set")
    .description("Set referral code (link to a referrer)")
    .argument("<code>", "Referral code")
    .action(async function (this: Command, code: string) {
      const ctx = getContext(this)
      const outputOpts = getOutputOptions(this)

      try {
        const client = ctx.getWalletClient()
        const result = await client.setReferrer({ code })

        if (outputOpts.json) {
          output(result, outputOpts)
        } else {
          outputSuccess(`Referral code set: ${code}`)
        }
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
