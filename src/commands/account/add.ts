import { Command } from "commander"
import { getContext, getOutputOptions } from "../../cli/program.js"
import { output, outputError, outputSuccess } from "../../cli/output.js"
import { validateAddress } from "../../lib/validation.js"
import { prompt, select, confirm, waitForEnter } from "../../lib/prompts.js"
import {
  createAccount,
  getAccountCount,
  isAliasTaken,
  type AccountType,
} from "../../lib/db/index.js"
import {
  generateApiWallet,
  getApprovalUrl,
  checkApiWalletApproval,
} from "../../lib/api-wallet.js"
import type { Address, Hex } from "viem"

type SetupMethod = "existing" | "new"

export function registerAddCommand(account: Command): void {
  account
    .command("add")
    .description("Add a new account (interactive wizard)")
    .action(async function (this: Command) {
      const ctx = getContext(this)
      const outputOpts = getOutputOptions(this)
      const isTestnet = ctx.config.testnet

      try {
        console.log("\n=== Add New Account ===\n")

        // Step 1: Choose setup method
        const setupMethod = await select<SetupMethod>(
          "How would you like to set up your account?",
          [
            { value: "existing", label: "Use existing wallet (create API key)" },
            { value: "new", label: "Create new wallet (Coming Soon)" },
          ]
        )

        if (setupMethod === "new") {
          console.log("\nCreating new wallets with encrypted keystores is coming soon!")
          console.log("For now, please use an existing wallet.\n")
          return
        }

        // Step 2: Get user wallet address
        console.log("")
        const userAddressInput = await prompt("Enter your wallet address: ")
        const userAddress = validateAddress(userAddressInput)

        // Step 3: Get alias for this account
        let alias: string
        while (true) {
          alias = await prompt("Enter an alias for this account (e.g., 'main', 'trading'): ")
          if (!alias) {
            console.log("Alias cannot be empty.")
            continue
          }
          if (isAliasTaken(alias)) {
            console.log(`Alias "${alias}" is already taken. Please choose another.`)
            continue
          }
          break
        }

        // Step 4: Choose account type
        const accountType = await select<AccountType>(
          "\nWhat type of account is this?",
          [
            { value: "api_wallet", label: "API Wallet (can trade)" },
            { value: "readonly", label: "Read-only (view only)" },
          ]
        )

        let apiWalletPrivateKey: Hex | undefined
        let apiWalletPublicKey: Address | undefined

        if (accountType === "api_wallet") {
          // Step 5: Generate API wallet
          console.log("\nGenerating new API wallet...")
          const apiWallet = generateApiWallet()
          apiWalletPrivateKey = apiWallet.privateKey
          apiWalletPublicKey = apiWallet.publicKey

          console.log("\n----------------------------------------")
          console.log("API Wallet Address:", apiWallet.publicKey)
          console.log("----------------------------------------\n")

          // Step 6: Guide user to approve
          const approvalUrl = getApprovalUrl(isTestnet)
          console.log("Next steps:")
          console.log(`1. Go to: ${approvalUrl}`)
          console.log(`2. Connect your wallet: ${userAddress}`)
          console.log(`3. Add the API wallet address shown above`)
          console.log(`4. Approve the transaction`)
          console.log("")

          await waitForEnter("After approving, press Enter to continue...")

          // Step 7: Check approval status
          console.log("\nChecking API wallet approval status...")

          const result = await checkApiWalletApproval(
            apiWalletPublicKey,
            userAddress,
            isTestnet
          )

          if (!result.approved) {
            console.log("\nAPI wallet is not yet approved.")
            const retry = await confirm("Would you like to retry checking?", true)

            if (retry) {
              // Give them some more time and check again
              console.log("Waiting a few seconds before checking again...")
              await new Promise((resolve) => setTimeout(resolve, 5000))

              const retryResult = await checkApiWalletApproval(
                apiWalletPublicKey,
                userAddress,
                isTestnet
              )

              if (!retryResult.approved) {
                console.log("\nStill not approved. You can:")
                console.log("1. Complete the approval process on the website")
                console.log("2. Run 'hl account add' again when ready")
                console.log("")
                console.log("Saving account as read-only for now...")
                // Save as readonly, user can re-run add later
                const savedAccount = createAccount({
                  alias,
                  userAddress,
                  type: "readonly",
                  source: "cli_import",
                })

                if (outputOpts.json) {
                  output(savedAccount, outputOpts)
                } else {
                  outputSuccess(`\nAccount "${alias}" saved as read-only. Re-run 'hl account add' to set up API wallet.`)
                }
                return
              }
            } else {
              // Save as readonly
              const savedAccount = createAccount({
                alias,
                userAddress,
                type: "readonly",
                source: "cli_import",
              })

              if (outputOpts.json) {
                output(savedAccount, outputOpts)
              } else {
                outputSuccess(`\nAccount "${alias}" saved as read-only.`)
              }
              return
            }
          }

          console.log("\nAPI wallet approved successfully!")
        }

        // Step 8: Check if user wants to set as default (if multiple accounts)
        let setAsDefault = false
        const existingCount = getAccountCount()

        if (existingCount > 0) {
          setAsDefault = await confirm("\nSet this as your default account?", true)
        }

        // Step 9: Save account
        const newAccount = createAccount({
          alias,
          userAddress,
          type: accountType,
          source: "cli_import",
          apiWalletPrivateKey,
          apiWalletPublicKey,
          setAsDefault,
        })

        if (outputOpts.json) {
          output(
            {
              ...newAccount,
              // Don't expose private key in JSON output
              apiWalletPrivateKey: newAccount.apiWalletPrivateKey
                ? "[REDACTED]"
                : null,
            },
            outputOpts
          )
        } else {
          console.log("")
          outputSuccess(`Account "${alias}" added successfully!`)
          console.log("")
          console.log("Account details:")
          console.log(`  Alias: ${newAccount.alias}`)
          console.log(`  Address: ${newAccount.userAddress}`)
          console.log(`  Type: ${newAccount.type}`)
          if (newAccount.apiWalletPublicKey) {
            console.log(`  API Wallet: ${newAccount.apiWalletPublicKey}`)
          }
          console.log(`  Default: ${newAccount.isDefault ? "Yes" : "No"}`)
          console.log("")
        }
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
