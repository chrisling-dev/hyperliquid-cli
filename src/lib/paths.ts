import { homedir } from "node:os"
import { join } from "node:path"

// Base directory for all hl files
export const HL_DIR = join(homedir(), ".hl")

// Server files
export const SERVER_SOCKET_PATH = join(HL_DIR, "server.sock")
export const SERVER_PID_PATH = join(HL_DIR, "server.pid")
export const SERVER_LOG_PATH = join(HL_DIR, "server.log")
export const SERVER_CONFIG_PATH = join(HL_DIR, "server.json")

// Database files
export const DB_PATH = join(HL_DIR, "hl.db")

// Server config stored in server.json
export interface ServerConfig {
  testnet: boolean
  startedAt: number
}
