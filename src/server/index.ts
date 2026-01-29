#!/usr/bin/env node

import { mkdirSync, writeFileSync, appendFileSync, unlinkSync, existsSync } from "node:fs"
import {
  HL_DIR,
  SERVER_PID_PATH,
  SERVER_LOG_PATH,
  SERVER_CONFIG_PATH,
  SERVER_SOCKET_PATH,
  type ServerConfig,
} from "../lib/paths.js"
import { ServerCache } from "./cache.js"
import { SubscriptionManager } from "./subscriptions.js"
import { IPCServer } from "./ipc.js"

// Parse command line args
const args = process.argv.slice(2)
const isTestnet = args.includes("--testnet")

// Ensure ~/.hl directory exists
mkdirSync(HL_DIR, { recursive: true })

// Logging
function log(msg: string): void {
  const timestamp = new Date().toISOString()
  const line = `[${timestamp}] ${msg}\n`
  appendFileSync(SERVER_LOG_PATH, line)
}

// Initialize
const startedAt = Date.now()
log(`Starting server (testnet: ${isTestnet}, pid: ${process.pid})`)

// Write PID file
writeFileSync(SERVER_PID_PATH, String(process.pid))

// Write config file
const config: ServerConfig = { testnet: isTestnet, startedAt }
writeFileSync(SERVER_CONFIG_PATH, JSON.stringify(config, null, 2))

// Create cache and managers
const cache = new ServerCache()
const subscriptions = new SubscriptionManager(cache, isTestnet, log)

let ipcServer: IPCServer | null = null

// Graceful shutdown
async function shutdown(reason: string): Promise<void> {
  log(`Shutting down: ${reason}`)

  try {
    // Stop IPC server first
    if (ipcServer) {
      await ipcServer.stop()
    }

    // Stop subscriptions
    await subscriptions.stop()

    // Clean up files
    if (existsSync(SERVER_PID_PATH)) {
      unlinkSync(SERVER_PID_PATH)
    }
    if (existsSync(SERVER_SOCKET_PATH)) {
      unlinkSync(SERVER_SOCKET_PATH)
    }
    if (existsSync(SERVER_CONFIG_PATH)) {
      unlinkSync(SERVER_CONFIG_PATH)
    }

    log("Shutdown complete")
  } catch (err) {
    log(`Shutdown error: ${err}`)
  }

  process.exit(0)
}

// Signal handlers
process.on("SIGTERM", () => shutdown("SIGTERM"))
process.on("SIGINT", () => shutdown("SIGINT"))
process.on("uncaughtException", (err) => {
  log(`Uncaught exception: ${err.message}`)
  shutdown("uncaught exception").catch(() => process.exit(1))
})
process.on("unhandledRejection", (reason) => {
  log(`Unhandled rejection: ${reason}`)
  shutdown("unhandled rejection").catch(() => process.exit(1))
})

// Start server
async function start(): Promise<void> {
  try {
    // Start WebSocket subscriptions
    await subscriptions.start()

    // Start IPC server
    ipcServer = new IPCServer(cache, subscriptions, isTestnet, startedAt, log, () => {
      shutdown("shutdown request")
    })
    await ipcServer.start()

    log("Server started successfully")
  } catch (err) {
    log(`Failed to start server: ${err}`)
    await shutdown("startup error")
  }
}

start()
