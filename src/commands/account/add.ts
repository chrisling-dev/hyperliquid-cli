import { Command } from "commander"
import { input, password, select } from "@inquirer/prompts"
import { privateKeyToAccount } from "viem/accounts"
import type { Hex } from "viem"
import {
  createAccount,
  isAliasTaken,
  type AccountType,
} from "../../lib/db/index.js"
import { validateAddress } from "../../lib/validation.js"
import { validateApiKey } from "../../lib/api-wallet.js"
export function registerAddCommand(parent: Command): void {
  parent
    .command("add")
    .description(
      "Import an address or signing key; prompts when run interactively",
    )
    .option("--alias <alias>", "Unique account name")
    .option("--type <type>", "readonly, api_wallet, or master")
    .option(
      "--user <address>",
      "Read-only address (agent owner is discovered from Hyperliquid)",
    )
    .option(
      "--key-env <name>",
      "Environment variable containing a private key; never pass the key on the command line",
    )
    .option("--default", "Make this the default account")
    .action(async function (this: Command) {
      const o = this.optsWithGlobals()
      const interactive = process.stdin.isTTY && !o.json
      const alias =
        o.alias ||
        (interactive ? await input({ message: "Account alias:" }) : undefined)
      if (!alias || isAliasTaken(alias))
        throw new Error("Supply a unique --alias")
      const type: AccountType =
        o.type ||
        (interactive
          ? await select({
              message: "Account type:",
              choices: [
                { value: "readonly", name: "Read-only address" },
                { value: "api_wallet", name: "Agent / API wallet" },
                { value: "master", name: "Master wallet" },
              ],
            })
          : "readonly")
      if (!["readonly", "api_wallet", "master"].includes(type))
        throw new Error("Invalid --type: use readonly, api_wallet, or master")
      let key: Hex | undefined
      let signer
      let user
      if (type === "readonly") {
        if (o.keyEnv)
          throw new Error("Read-only accounts cannot contain a signing key")
        user = validateAddress(
          o.user ||
            (interactive ? await input({ message: "User address:" }) : ""),
        )
      } else {
        const raw = o.keyEnv
          ? process.env[o.keyEnv]
          : interactive
            ? await password({ message: "Private key:", mask: "*" })
            : undefined
        if (!raw || !/^(0x)?[a-fA-F0-9]{64}$/.test(raw))
          throw new Error(
            "Supply a valid private key through --key-env or the hidden prompt",
          )
        key = (raw.startsWith("0x") ? raw : `0x${raw}`) as Hex
        signer = privateKeyToAccount(key).address
        if (type === "api_wallet") {
          const result = await validateApiKey(key, !!o.testnet)
          if (!result.valid) throw new Error(result.error)
          user = result.masterAddress
        } else {
          user = signer
        }
        if (
          o.user &&
          validateAddress(o.user).toLowerCase() !== user.toLowerCase()
        )
          throw new Error("--user does not match the key owner")
      }
      const account = createAccount({
        alias,
        userAddress: user,
        type,
        apiWalletPrivateKey: key,
        apiWalletPublicKey: signer,
        setAsDefault: !!o.default,
      })
      const { apiWalletPrivateKey: _secret, ...safe } = account
      console.log(JSON.stringify(safe, null, 2))
    })
}
