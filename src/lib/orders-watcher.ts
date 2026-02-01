import {
  WebSocketTransport,
  SubscriptionClient,
  HttpTransport,
  InfoClient,
} from "@nktkas/hyperliquid"
import WebSocket from "ws"
import type { Address } from "viem"

export interface OrderData {
  oid: number
  coin: string
  side: string
  sz: string
  limitPx: string
  timestamp: number
}

export interface OrdersWatcher {
  start(): Promise<void>
  stop(): Promise<void>
}

export interface OrdersWatcherConfig {
  user: Address
  isTestnet: boolean
  onUpdate: (orders: OrderData[]) => void
  onError: (error: Error) => void
}

interface Subscription {
  unsubscribe(): Promise<void>
}

/**
 * Creates an orders watcher that subscribes to orderUpdates
 * and polls open orders on each update
 */
export function createOrdersWatcher(config: OrdersWatcherConfig): OrdersWatcher {
  let wsTransport: WebSocketTransport | null = null
  let subscriptionClient: SubscriptionClient | null = null
  let subscription: Subscription | null = null
  let httpClient: InfoClient | null = null

  const fetchOrders = async (): Promise<OrderData[]> => {
    if (!httpClient) return []
    const orders = await httpClient.openOrders({ user: config.user, dex: "ALL_DEXS" })
    return orders.map((o: OrderData) => ({
      oid: o.oid,
      coin: o.coin,
      side: o.side,
      sz: o.sz,
      limitPx: o.limitPx,
      timestamp: o.timestamp,
    }))
  }

  return {
    async start(): Promise<void> {
      // Create HTTP client for polling open orders
      const httpTransport = new HttpTransport({ isTestnet: config.isTestnet })
      httpClient = new InfoClient({ transport: httpTransport })

      // Fetch initial orders
      const initialOrders = await fetchOrders()
      config.onUpdate(initialOrders)

      wsTransport = new WebSocketTransport({
        isTestnet: config.isTestnet,
        reconnect: { WebSocket: WebSocket as unknown as typeof globalThis.WebSocket },
      })
      subscriptionClient = new SubscriptionClient({ transport: wsTransport })

      await wsTransport.ready()

      // Subscribe to order updates
      subscription = await subscriptionClient.orderUpdates({ user: config.user }, async () => {
        // Re-fetch orders on any update
        try {
          const orders = await fetchOrders()
          config.onUpdate(orders)
        } catch (err) {
          config.onError(err instanceof Error ? err : new Error(String(err)))
        }
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

      subscriptionClient = null
      httpClient = null
    },
  }
}
