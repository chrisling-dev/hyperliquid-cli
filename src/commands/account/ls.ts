import type { Command } from "commander"
import { getAllAccounts } from "../../lib/db/index.js"
export function registerLsCommand(parent: Command): void {
  parent
    .command("ls")
    .description("List saved accounts without exposing private keys")
    .action(function (this: Command) {
      const accounts = getAllAccounts().map(
        ({ apiWalletPrivateKey: _secret, ...account }) => account,
      )
      if (this.optsWithGlobals().json)
        console.log(JSON.stringify(accounts, null, 2))
      else if (!accounts.length) console.log("No accounts. Run hl account add.")
      else
        console.table(
          accounts.map((a) => ({
            alias: a.alias,
            address: a.userAddress,
            type: a.type,
            default: a.isDefault,
          })),
        )
    })
}
