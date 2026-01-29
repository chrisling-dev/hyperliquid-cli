import {
  WebSocketTransport,
  SubscriptionClient,
  InfoClient,
  HttpTransport,
} from "@nktkas/hyperliquid"
import WebSocket from "ws"
import type { ServerCache, AllMidsData, AllDexsAssetCtxsData, AllPerpMetasData } from "./cache.js"

// Interface for subscription handle returned by SDK
interface Subscription {
  unsubscribe(): Promise<void>
}

export class SubscriptionManager {
  private wsTransport: WebSocketTransport
  private subscriptionClient: SubscriptionClient
  private httpClient: InfoClient
  private cache: ServerCache
  private subscriptions: Subscription[] = []
  private perpMetaInterval: ReturnType<typeof setInterval> | null = null
  private isTestnet: boolean
  private log: (msg: string) => void

  constructor(cache: ServerCache, isTestnet: boolean, log: (msg: string) => void) {
    this.cache = cache
    this.isTestnet = isTestnet
    this.log = log

    // Create WebSocket transport for subscriptions
    // Need to provide WebSocket constructor for Node.js environment
    this.wsTransport = new WebSocketTransport({
      isTestnet,
      reconnect: { WebSocket: WebSocket as unknown as typeof globalThis.WebSocket },
    })
    this.subscriptionClient = new SubscriptionClient({ transport: this.wsTransport })

    // Create HTTP transport for polling perpMeta
    const httpTransport = new HttpTransport({ isTestnet })
    this.httpClient = new InfoClient({ transport: httpTransport })
  }

  async start(): Promise<void> {
    this.log("Waiting for WebSocket connection...")
    await this.wsTransport.ready()
    this.log("WebSocket connected")

    // Subscribe to allMids
    this.log("Subscribing to allMids...")
    const midsSub = await this.subscriptionClient.allMids({ dex: "ALL_DEXS" }, (event) => {
      this.cache.setAllMids(event.mids as AllMidsData)
    })
    this.subscriptions.push(midsSub)
    this.log("Subscribed to allMids")

    // Subscribe to allDexsAssetCtxs
    this.log("Subscribing to allDexsAssetCtxs...")
    const ctxsSub = await this.subscriptionClient.allDexsAssetCtxs((event) => {
      this.cache.setAllDexsAssetCtxs(event as unknown as AllDexsAssetCtxsData)
    })
    this.subscriptions.push(ctxsSub)
    this.log("Subscribed to allDexsAssetCtxs")

    // Poll allPerpMetas every 60 seconds (it doesn't change often)
    await this.fetchPerpMetas()
    this.perpMetaInterval = setInterval(() => {
      this.fetchPerpMetas().catch((err) => {
        this.log(`Error fetching perpMetas: ${err}`)
      })
    }, 60_000)
    this.log("Started perpMetas polling (60s interval)")
  }

  private async fetchPerpMetas(): Promise<void> {
    const meta = await this.httpClient.meta()
    this.cache.setAllPerpMetas(meta as AllPerpMetasData)
    this.log("Updated perpMetas cache")
  }

  async stop(): Promise<void> {
    // Stop perpMeta polling
    if (this.perpMetaInterval) {
      clearInterval(this.perpMetaInterval)
      this.perpMetaInterval = null
    }

    // Unsubscribe from all WebSocket subscriptions
    for (const sub of this.subscriptions) {
      try {
        await sub.unsubscribe()
      } catch {
        // Ignore errors during unsubscribe
      }
    }
    this.subscriptions = []

    // Close WebSocket transport
    try {
      await this.wsTransport.close()
    } catch {
      // Ignore errors during close
    }

    this.log("Subscriptions stopped")
  }

  isConnected(): boolean {
    // ReconnectingWebSocket.OPEN = 1
    return this.wsTransport.socket.readyState === 1
  }
}
