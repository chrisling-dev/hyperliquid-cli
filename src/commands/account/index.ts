import type { Command } from "commander"
import { registerPositionsCommand } from "./positions.js"
import { registerOrdersCommand } from "./orders.js"
import { registerBalancesCommand } from "./balances.js"
import { registerPortfolioCommand } from "./portfolio.js"
import { registerAddCommand } from "./add.js"
import { registerLsCommand } from "./ls.js"
import { registerSetDefaultCommand } from "./set-default.js"
import { registerRemoveCommand } from "./remove.js"

export function registerAccountCommands(program: Command): void {
  const account = program.command("account").description("Account management and information")

  // Account management commands
  registerAddCommand(account)
  registerLsCommand(account)
  registerSetDefaultCommand(account)
  registerRemoveCommand(account)

  // Account information commands
  registerPositionsCommand(account)
  registerOrdersCommand(account)
  registerBalancesCommand(account)
  registerPortfolioCommand(account)
}
