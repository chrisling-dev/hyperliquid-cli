import type { Command } from "commander"
import { registerAddCommand } from "./add.js"
import { registerLsCommand } from "./ls.js"
import { registerSetDefaultCommand } from "./set-default.js"
import { registerRemoveCommand } from "./remove.js"
export function registerAccountCommands(program: Command): void {
  const account = program
    .command("account")
    .description("Manage local read-only, agent, and master accounts")
  registerAddCommand(account)
  registerLsCommand(account)
  registerSetDefaultCommand(account)
  registerRemoveCommand(account)
}
