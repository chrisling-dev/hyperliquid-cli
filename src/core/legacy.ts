import { existsSync, readFileSync, unlinkSync, lstatSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { execFileSync } from "node:child_process"
import { HL_DIR } from "../lib/paths.js"
import { rpcAt, alive } from "./client.js"
// Only touch recognized legacy files owned by this OS user. Never kill based on a PID file alone.
export async function cleanupLegacy(): Promise<string[]> {
  const cleaned: string[] = []
  const dirs = process.env.HL_HOME
    ? [HL_DIR]
    : [HL_DIR, join(homedir(), ".hyperliquid")]
  for (const dir of dirs) {
    const files = ["server.sock", "server.pid", "server.json"].map((n) =>
      join(dir, n),
    )
    if (!files.some(existsSync)) continue
    for (const file of files.filter(existsSync)) {
      const stat = lstatSync(file)
      if (
        stat.isSymbolicLink() ||
        (process.getuid && stat.uid !== process.getuid())
      )
        throw new Error(
          `Refusing to clean legacy file owned by another user or symlink: ${file}`,
        )
    }
    const pid = existsSync(files[1])
      ? Number(readFileSync(files[1], "utf8").trim())
      : 0
    let stopped = false
    if (existsSync(files[0])) {
      try {
        const old = (await rpcAt(files[0], "getStatus")) as Record<
          string,
          unknown
        >
        if (
          typeof old.testnet !== "boolean" ||
          typeof old.uptime !== "number" ||
          !old.cache
        )
          throw new Error("Unrecognized legacy server")
        await rpcAt(files[0], "shutdown")
        stopped = true
      } catch (error) {
        if (
          !["ENOENT", "ECONNREFUSED"].includes(
            (error as NodeJS.ErrnoException).code || "",
          )
        )
          throw new Error(
            `Could not safely stop legacy server: ${(error as Error).message}`,
          )
      }
    }
    if (Number.isSafeInteger(pid) && pid > 1 && alive(pid)) {
      if (!stopped) {
        const command = execFileSync(
          "ps",
          ["-p", String(pid), "-o", "command="],
          { encoding: "utf8" },
        ).trim()
        if (
          !/hyperliquid[^\s]*\/.*(?:dist|src)\/server\/index\.(?:js|ts)(?:\s|$)/.test(
            command,
          )
        )
          throw new Error(
            `Legacy PID ${pid} does not identify a Hyperliquid server; refusing to signal it`,
          )
        process.kill(pid, "SIGTERM")
      }
      const deadline = Date.now() + 4000
      while (alive(pid) && Date.now() < deadline)
        await new Promise((r) => setTimeout(r, 50))
      if (alive(pid))
        throw new Error(`Legacy server ${pid} has not exited; files preserved`)
    }
    for (const file of files)
      if (existsSync(file)) {
        unlinkSync(file)
        cleaned.push(file)
      }
  }
  return cleaned
}
