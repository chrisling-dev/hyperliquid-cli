#!/usr/bin/env node
import { createServer, type Socket } from "node:net"
import {
  appendFileSync,
  mkdirSync,
  writeFileSync,
  unlinkSync,
  existsSync,
  chmodSync,
} from "node:fs"
import { WebSocketTransport } from "@nktkas/hyperliquid"
import { Broker, sdkSubscribe } from "./broker.js"
import { corePaths, PROTOCOL } from "./paths.js"
import { HL_DIR } from "../lib/paths.js"
const testnet = process.argv.includes("--testnet")
const paths = corePaths(testnet)
mkdirSync(HL_DIR, { recursive: true, mode: 0o700 })
const log = (error: unknown) =>
  appendFileSync(paths.log, `${new Date().toISOString()} ${String(error)}\n`, {
    mode: 0o600,
  })
const transport = new WebSocketTransport({ isTestnet: testnet })
const broker = new Broker(sdkSubscribe(transport))
const sockets = new Set<Socket>()
const startedAt = Date.now()
let bound = false
let stopping = false
function send(socket: Socket, data: unknown) {
  if (socket.destroyed) return
  if (socket.writableLength > 1024 * 1024) {
    socket.destroy()
    return
  }
  socket.write(JSON.stringify(data) + "\n")
}
const server = createServer((socket) => {
  sockets.add(socket)
  let buffer = ""
  let subscribed = false
  let release: (() => Promise<void>) | undefined
  socket.setEncoding("utf8")
  socket.on("error", () => {})
  socket.on("close", () => {
    sockets.delete(socket)
    void release?.().catch(log)
  })
  socket.on("data", (chunk) => {
    buffer += chunk
    if (buffer.length > 1024 * 1024) {
      socket.destroy()
      return
    }
    let end
    while ((end = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, end)
      buffer = buffer.slice(end + 1)
      void (async () => {
        let id = ""
        try {
          const req = JSON.parse(line)
          id = req.id
          if (req.method === "status")
            send(socket, {
              id,
              result: {
                running: true,
                protocol: PROTOCOL,
                testnet,
                pid: process.pid,
                startedAt,
                subscriptions: broker.size,
                clients: sockets.size,
                connected: transport.socket.readyState === 1,
              },
            })
          else if (req.method === "stop") {
            send(socket, { id, result: { stopped: true } })
            setTimeout(shutdown, 50)
          } else if (req.method === "subscribe") {
            if (subscribed)
              throw new Error("Only one subscription per IPC connection")
            subscribed = true
            release = await broker.add(req.name, req.params ?? {}, (event) =>
              send(socket, { event }),
            )
            if (socket.destroyed) await release()
            else send(socket, { id, result: { subscribed: true } })
          } else throw new Error("Unknown core method")
        } catch (error) {
          send(socket, { id, error: (error as Error).message })
        }
      })()
    }
  })
})
transport.socket.addEventListener("close", () => {
  for (const s of sockets)
    send(s, {
      status: "disconnected; resubscribing on reconnect; events may have gaps",
    })
})
transport.socket.addEventListener("open", () => {
  for (const s of sockets) send(s, { status: "connected" })
})
function shutdown() {
  if (stopping) return
  stopping = true
  for (const socket of sockets) socket.destroy()
  transport.close()
  server.close(() => {
    if (bound)
      for (const file of [paths.socket, paths.pid])
        if (existsSync(file)) unlinkSync(file)
    process.exit(0)
  })
}
process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)
server.on("error", (error) => {
  log(error)
  transport.close()
  process.exit(1)
})
server.listen(paths.socket, () => {
  bound = true
  chmodSync(paths.socket, 0o600)
  writeFileSync(paths.pid, String(process.pid), { mode: 0o600 })
})
