import { createConnection, type Socket } from "node:net"
import { spawn } from "node:child_process"
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs"
import { fileURLToPath } from "node:url"
import { corePaths, PROTOCOL } from "./paths.js"
import { HL_DIR } from "../lib/paths.js"
import { cleanupLegacy } from "./legacy.js"
export interface Message {
  id?: string
  result?: unknown
  error?: string
  event?: unknown
  status?: string
}
export function connect(path: string): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const socket = createConnection(path)
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error("Core connection timed out"))
    }, 3000)
    socket.once("connect", () => {
      clearTimeout(timer)
      resolve(socket)
    })
    socket.once("error", (e) => {
      clearTimeout(timer)
      reject(e)
    })
  })
}
export function receive(
  socket: Socket,
  handler: (message: Message) => void,
): void {
  let buffer = ""
  socket.setEncoding("utf8")
  socket.on("data", (chunk) => {
    buffer += chunk
    if (buffer.length > 8 * 1024 * 1024) {
      socket.destroy(new Error("Core message too large"))
      return
    }
    let end
    while ((end = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, end)
      buffer = buffer.slice(end + 1)
      try {
        handler(JSON.parse(line))
      } catch {
        socket.destroy(new Error("Invalid core protocol message"))
        return
      }
    }
  })
}
export async function rpcAt(path: string, method: string): Promise<unknown> {
  const socket = await connect(path)
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.destroy()
      reject(new Error("Core response timed out"))
    }, 3000)
    const fail = (e: Error) => {
      clearTimeout(timer)
      reject(e)
    }
    socket.once("error", fail)
    socket.once("close", () => {
      clearTimeout(timer)
      reject(new Error("Core disconnected"))
    })
    receive(socket, (msg) => {
      if (msg.id !== "1") return
      clearTimeout(timer)
      socket.end()
      if (msg.error) reject(new Error(msg.error))
      else resolve(msg.result)
    })
    socket.write(JSON.stringify({ id: "1", method }) + "\n")
  })
}
export const rpc = (testnet: boolean, method: string) =>
  rpcAt(corePaths(testnet).socket, method)
export async function status(
  testnet: boolean,
): Promise<Record<string, unknown>> {
  try {
    const result = (await rpc(testnet, "status")) as Record<string, unknown>
    if (result.protocol !== PROTOCOL || result.testnet !== testnet)
      throw new Error(
        "Incompatible core protocol/network; stop the existing core first",
      )
    return result
  } catch (error) {
    if (
      ["ENOENT", "ECONNREFUSED"].includes(
        (error as NodeJS.ErrnoException).code || "",
      )
    )
      return { running: false }
    throw error
  }
}
export function alive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return (e as NodeJS.ErrnoException).code === "EPERM"
  }
}
async function startCore(testnet: boolean): Promise<void> {
  await cleanupLegacy()
  if ((await status(testnet)).running) return
  const paths = corePaths(testnet)
  if (existsSync(paths.pid)) {
    const pid = Number(readFileSync(paths.pid, "utf8"))
    if (Number.isSafeInteger(pid) && pid > 1 && alive(pid))
      throw new Error(
        "Core PID is alive but its socket is unavailable. Inspect hl core status before restarting.",
      )
    unlinkSync(paths.pid)
  }
  if (existsSync(paths.socket)) unlinkSync(paths.socket)
  mkdirSync(HL_DIR, { recursive: true, mode: 0o700 })
  const source = fileURLToPath(new URL("./index.js", import.meta.url))
  const entry = existsSync(source) ? source : source.replace(/\.js$/, ".ts")
  const args = [
    ...(entry.endsWith(".ts") ? ["--import", "tsx"] : []),
    entry,
    ...(testnet ? ["--testnet"] : []),
  ]
  const child = spawn(process.execPath, args, {
    detached: true,
    stdio: "ignore",
    env: process.env,
  })
  child.on("error", (error) => appendFileSync(paths.log, `${error.message}\n`))
  child.unref()
  const deadline = Date.now() + 8000
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100))
    if ((await status(testnet)).running) return
  }
  throw new Error(`Core did not start; inspect ${paths.log}`)
}
export async function ensureCore(testnet: boolean): Promise<void> {
  mkdirSync(HL_DIR, { recursive: true, mode: 0o700 })
  const lock = `${corePaths(testnet).socket}.start-lock`
  const deadline = Date.now() + 15000
  while (true) {
    try {
      mkdirSync(lock, { mode: 0o700 })
      break
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error
      const ownerFile = `${lock}/pid`
      try {
        const pid = existsSync(ownerFile)
          ? Number(readFileSync(ownerFile, "utf8"))
          : 0
        if (
          (pid > 1 && !alive(pid)) ||
          (!pid && Date.now() - statSync(lock).mtimeMs > 15000)
        ) {
          rmSync(lock, { recursive: true })
          continue
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error
      }
      if (Date.now() > deadline)
        throw new Error("Another process is starting core; retry shortly")
      await new Promise((r) => setTimeout(r, 100))
    }
  }
  try {
    writeFileSync(`${lock}/pid`, String(process.pid))
    await startCore(testnet)
  } finally {
    rmSync(lock, { recursive: true, force: true })
  }
}
export async function stream(
  testnet: boolean,
  name: string,
  params: Record<string, unknown>,
  write: (event: unknown) => void,
): Promise<void> {
  await ensureCore(testnet)
  const socket = await connect(corePaths(testnet).socket)
  return new Promise((resolve, reject) => {
    const done = () => {
      socket.end()
      resolve()
    }
    process.once("SIGINT", done)
    process.once("SIGTERM", done)
    let ready = false
    const timer = setTimeout(
      () => socket.destroy(new Error("Subscription acknowledgement timed out")),
      15000,
    )
    const cleanup = () => {
      clearTimeout(timer)
      process.off("SIGINT", done)
      process.off("SIGTERM", done)
    }
    socket.once("error", (e) => {
      cleanup()
      reject(e)
    })
    socket.once("close", () => {
      cleanup()
      if (!ready) reject(new Error("Core disconnected before subscription"))
      else
        reject(new Error("Core disconnected; restart the stream to reconnect"))
    })
    receive(socket, (msg) => {
      if (msg.error) {
        socket.destroy(new Error(msg.error))
        return
      }
      if (msg.id === "1") {
        ready = true
        clearTimeout(timer)
      }
      if ("event" in msg) write(msg.event)
      if (msg.status)
        process.stderr.write(JSON.stringify({ connection: msg.status }) + "\n")
    })
    socket.write(
      JSON.stringify({ id: "1", method: "subscribe", name, params }) + "\n",
    )
  })
}
