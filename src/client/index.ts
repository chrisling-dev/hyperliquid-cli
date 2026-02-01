import { connect, type Socket } from "node:net"
import { existsSync } from "node:fs"
import { SERVER_SOCKET_PATH } from "../lib/paths.js"
import { AllPerpMetasResponse, SpotMetaResponse } from "@nktkas/hyperliquid"
import { AllDexsAssetCtxsEvent, SpotAssetCtxsEvent } from "@nktkas/hyperliquid/api/subscription"

interface RPCResponse {
  id: string
  result?: unknown
  error?: string
  cached_at?: number
}

export interface ServerStatus {
  running: boolean
  testnet: boolean
  connected: boolean
  startedAt: number
  uptime: number
  cache: {
    hasMids: boolean
    hasAssetCtxs: boolean
    hasPerpMetas: boolean
    hasSpotMeta: boolean
    hasSpotAssetCtxs: boolean
    midsAge?: number
    assetCtxsAge?: number
    perpMetasAge?: number
    spotMetaAge?: number
    spotAssetCtxsAge?: number
  }
}

export class ServerClient {
  private socket: Socket | null = null
  private requestId = 0
  private pending = new Map<
    string,
    { resolve: (value: RPCResponse) => void; reject: (err: Error) => void }
  >()
  private buffer = ""

  async connect(): Promise<void> {
    if (this.socket) return

    return new Promise((resolve, reject) => {
      const socket = connect(SERVER_SOCKET_PATH)

      socket.on("connect", () => {
        this.socket = socket
        resolve()
      })

      socket.on("error", (err) => {
        reject(err)
      })

      socket.on("data", (data) => {
        this.handleData(data.toString())
      })

      socket.on("close", () => {
        this.socket = null
        // Reject all pending requests
        for (const pending of this.pending.values()) {
          pending.reject(new Error("Connection closed"))
        }
        this.pending.clear()
      })
    })
  }

  private handleData(data: string): void {
    this.buffer += data

    const lines = this.buffer.split("\n")
    this.buffer = lines.pop() || ""

    for (const line of lines) {
      if (line.trim()) {
        try {
          const response = JSON.parse(line) as RPCResponse
          const pending = this.pending.get(response.id)
          if (pending) {
            this.pending.delete(response.id)
            pending.resolve(response)
          }
        } catch {
          // Ignore parse errors
        }
      }
    }
  }

  private async request(method: string, params?: Record<string, unknown>): Promise<RPCResponse> {
    if (!this.socket) {
      throw new Error("Not connected")
    }

    const id = String(++this.requestId)
    const request = { id, method, params }

    return new Promise((resolve, reject) => {
      // Timeout after 5 seconds
      const timeoutId = setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error("Request timeout"))
        }
      }, 5000)

      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeoutId)
          resolve(value)
        },
        reject: (err) => {
          clearTimeout(timeoutId)
          reject(err)
        },
      })

      this.socket!.write(JSON.stringify(request) + "\n")
    })
  }

  async getPrices(coin?: string): Promise<{ data: Record<string, string>; cached_at: number }> {
    const response = await this.request("getPrices", coin ? { coin } : undefined)
    if (response.error) {
      throw new Error(response.error)
    }
    return { data: response.result as Record<string, string>, cached_at: response.cached_at! }
  }

  async getAssetCtxs(): Promise<{ data: AllDexsAssetCtxsEvent; cached_at: number }> {
    const response = await this.request("getAssetCtxs")
    if (response.error) {
      throw new Error(response.error)
    }
    return { data: response.result as AllDexsAssetCtxsEvent, cached_at: response.cached_at! }
  }

  async getPerpMeta(): Promise<{ data: AllPerpMetasResponse; cached_at: number }> {
    const response = await this.request("getPerpMeta")
    if (response.error) {
      throw new Error(response.error)
    }
    return { data: response.result as AllPerpMetasResponse, cached_at: response.cached_at! }
  }

  async getSpotMeta(): Promise<{ data: SpotMetaResponse; cached_at: number }> {
    const response = await this.request("getSpotMeta")
    if (response.error) {
      throw new Error(response.error)
    }
    return { data: response.result as SpotMetaResponse, cached_at: response.cached_at! }
  }

  async getSpotAssetCtxs(): Promise<{ data: SpotAssetCtxsEvent; cached_at: number }> {
    const response = await this.request("getSpotAssetCtxs")
    if (response.error) {
      throw new Error(response.error)
    }
    return { data: response.result as SpotAssetCtxsEvent, cached_at: response.cached_at! }
  }

  async getStatus(): Promise<ServerStatus> {
    const response = await this.request("getStatus")
    if (response.error) {
      throw new Error(response.error)
    }
    return response.result as ServerStatus
  }

  async shutdown(): Promise<void> {
    const response = await this.request("shutdown")
    if (response.error) {
      throw new Error(response.error)
    }
  }

  close(): void {
    if (this.socket) {
      this.socket.destroy()
      this.socket = null
    }
  }
}

// Helper to check if server is running
export function isServerRunning(): boolean {
  return existsSync(SERVER_SOCKET_PATH)
}

// Helper to try connecting to server
export async function tryConnectToServer(): Promise<ServerClient | null> {
  if (!isServerRunning()) {
    return null
  }

  try {
    const client = new ServerClient()
    await client.connect()
    return client
  } catch {
    return null
  }
}
