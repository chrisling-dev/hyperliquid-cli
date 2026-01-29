import React, { useState, useEffect } from "react"
import { Box, Text, render } from "ink"
import { Command } from "commander"
import { getContext, getOutputOptions } from "../../cli/program.js"
import { output, outputError } from "../../cli/output.js"
import { validateAddress } from "../../lib/validation.js"
import { hideCursor, showCursor } from "../../cli/watch.js"
import { createPositionWatcher } from "../../lib/position-watcher.js"
import { Table, PnL, WatchHeader, WatchFooter, type Column } from "../../cli/ink/index.js"
import { colors } from "../../cli/ink/theme.js"
import type { Address } from "viem"
import type { AllDexsClearinghouseStateEvent } from "@nktkas/hyperliquid/api/subscription"

interface PositionRow {
  coin: string
  size: string
  entryPx: string
  positionValue: string
  unrealizedPnl: string
  leverage: string
  liquidationPx: string
}

interface PositionsDisplayProps {
  positions: PositionRow[]
  accountValue: string
  totalMarginUsed: string
  lastUpdated: Date
  isWatch: boolean
}

function PositionsDisplay({
  positions,
  accountValue,
  totalMarginUsed,
  lastUpdated,
  isWatch,
}: PositionsDisplayProps): React.ReactElement {
  const columns: Column<PositionRow>[] = [
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
    { key: "liquidationPx", header: "Liq. Price", align: "right" },
  ]

  return (
    <Box flexDirection="column">
      {isWatch && <WatchHeader title="Positions" lastUpdated={lastUpdated} />}

      {positions.length === 0 ? (
        <Text color={colors.muted}>No open positions</Text>
      ) : (
        <Table data={positions} columns={columns} />
      )}

      <Box marginTop={1} flexDirection="column">
        <Text>Account Value: <Text bold>{accountValue}</Text></Text>
        <Text>Total Margin Used: <Text bold>{totalMarginUsed}</Text></Text>
      </Box>

      {isWatch && <WatchFooter />}
    </Box>
  )
}

interface WatchPositionsProps {
  user: Address
  isTestnet: boolean
  isJson: boolean
}

function WatchPositions({ user, isTestnet, isJson }: WatchPositionsProps): React.ReactElement {
  const [positions, setPositions] = useState<PositionRow[]>([])
  const [accountValue, setAccountValue] = useState<string>("0")
  const [totalMarginUsed, setTotalMarginUsed] = useState<string>("0")
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const watcher = createPositionWatcher({
      user,
      isTestnet,
      onUpdate: (state) => {
        if (isJson) {
          const formatted = formatPositionsFromState(state)
          console.log(JSON.stringify({ ...formatted, timestamp: new Date().toISOString() }))
          return
        }

        const formatted = formatPositionsFromState(state)
        setPositions(formatted.positions)
        setAccountValue(formatted.accountValue)
        setTotalMarginUsed(formatted.totalMarginUsed)
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
    <PositionsDisplay
      positions={positions}
      accountValue={accountValue}
      totalMarginUsed={totalMarginUsed}
      lastUpdated={lastUpdated}
      isWatch={true}
    />
  )
}

function formatPositionsFromState(state: AllDexsClearinghouseStateEvent): {
  positions: PositionRow[]
  accountValue: string
  totalMarginUsed: string
} {
  const clearinghouseState = state.clearinghouseStates[0]?.[1]

  const positions = state.clearinghouseStates
    .flatMap((c) => c[1].assetPositions)
    .filter((p) => parseFloat(p.position.szi) !== 0)
    .map((p) => ({
      coin: p.position.coin,
      size: p.position.szi,
      entryPx: p.position.entryPx,
      positionValue: p.position.positionValue,
      unrealizedPnl: p.position.unrealizedPnl,
      leverage: `${p.position.leverage.value}x ${p.position.leverage.type}`,
      liquidationPx: p.position.liquidationPx || "-",
    }))

  return {
    positions,
    accountValue: clearinghouseState?.marginSummary?.accountValue || "0",
    totalMarginUsed: clearinghouseState?.marginSummary?.totalMarginUsed || "0",
  }
}

export function registerPositionsCommand(account: Command): void {
  account
    .command("positions")
    .description("Get account positions")
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
            <WatchPositions user={user} isTestnet={ctx.config.testnet} isJson={outputOpts.json} />
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
        const state = await client.clearinghouseState({ user })

        type Position = {
          coin: string
          szi: string
          entryPx: string
          positionValue: string
          unrealizedPnl: string
          leverage: { type: string; value: number }
          liquidationPx: string | null
        }

        const positions = state.assetPositions
          .map((p: { position: Position }) => p.position)
          .filter((p: Position) => parseFloat(p.szi) !== 0)
          .map((p: Position) => ({
            coin: p.coin,
            size: p.szi,
            entryPx: p.entryPx,
            positionValue: p.positionValue,
            unrealizedPnl: p.unrealizedPnl,
            leverage: `${p.leverage.value}x ${p.leverage.type}`,
            liquidationPx: p.liquidationPx || "-",
          }))

        if (outputOpts.json) {
          output(
            {
              positions,
              marginSummary: state.marginSummary,
              crossMarginSummary: state.crossMarginSummary,
            },
            outputOpts
          )
        } else {
          const { unmount, waitUntilExit } = render(
            <PositionsDisplay
              positions={positions}
              accountValue={state.marginSummary.accountValue}
              totalMarginUsed={state.marginSummary.totalMarginUsed}
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
