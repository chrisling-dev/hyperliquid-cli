import React, { useState, useEffect } from "react"
import { Box, Text, render } from "ink"
import { Command } from "commander"
import { getContext, getOutputOptions } from "../../cli/program.js"
import { output, outputError } from "../../cli/output.js"
import { hideCursor, showCursor } from "../../cli/watch.js"
import { validateAddress } from "../../lib/validation.js"
import { createOrdersWatcher, type OrderData } from "../../lib/orders-watcher.js"
import { Table, WatchHeader, WatchFooter, type Column } from "../../cli/ink/index.js"
import { colors } from "../../cli/ink/theme.js"
import type { Address } from "viem"

interface OrderRow {
  oid: number
  coin: string
  side: string
  sz: string
  limitPx: string
  timestamp: string
}

interface OrdersDisplayProps {
  orders: OrderRow[]
  isWatch?: boolean
  lastUpdated?: Date
}

function OrdersDisplay({ orders, isWatch, lastUpdated }: OrdersDisplayProps): React.ReactElement {
  const columns: Column<OrderRow>[] = [
    { key: "oid", header: "OID", align: "right" },
    { key: "coin", header: "Coin" },
    {
      key: "side",
      header: "Side",
      render: (value) => (
        <Text color={value === "B" ? colors.profit : colors.loss}>
          {value === "B" ? "Buy" : "Sell"}
        </Text>
      ),
    },
    { key: "sz", header: "Size", align: "right" },
    { key: "limitPx", header: "Price", align: "right" },
    { key: "timestamp", header: "Time" },
  ]

  return (
    <Box flexDirection="column">
      {isWatch && <WatchHeader title="Open Orders" lastUpdated={lastUpdated} />}
      {orders.length === 0 ? (
        <Text color={colors.muted}>No open orders</Text>
      ) : (
        <Table data={orders} columns={columns} />
      )}
      {isWatch && <WatchFooter />}
    </Box>
  )
}

interface WatchOrdersProps {
  user: Address
  isTestnet: boolean
  isJson: boolean
}

function WatchOrders({ user, isTestnet, isJson }: WatchOrdersProps): React.ReactElement {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const watcher = createOrdersWatcher({
      user,
      isTestnet,
      onUpdate: (data: OrderData[]) => {
        const formatted = data.map((o) => ({
          oid: o.oid,
          coin: o.coin,
          side: o.side,
          sz: o.sz,
          limitPx: o.limitPx,
          timestamp: new Date(o.timestamp).toLocaleString(),
        }))

        if (isJson) {
          console.log(JSON.stringify({ orders: formatted, timestamp: new Date().toISOString() }))
          return
        }
        setOrders(formatted)
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

  return <OrdersDisplay orders={orders} isWatch={true} lastUpdated={lastUpdated} />
}

export function registerOrdersCommand(account: Command): void {
  account
    .command("orders")
    .description("Get open orders")
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
            <WatchOrders user={user} isTestnet={ctx.config.testnet} isJson={outputOpts.json} />
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

        const client = ctx.getPublicClient()
        const orders = await client.openOrders({ user })

        type Order = {
          oid: number
          coin: string
          side: string
          sz: string
          limitPx: string
          timestamp: number
        }

        const formatted = orders.map((o: Order) => ({
          oid: o.oid,
          coin: o.coin,
          side: o.side,
          sz: o.sz,
          limitPx: o.limitPx,
          timestamp: new Date(o.timestamp).toLocaleString(),
        }))

        if (outputOpts.json) {
          output(formatted, outputOpts)
        } else {
          const { unmount, waitUntilExit } = render(<OrdersDisplay orders={formatted} />)
          await waitUntilExit()
          unmount()
        }
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
