import type { Command } from "commander"
import { ensureCore, status, rpc } from "../core/client.js"
import { cleanupLegacy } from "../core/legacy.js"
export function registerCore(program: Command) {
  const core = program
    .command("core")
    .description("Manage the shared WebSocket broker (one per network)")
  core
    .command("start")
    .description("Start core; safely migrate legacy server files")
    .action(async function (this: Command) {
      const testnet = !!this.optsWithGlobals().testnet
      await ensureCore(testnet)
      console.log(JSON.stringify(await status(testnet), null, 2))
    })
  core
    .command("status")
    .description("Show connection and subscription status")
    .action(async function (this: Command) {
      console.log(
        JSON.stringify(await status(!!this.optsWithGlobals().testnet), null, 2),
      )
    })
  core
    .command("stop")
    .description("Stop core and disconnect its subscribers")
    .action(async function (this: Command) {
      const testnet = !!this.optsWithGlobals().testnet
      console.log(
        JSON.stringify(
          (await status(testnet)).running
            ? await rpc(testnet, "stop")
            : { running: false },
        ),
      )
    })
  core
    .command("cleanup")
    .description("Stop a verified old server and remove obsolete runtime files")
    .action(async () => {
      console.log(JSON.stringify({ cleaned: await cleanupLegacy() }, null, 2))
    })
}
