import { join } from "node:path"
import { HL_DIR } from "../lib/paths.js"
export function corePaths(testnet: boolean) {
  const base = join(HL_DIR, `core-${testnet ? "testnet" : "mainnet"}`)
  return { socket: `${base}.sock`, pid: `${base}.pid`, log: `${base}.log` }
}
export const PROTOCOL = "hl-core/1"
