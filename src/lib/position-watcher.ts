import { WebSocketTransport, SubscriptionClient } from "@nktkas/hyperliquid"
import WebSocket from "ws"
import type { Address } from "viem"
import { AllDexsClearinghouseStateEvent } from "@nktkas/hyperliquid/api/subscription"

export interface PositionWatcher {
  start(): Promise<void>
  stop(): Promise<void>
}

export interface PositionWatcherConfig {
  user: Address
  isTestnet: boolean
  onUpdate: (state: AllDexsClearinghouseStateEvent) => void
  onError: (error: Error) => void
}

interface Subscription {
  unsubscribe(): Promise<void>
}

/**
 * Creates a position watcher that subscribes to clearinghouseState updates via WebSocket
 */
export function createPositionWatcher(config: PositionWatcherConfig): PositionWatcher {
  let wsTransport: WebSocketTransport | null = null
  let subscriptionClient: SubscriptionClient | null = null
  let subscription: Subscription | null = null

  return {
    async start(): Promise<void> {
      wsTransport = new WebSocketTransport({
        isTestnet: config.isTestnet,
        reconnect: { WebSocket: WebSocket as unknown as typeof globalThis.WebSocket },
      })
      subscriptionClient = new SubscriptionClient({ transport: wsTransport })

      await wsTransport.ready()

      subscription = await subscriptionClient.allDexsClearinghouseState(
        { user: config.user },
        (state) => {
          config.onUpdate(state)
        },
      )
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
    },
  }
}
