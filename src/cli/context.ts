import { HttpTransport, InfoClient } from "@nktkas/hyperliquid"
import type { Config } from "../lib/config.js"
export interface CLIContext {
  config: Config
  getPublicClient(): InfoClient
}
export function createContext(config: Config): CLIContext {
  const client = new InfoClient({
    transport: new HttpTransport({ isTestnet: config.testnet }),
  })
  return { config, getPublicClient: () => client }
}
