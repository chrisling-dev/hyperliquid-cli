import React from "react"
import { Box, Text, render } from "ink"
import { Command } from "commander"
import { getOutputOptions } from "../../cli/program.js"
import { output } from "../../cli/output.js"
import { getAllAccounts, type Account } from "../../lib/db/index.js"
import { Table, type Column } from "../../cli/ink/index.js"
import { colors } from "../../cli/ink/theme.js"

interface AccountRow {
  alias: string
  address: string
  type: string
  apiWallet: string
  default: string
}

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function AccountsList({ accounts }: { accounts: Account[] }): React.ReactElement {
  if (accounts.length === 0) {
    return (
      <Box flexDirection="column">
        <Text color={colors.muted}>No accounts found.</Text>
        <Text color={colors.muted}>Run 'hl account add' to add your first account.</Text>
      </Box>
    )
  }

  const rows: AccountRow[] = accounts.map((acc) => ({
    alias: acc.alias,
    address: formatAddress(acc.userAddress),
    type: acc.type,
    apiWallet: acc.apiWalletPublicKey
      ? formatAddress(acc.apiWalletPublicKey)
      : "-",
    default: acc.isDefault ? "*" : "",
  }))

  const columns: Column<AccountRow>[] = [
    { key: "default", header: "", width: 2 },
    { key: "alias", header: "Alias" },
    { key: "address", header: "Address" },
    { key: "type", header: "Type" },
    { key: "apiWallet", header: "API Wallet" },
  ]

  return (
    <Box flexDirection="column">
      <Table data={rows} columns={columns} />
      <Box marginTop={1}>
        <Text color={colors.muted}>* = default account</Text>
      </Box>
    </Box>
  )
}

export function registerLsCommand(account: Command): void {
  account
    .command("ls")
    .description("List all accounts")
    .action(async function (this: Command) {
      const outputOpts = getOutputOptions(this)

      const accounts = getAllAccounts()

      if (outputOpts.json) {
        // For JSON output, include full addresses but redact private keys
        const jsonAccounts = accounts.map((acc) => ({
          id: acc.id,
          alias: acc.alias,
          userAddress: acc.userAddress,
          type: acc.type,
          source: acc.source,
          apiWalletPublicKey: acc.apiWalletPublicKey,
          isDefault: acc.isDefault,
          createdAt: acc.createdAt,
          updatedAt: acc.updatedAt,
        }))
        output(jsonAccounts, outputOpts)
      } else {
        const { unmount, waitUntilExit } = render(
          <AccountsList accounts={accounts} />
        )
        await waitUntilExit()
        unmount()
      }
    })
}
