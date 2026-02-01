import {
  WebSocketTransport,
  SubscriptionClient,
  InfoClient,
  HttpTransport,
} from "@nktkas/hyperliquid"
import WebSocket from "ws"
import type { ServerCache, AllMidsData } from "./cache.js"

// Interface for subscription handle returned by SDK
interface Subscription {
  unsubscribe(): Promise<void>
}

export class SubscriptionManager {
  private wsTransport: WebSocketTransport
  private subscriptionClient: SubscriptionClient
  private infoClient: InfoClient
  private cache: ServerCache
  private subscriptions: Subscription[] = []
  private perpMetaInterval: ReturnType<typeof setInterval> | null = null
  private spotMetaInterval: ReturnType<typeof setInterval> | null = null
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
    this.infoClient = new InfoClient({ transport: httpTransport })
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
      this.cache.setAllDexsAssetCtxs(event)
    })
    this.subscriptions.push(ctxsSub)
    this.log("Subscribed to allDexsAssetCtxs")

    // Subscribe to spotAssetCtxs
    this.log("Subscribing to spotAssetCtxs...")
    const spotCtxsSub = await this.subscriptionClient.spotAssetCtxs((event) => {
      this.cache.setSpotAssetCtxs(event)
    })
    this.subscriptions.push(spotCtxsSub)
    this.log("Subscribed to spotAssetCtxs")

    // Poll allPerpMetas every 60 seconds (it doesn't change often)
    await this.fetchPerpMetas()
    this.perpMetaInterval = setInterval(() => {
      this.fetchPerpMetas().catch((err) => {
        this.log(`Error fetching perpMetas: ${err}`)
      })
    }, 60_000)
    this.log("Started perpMetas polling (60s interval)")

    // Poll spotMeta every 60 seconds (it doesn't change often)
    await this.fetchSpotMeta()
    this.spotMetaInterval = setInterval(() => {
      this.fetchSpotMeta().catch((err) => {
        this.log(`Error fetching spotMeta: ${err}`)
      })
    }, 60_000)
    this.log("Started spotMeta polling (60s interval)")
  }

  private async fetchPerpMetas(): Promise<void> {
    const meta = await this.infoClient.allPerpMetas()
    this.cache.setAllPerpMetas(meta)
    this.log("Updated perpMetas cache")
  }

  private async fetchSpotMeta(): Promise<void> {
    const meta = await this.infoClient.spotMeta()
    this.cache.setSpotMeta(meta)
    this.log("Updated spotMeta cache")
  }

  async stop(): Promise<void> {
    // Stop perpMeta polling
    if (this.perpMetaInterval) {
      clearInterval(this.perpMetaInterval)
      this.perpMetaInterval = null
    }

    // Stop spotMeta polling
    if (this.spotMetaInterval) {
      clearInterval(this.spotMetaInterval)
      this.spotMetaInterval = null
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
