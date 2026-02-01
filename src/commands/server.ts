import { Command } from "commander"
import { spawn } from "node:child_process"
import { readFileSync, existsSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import { getOutputOptions } from "../cli/program.js"
import { output, outputError, outputSuccess } from "../cli/output.js"
import { SERVER_PID_PATH, SERVER_LOG_PATH } from "../lib/paths.js"
import { ServerClient, isServerRunning } from "../client/index.js"

export function registerServerCommands(program: Command): void {
  const server = program.command("server").description("Manage the background WebSocket server")

  server
    .command("start")
    .description("Start the background WebSocket server")
    .action(async function (this: Command) {
      const opts = this.optsWithGlobals() as { testnet?: boolean }
      const isTestnet = opts.testnet ?? false

      // Check if server is already running
      if (existsSync(SERVER_PID_PATH)) {
        const pid = parseInt(readFileSync(SERVER_PID_PATH, "utf-8").trim(), 10)
        try {
          // Check if process is still alive (signal 0 just checks)
          process.kill(pid, 0)
          outputError(`Server is already running (pid: ${pid})`)
          process.exit(1)
        } catch {
          // Process not running, PID file is stale
        }
      }

      // Find the server entry point
      const __filename = fileURLToPath(import.meta.url)
      const __dirname = dirname(__filename)
      // In dist: dist/commands/server.js -> dist/server/index.js
      // In src: src/commands/server.ts -> src/server/index.ts
      const serverPath = join(__dirname, "..", "server", "index.js")

      if (!existsSync(serverPath)) {
        outputError(`Server entry point not found: ${serverPath}`)
        process.exit(1)
      }

      // Spawn server as detached background process
      const args = isTestnet ? ["--testnet"] : []
      const child = spawn("node", [serverPath, ...args], {
        detached: true,
        stdio: "ignore",
      })

      child.unref()

      // Wait for server to start (poll for socket file, max 10 seconds)
      const maxWait = 10_000
      const pollInterval = 200
      let waited = 0

      while (waited < maxWait) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval))
        waited += pollInterval

        if (isServerRunning()) {
          // Try connecting to verify it's ready
          try {
            const client = new ServerClient()
            await client.connect()
            await client.getStatus()
            client.close()

            const network = isTestnet ? "testnet" : "mainnet"
            outputSuccess(`Server started (${network})`)
            return
          } catch {
            // Socket exists but server not ready yet, keep waiting
          }
        }
      }

      outputError(`Failed to start server. Check logs at: ${SERVER_LOG_PATH}`)
      process.exit(1)
    })

  server
    .command("stop")
    .description("Stop the background WebSocket server")
    .action(async function (this: Command) {
      if (!isServerRunning()) {
        outputError("Server is not running, run 'hl server start' to start it")
        process.exit(1)
      }

      try {
        const client = new ServerClient()
        await client.connect()
        await client.shutdown()
        client.close()

        // Wait for server to stop
        await new Promise((resolve) => setTimeout(resolve, 500))

        if (isServerRunning()) {
          // Force kill if still running
          if (existsSync(SERVER_PID_PATH)) {
            const pid = parseInt(readFileSync(SERVER_PID_PATH, "utf-8").trim(), 10)
            try {
              process.kill(pid, "SIGKILL")
            } catch {
              // Already dead
            }
          }
        }

        outputSuccess("Server stopped")
      } catch (err) {
        // Try force kill via PID
        if (existsSync(SERVER_PID_PATH)) {
          const pid = parseInt(readFileSync(SERVER_PID_PATH, "utf-8").trim(), 10)
          try {
            process.kill(pid, "SIGTERM")
            outputSuccess("Server stopped")
            return
          } catch {
            // Already dead
          }
        }
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })

  server
    .command("status")
    .description("Show background server status")
    .action(async function (this: Command) {
      const outputOpts = getOutputOptions(this)

      if (!isServerRunning()) {
        if (outputOpts.json) {
          output({ running: false }, outputOpts)
        } else {
          console.log(`Server is not running, run 'hl server start' to start it`)
        }
        return
      }

      try {
        const client = new ServerClient()
        await client.connect()
        const status = await client.getStatus()
        client.close()

        if (outputOpts.json) {
          output(status, outputOpts)
        } else {
          console.log(`Status:     running`)
          console.log(`Network:    ${status.testnet ? "testnet" : "mainnet"}`)
          console.log(`WebSocket:  ${status.connected ? "connected" : "disconnected"}`)
          console.log(`Uptime:     ${formatUptime(status.uptime)}`)
          console.log(``)
          console.log(`Cache:`)
          console.log(
            `  Mid Prices:      ${status.cache.hasMids ? `cached (${formatAge(status.cache.midsAge)} ago)` : "not loaded"}`,
          )
          console.log(
            `  Perp Meta:   ${status.cache.hasPerpMetas ? `cached (${formatAge(status.cache.perpMetasAge)} ago)` : "not loaded"}`,
          )
          console.log(
            `  Perp Asset Ctxs:  ${status.cache.hasAssetCtxs ? `cached (${formatAge(status.cache.assetCtxsAge)} ago)` : "not loaded"}`,
          )
          console.log(
            `  Spot Meta:   ${status.cache.hasSpotMeta ? `cached (${formatAge(status.cache.spotMetaAge)} ago)` : "not loaded"}`,
          )
          console.log(
            `  Spot Ctxs:   ${status.cache.hasSpotAssetCtxs ? `cached (${formatAge(status.cache.spotAssetCtxsAge)} ago)` : "not loaded"}`,
          )
        }
      } catch (err) {
        // Server might be in bad state
        if (outputOpts.json) {
          output({ running: true, error: String(err) }, outputOpts)
        } else {
          console.log(`Server appears running but not responding`)
          console.log(`Try: hl server stop && hl server start`)
        }
      }
    })
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

function formatAge(ms: number | undefined): string {
  if (ms === undefined) return "unknown"
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${seconds % 60}s`
}
