import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "node:child_process"
const home = mkdtempSync(join(tmpdir(), "hl-smoke-"))
const env = {
  ...process.env,
  HL_HOME: home,
  HYPERLIQUID_PRIVATE_KEY: "",
  HYPERLIQUID_WALLET_ADDRESS: "",
}
function run(args: string[]) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(process.execPath, ["dist/index.js", ...args], { env })
    let out = "",
      err = ""
    child.stdout.on("data", (x) => (out += x))
    child.stderr.on("data", (x) => (err += x))
    const timeout = setTimeout(() => {
      child.kill()
      reject(new Error("Command timeout"))
    }, 15000)
    child.on("exit", (code) => {
      clearTimeout(timeout)
      if (code === 0) resolve(out)
      else reject(new Error(err || `exit ${code}`))
    })
  })
}
const streams: ReturnType<typeof spawn>[] = []
try {
  console.log(
    "account:",
    JSON.parse(
      await run([
        "account",
        "add",
        "--alias",
        "watch",
        "--user",
        "0x0000000000000000000000000000000000000001",
      ]),
    ).type,
  )
  console.log(
    "info markets:",
    Object.keys(JSON.parse(await run(["info", "allMids"]))).length,
  )
  console.log(
    "resolved user:",
    JSON.parse(await run(["info", "clearinghouseState", "--dry-run"])).params
      .user,
  )
  await Promise.all([run(["core", "start"]), run(["core", "start"])])
  let received = 0
  const wait = () =>
    new Promise<void>((resolve, reject) => {
      const child = spawn(
        process.execPath,
        ["dist/index.js", "ws", "l2Book", "--coin", "BTC"],
        { env },
      )
      streams.push(child)
      let buffer = ""
      const timeout = setTimeout(
        () => reject(new Error("No stream event")),
        15000,
      )
      child.stderr.on("data", () => {})
      child.stdout.on("data", (x) => {
        buffer += x
        if (buffer.includes("\n")) {
          JSON.parse(buffer.split("\n")[0])
          received++
          clearTimeout(timeout)
          resolve()
        }
      })
      child.on("error", reject)
    })
  await Promise.all([wait(), wait()])
  const status = JSON.parse(await run(["core", "status"]))
  if (status.subscriptions !== 1)
    throw new Error(
      `Expected 1 upstream subscription, got ${status.subscriptions}`,
    )
  console.log("shared stream:", {
    subscriptions: status.subscriptions,
    clients: status.clients,
    received: received > 0,
  })
  for (const child of streams) child.kill("SIGINT")
  await new Promise((r) => setTimeout(r, 300))
  const after = JSON.parse(await run(["core", "status"]))
  if (after.subscriptions !== 0) throw new Error("Subscription leaked")
  console.log("subscriptions after disconnect:", after.subscriptions)
} finally {
  for (const child of streams) child.kill("SIGINT")
  await run(["core", "stop"]).catch(() => {})
  await new Promise((r) => setTimeout(r, 200))
  rmSync(home, { recursive: true, force: true })
}
