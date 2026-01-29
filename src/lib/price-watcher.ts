import { tryConnectToServer, type ServerClient } from "../client/index.js"
import { WebSocketTransport, SubscriptionClient } from "@nktkas/hyperliquid"
import WebSocket from "ws"

export interface PriceWatcher {
  start(): Promise<void>
  stop(): Promise<void>
}

export interface PriceWatcherConfig {
  coin: string
  isTestnet: boolean
  onUpdate: (price: string) => void
  onError: (error: Error) => void
}

interface Subscription {
  unsubscribe(): Promise<void>
}

/**
 * Creates a price watcher that uses server cache polling if available,
 * otherwise falls back to direct WebSocket subscription
 */
export function createPriceWatcher(config: PriceWatcherConfig): PriceWatcher {
  let serverClient: ServerClient | null = null
  let pollInterval: ReturnType<typeof setInterval> | null = null
  let wsTransport: WebSocketTransport | null = null
  let subscription: Subscription | null = null
  let stopped = false

  const pollServerPrice = async () => {
    if (stopped || !serverClient) return

    try {
      const { data } = await serverClient.getPrices()
      const price = data[config.coin]
      if (price !== undefined) {
        config.onUpdate(price)
      }
    } catch (err) {
      config.onError(err instanceof Error ? err : new Error(String(err)))
    }
  }

  return {
    async start(): Promise<void> {
      stopped = false

      // Try to use server cache first
      serverClient = await tryConnectToServer()

      if (serverClient) {
        // Poll server every 500ms for price updates
        await pollServerPrice()
        pollInterval = setInterval(pollServerPrice, 500)
      } else {
        // No server, use direct WebSocket subscription
        wsTransport = new WebSocketTransport({
          isTestnet: config.isTestnet,
          reconnect: { WebSocket: WebSocket as unknown as typeof globalThis.WebSocket },
        })
        const subscriptionClient = new SubscriptionClient({ transport: wsTransport })

        await wsTransport.ready()

        subscription = await subscriptionClient.allMids({ dex: "ALL_DEXS" }, (event) => {
          const price = event.mids[config.coin]
          if (price !== undefined) {
            config.onUpdate(price)
          }
        })
      }
    },

    async stop(): Promise<void> {
      stopped = true

      if (pollInterval) {
        clearInterval(pollInterval)
        pollInterval = null
      }

      if (serverClient) {
        serverClient.close()
        serverClient = null
      }

      if (subscription) {
        try {
          await subscription.unsubscribe()
        } catch {
          // Ignore errors during unsubscribe
        }
        subscription = null
      }

      if (wsTransport) {
        try {
          await wsTransport.close()
        } catch {
          // Ignore errors during close
        }
        wsTransport = null
      }
    },
  }
}
