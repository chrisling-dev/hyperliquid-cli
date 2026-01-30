import { Command } from "commander"
import { getOutputOptions } from "../../cli/program.js"
import { output, outputError, outputSuccess } from "../../cli/output.js"
import { deleteAccount, getAccountByAlias } from "../../lib/db/index.js"
import { confirm } from "../../lib/prompts.js"

export function registerRemoveCommand(account: Command): void {
  account
    .command("remove")
    .description("Remove an account")
    .argument("<alias>", "Account alias to remove")
    .option("-f, --force", "Skip confirmation prompt")
    .action(async function (this: Command, alias: string, options: { force?: boolean }) {
      const outputOpts = getOutputOptions(this)

      try {
        // Check if account exists
        const existingAccount = getAccountByAlias(alias)
        if (!existingAccount) {
          throw new Error(`Account with alias "${alias}" not found. Run 'hl account ls' to see available accounts.`)
        }

        // Confirm deletion unless --force is used
        if (!options.force) {
          const confirmed = await confirm(
            `Are you sure you want to remove account "${alias}" (${existingAccount.userAddress})?`,
            false
          )

          if (!confirmed) {
            console.log("Cancelled.")
            return
          }
        }

        const deleted = deleteAccount(alias)

        if (deleted) {
          if (outputOpts.json) {
            output({ message: `Account "${alias}" removed`, deleted: true }, outputOpts)
          } else {
            outputSuccess(`Account "${alias}" removed.`)
          }
        } else {
          throw new Error(`Failed to remove account "${alias}"`)
        }
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
