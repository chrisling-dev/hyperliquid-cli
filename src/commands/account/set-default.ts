import { Command } from "commander"
import { getOutputOptions } from "../../cli/program.js"
import { output, outputError, outputSuccess } from "../../cli/output.js"
import { setDefaultAccount, getAccountByAlias } from "../../lib/db/index.js"

export function registerSetDefaultCommand(account: Command): void {
  account
    .command("set-default")
    .description("Set an account as the default")
    .argument("<alias>", "Account alias to set as default")
    .action(async function (this: Command, alias: string) {
      const outputOpts = getOutputOptions(this)

      try {
        // Check if account exists
        const existingAccount = getAccountByAlias(alias)
        if (!existingAccount) {
          throw new Error(`Account with alias "${alias}" not found. Run 'hl account ls' to see available accounts.`)
        }

        if (existingAccount.isDefault) {
          if (outputOpts.json) {
            output({ message: `Account "${alias}" is already the default` }, outputOpts)
          } else {
            console.log(`Account "${alias}" is already the default.`)
          }
          return
        }

        const updatedAccount = setDefaultAccount(alias)

        if (outputOpts.json) {
          output(
            {
              id: updatedAccount.id,
              alias: updatedAccount.alias,
              userAddress: updatedAccount.userAddress,
              type: updatedAccount.type,
              isDefault: updatedAccount.isDefault,
            },
            outputOpts
          )
        } else {
          outputSuccess(`Account "${alias}" is now the default.`)
        }
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
