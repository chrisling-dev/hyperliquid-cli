import React, { useState, useEffect } from "react"
import { Box, Text, render } from "ink"
import { Command } from "commander"
import { getContext, getOutputOptions } from "../../cli/program.js"
import { output, outputError } from "../../cli/output.js"
import { validateAddress } from "../../lib/validation.js"
import { hideCursor, showCursor } from "../../cli/watch.js"
import { createPortfolioWatcher } from "../../lib/portfolio-watcher.js"
import { Table, PnL, WatchHeader, WatchFooter, type Column } from "../../cli/ink/index.js"
import { colors } from "../../cli/ink/theme.js"
import type { Address } from "viem"

interface PositionRow {
  coin: string
  size: string
  entryPx: string
  positionValue: string
  unrealizedPnl: string
  leverage: string
}

interface BalanceRow {
  token: string
  total: string
  hold: string
}

interface PortfolioDisplayProps {
  positions: PositionRow[]
  spotBalances: BalanceRow[]
  accountValue: string
  totalMarginUsed: string
  lastUpdated: Date
  isWatch: boolean
}

function PortfolioDisplay({
  positions,
  spotBalances,
  accountValue,
  totalMarginUsed,
  lastUpdated,
  isWatch,
}: PortfolioDisplayProps): React.ReactElement {
  const positionColumns: Column<PositionRow>[] = [
    { key: "coin", header: "Coin" },
    { key: "size", header: "Size", align: "right" },
    { key: "entryPx", header: "Entry", align: "right" },
    { key: "positionValue", header: "Value", align: "right" },
    {
      key: "unrealizedPnl",
      header: "PnL",
      align: "right",
      render: (value) => <PnL value={value as string} />,
    },
    { key: "leverage", header: "Leverage", align: "right" },
  ]

  const balanceColumns: Column<BalanceRow>[] = [
    { key: "token", header: "Token" },
    { key: "total", header: "Total", align: "right" },
    { key: "hold", header: "Hold", align: "right" },
  ]

  return (
    <Box flexDirection="column">
      {isWatch && <WatchHeader title="Portfolio" lastUpdated={lastUpdated} />}

      <Box marginBottom={1} flexDirection="column">
        <Text bold color={colors.header}>Account Summary</Text>
        <Text>Account Value: <Text bold>{accountValue}</Text></Text>
        <Text>Total Margin Used: <Text bold>{totalMarginUsed}</Text></Text>
      </Box>

      <Text bold color={colors.header}>Perpetual Positions:</Text>
      {positions.length === 0 ? (
        <Box marginBottom={1}>
          <Text color={colors.muted}>No open positions</Text>
        </Box>
      ) : (
        <Box marginBottom={1}>
          <Table data={positions} columns={positionColumns} />
        </Box>
      )}

      <Text bold color={colors.header}>Spot Balances:</Text>
      {spotBalances.length === 0 ? (
        <Text color={colors.muted}>No spot balances</Text>
      ) : (
        <Table data={spotBalances} columns={balanceColumns} />
      )}

      {isWatch && <WatchFooter />}
    </Box>
  )
}

interface WatchPortfolioProps {
  user: Address
  isTestnet: boolean
  isJson: boolean
}

function WatchPortfolio({ user, isTestnet, isJson }: WatchPortfolioProps): React.ReactElement {
  const [positions, setPositions] = useState<PositionRow[]>([])
  const [spotBalances, setSpotBalances] = useState<BalanceRow[]>([])
  const [accountValue, setAccountValue] = useState<string>("0")
  const [totalMarginUsed, setTotalMarginUsed] = useState<string>("0")
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const watcher = createPortfolioWatcher({
      user,
      isTestnet,
      onUpdate: (data) => {
        if (isJson) {
          console.log(JSON.stringify({ ...data, timestamp: new Date().toISOString() }))
          return
        }

        setPositions(data.positions)
        setSpotBalances(data.spotBalances)
        setAccountValue(data.accountValue)
        setTotalMarginUsed(data.totalMarginUsed)
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
    <PortfolioDisplay
      positions={positions}
      spotBalances={spotBalances}
      accountValue={accountValue}
      totalMarginUsed={totalMarginUsed}
      lastUpdated={lastUpdated}
      isWatch={true}
    />
  )
}

export function registerPortfolioCommand(account: Command): void {
  account
    .command("portfolio")
    .description("Get full portfolio (positions + spot balances)")
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
            <WatchPortfolio user={user} isTestnet={ctx.config.testnet} isJson={outputOpts.json} />
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

        type Position = {
          coin: string
          szi: string
          entryPx: string
          positionValue: string
          unrealizedPnl: string
          leverage: { type: string; value: number }
        }

        const positions = clearinghouseState.assetPositions
          .map((p: { position: Position }) => p.position)
          .filter((p: Position) => parseFloat(p.szi) !== 0)
          .map((p: Position) => ({
            coin: p.coin,
            size: p.szi,
            entryPx: p.entryPx,
            positionValue: p.positionValue,
            unrealizedPnl: p.unrealizedPnl,
            leverage: `${p.leverage.value}x ${p.leverage.type}`,
          }))

        const spotBalances = spotState.balances
          .filter((b: { total: string }) => parseFloat(b.total) !== 0)
          .map((b: { coin: string; total: string; hold: string }) => ({
            token: b.coin,
            total: b.total,
            hold: b.hold,
          }))

        const data = {
          positions,
          spotBalances,
          accountValue: clearinghouseState.marginSummary.accountValue,
          totalMarginUsed: clearinghouseState.marginSummary.totalMarginUsed,
        }

        if (outputOpts.json) {
          output(data, outputOpts)
        } else {
          const { unmount, waitUntilExit } = render(
            <PortfolioDisplay
              {...data}
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
