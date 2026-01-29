import { WebSocketTransport, SubscriptionClient } from "@nktkas/hyperliquid"
import WebSocket from "ws"

export interface BookLevel {
  px: string
  sz: string
  n: number
}

export interface BookData {
  coin: string
  bids: BookLevel[]
  asks: BookLevel[]
  time: number
}

export interface BookWatcher {
  start(): Promise<void>
  stop(): Promise<void>
}

export interface BookWatcherConfig {
  coin: string
  isTestnet: boolean
  onUpdate: (data: BookData) => void
  onError: (error: Error) => void
}

interface Subscription {
  unsubscribe(): Promise<void>
}

/**
 * Creates a book watcher that subscribes to L2 order book updates via WebSocket
 */
export function createBookWatcher(config: BookWatcherConfig): BookWatcher {
  let wsTransport: WebSocketTransport | null = null
  let subscription: Subscription | null = null

  return {
    async start(): Promise<void> {
      wsTransport = new WebSocketTransport({
        isTestnet: config.isTestnet,
        reconnect: { WebSocket: WebSocket as unknown as typeof globalThis.WebSocket },
      })
      const subscriptionClient = new SubscriptionClient({ transport: wsTransport })

      await wsTransport.ready()

      subscription = await subscriptionClient.l2Book({ coin: config.coin }, (event) => {
        const levels = event.levels as [BookLevel[], BookLevel[]]
        config.onUpdate({
          coin: config.coin,
          bids: levels[0] || [],
          asks: levels[1] || [],
          time: event.time,
        })
      })
    },

    async stop(): Promise<void> {
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
