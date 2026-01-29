import { WebSocketTransport, SubscriptionClient, HttpTransport, InfoClient } from "@nktkas/hyperliquid"
import WebSocket from "ws"
import type { Address } from "viem"

export interface BalanceData {
  spotBalances: Array<{
    token: string
    total: string
    hold: string
    available: string
  }>
  perpBalance: string
}

export interface BalanceWatcher {
  start(): Promise<void>
  stop(): Promise<void>
}

export interface BalanceWatcherConfig {
  user: Address
  isTestnet: boolean
  onUpdate: (data: BalanceData) => void
  onError: (error: Error) => void
}

interface Subscription {
  unsubscribe(): Promise<void>
}

/**
 * Creates a balance watcher that subscribes to clearinghouse state updates
 * and polls spot balances on each update
 */
export function createBalanceWatcher(config: BalanceWatcherConfig): BalanceWatcher {
  let wsTransport: WebSocketTransport | null = null
  let subscriptionClient: SubscriptionClient | null = null
  let perpSubscription: Subscription | null = null
  let httpClient: InfoClient | null = null

  return {
    async start(): Promise<void> {
      // Create HTTP client for spot balance polling
      const httpTransport = new HttpTransport({ isTestnet: config.isTestnet })
      httpClient = new InfoClient({ transport: httpTransport })

      // Fetch initial spot state
      const spotState = await httpClient.spotClearinghouseState({ user: config.user })
      let currentSpotBalances = spotState.balances
        .filter((b: { total: string }) => parseFloat(b.total) !== 0)
        .map((b: { coin: string; total: string; hold: string }) => ({
          token: b.coin,
          total: b.total,
          hold: b.hold,
          available: (parseFloat(b.total) - parseFloat(b.hold)).toString(),
        }))

      wsTransport = new WebSocketTransport({
        isTestnet: config.isTestnet,
        reconnect: { WebSocket: WebSocket as unknown as typeof globalThis.WebSocket },
      })
      subscriptionClient = new SubscriptionClient({ transport: wsTransport })

      await wsTransport.ready()

      // Subscribe to perp clearinghouse state
      perpSubscription = await subscriptionClient.allDexsClearinghouseState(
        { user: config.user },
        async (state) => {
          const clearinghouseState = state.clearinghouseStates[0]?.[1]
          const perpBalance = clearinghouseState?.marginSummary.accountValue || "0"

          // Refresh spot balances on each perp update
          if (httpClient) {
            try {
              const freshSpotState = await httpClient.spotClearinghouseState({ user: config.user })
              currentSpotBalances = freshSpotState.balances
                .filter((b: { total: string }) => parseFloat(b.total) !== 0)
                .map((b: { coin: string; total: string; hold: string }) => ({
                  token: b.coin,
                  total: b.total,
                  hold: b.hold,
                  available: (parseFloat(b.total) - parseFloat(b.hold)).toString(),
                }))
            } catch {
              // Keep previous spot balances on error
            }
          }

          config.onUpdate({
            spotBalances: currentSpotBalances,
            perpBalance,
          })
        }
      )
    },

    async stop(): Promise<void> {
      if (perpSubscription) {
        try {
          await perpSubscription.unsubscribe()
        } catch {
          // Ignore errors during unsubscribe
        }
        perpSubscription = null
      }

      if (wsTransport) {
        try {
          await wsTransport.close()
        } catch {
          // Ignore errors during close
        }
        wsTransport = null
      }

      subscriptionClient = null
      httpClient = null
    },
  }
}
