import type { Command } from "commander"
import { registerPositionsCommand } from "./positions.js"
import { registerOrdersCommand } from "./orders.js"
import { registerBalancesCommand } from "./balances.js"
import { registerPortfolioCommand } from "./portfolio.js"

export function registerAccountCommands(program: Command): void {
  const account = program.command("account").description("Account information")

  registerPositionsCommand(account)
  registerOrdersCommand(account)
  registerBalancesCommand(account)
  registerPortfolioCommand(account)
}
