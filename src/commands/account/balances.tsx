import React, { useState, useEffect } from "react"
import { Box, Text, render } from "ink"
import { Command } from "commander"
import { getContext, getOutputOptions } from "../../cli/program.js"
import { output, outputError } from "../../cli/output.js"
import { validateAddress } from "../../lib/validation.js"
import { hideCursor, showCursor } from "../../cli/watch.js"
import { createBalanceWatcher } from "../../lib/balance-watcher.js"
import { Table, WatchHeader, WatchFooter, type Column } from "../../cli/ink/index.js"
import { colors } from "../../cli/ink/theme.js"
import type { Address } from "viem"

interface BalanceRow {
  token: string
  total: string
  hold: string
  available: string
}

interface BalancesDisplayProps {
  spotBalances: BalanceRow[]
  perpBalance: string
  lastUpdated: Date
  isWatch: boolean
}

function BalancesDisplay({
  spotBalances,
  perpBalance,
  lastUpdated,
  isWatch,
}: BalancesDisplayProps): React.ReactElement {
  const columns: Column<BalanceRow>[] = [
    { key: "token", header: "Token" },
    { key: "total", header: "Total", align: "right" },
    { key: "hold", header: "Hold", align: "right" },
    { key: "available", header: "Available", align: "right" },
  ]

  return (
    <Box flexDirection="column">
      {isWatch && <WatchHeader title="Balances" lastUpdated={lastUpdated} />}

      <Box marginBottom={1}>
        <Text bold>Perpetuals Balance: </Text>
        <Text>{perpBalance} USD</Text>
      </Box>

      <Text bold color={colors.header}>Spot Balances:</Text>
      {spotBalances.length === 0 ? (
        <Text color={colors.muted}>No spot balances</Text>
      ) : (
        <Table data={spotBalances} columns={columns} />
      )}

      {isWatch && <WatchFooter />}
    </Box>
  )
}

interface WatchBalancesProps {
  user: Address
  isTestnet: boolean
  isJson: boolean
}

function WatchBalances({ user, isTestnet, isJson }: WatchBalancesProps): React.ReactElement {
  const [spotBalances, setSpotBalances] = useState<BalanceRow[]>([])
  const [perpBalance, setPerpBalance] = useState<string>("0")
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const watcher = createBalanceWatcher({
      user,
      isTestnet,
      onUpdate: (data) => {
        if (isJson) {
          console.log(JSON.stringify({ ...data, timestamp: new Date().toISOString() }))
          return
        }

        setSpotBalances(data.spotBalances)
        setPerpBalance(data.perpBalance)
        setLastUpdated(new Date())
        setError(null)
      },
      onError: (err) => {
        setError(err.message)
      },
    })

    watcher.start()

    return () => {
      watcher.stop()
    }
  }, [user, isTestnet, isJson])

  if (error) {
    return (
      <Box flexDirection="column">
        <Text color={colors.loss}>Error: {error}</Text>
        <Text color={colors.muted}>Reconnecting...</Text>
      </Box>
    )
  }

  if (isJson) {
    return <Text color={colors.muted}>Streaming JSON...</Text>
  }

  return (
    <BalancesDisplay
      spotBalances={spotBalances}
      perpBalance={perpBalance}
      lastUpdated={lastUpdated}
      isWatch={true}
    />
  )
}

export function registerBalancesCommand(account: Command): void {
  account
    .command("balances")
    .description("Get spot and perps USD balances")
    .option("--user <address>", "User address (defaults to configured wallet)")
    .option("-w, --watch", "Watch mode - stream real-time updates")
    .action(async function (this: Command, options: { user?: string; watch?: boolean }) {
      const ctx = getContext(this)
      const outputOpts = getOutputOptions(this)

      try {
        let user: Address
        if (options.user) {
          user = validateAddress(options.user)
        } else {
          user = ctx.getWalletAddress()
        }

        if (options.watch) {
          if (!outputOpts.json) {
            hideCursor()
          }

          const { unmount, waitUntilExit } = render(
            <WatchBalances user={user} isTestnet={ctx.config.testnet} isJson={outputOpts.json} />
          )

          const cleanup = () => {
            if (!outputOpts.json) {
              showCursor()
            }
            unmount()
          }

          process.on("SIGINT", () => {
            cleanup()
            process.exit(0)
          })
          process.on("SIGTERM", () => {
            cleanup()
            process.exit(0)
          })

          await waitUntilExit()
          return
        }

        // Non-watch mode: fetch once
        const client = ctx.getPublicClient()

        const [clearinghouseState, spotState] = await Promise.all([
          client.clearinghouseState({ user }),
          client.spotClearinghouseState({ user }),
        ])

        const spotBalances = spotState.balances
          .filter((b: { total: string }) => parseFloat(b.total) !== 0)
          .map((b: { coin: string; total: string; hold: string }) => ({
            token: b.coin,
            total: b.total,
            hold: b.hold,
            available: (parseFloat(b.total) - parseFloat(b.hold)).toString(),
          }))

        const perpBalance = clearinghouseState.marginSummary.accountValue

        if (outputOpts.json) {
          output({ spotBalances, perpBalance }, outputOpts)
        } else {
          const { unmount, waitUntilExit } = render(
            <BalancesDisplay
              spotBalances={spotBalances}
              perpBalance={perpBalance}
              lastUpdated={new Date()}
              isWatch={false}
            />
          )
          await waitUntilExit()
          unmount()
        }
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
