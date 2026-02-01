import type { Command } from "commander"
import { registerLsCommand } from "./ls.js"
import { registerCancelCommand } from "./cancel.js"
import { registerMarketCommand } from "./market.js"
import { registerLimitCommand } from "./limit.js"
import { registerSetLeverageCommand } from "./set-leverage.js"
import { registerConfigureCommand } from "./configure.js"

export function registerOrderCommands(program: Command): void {
  const order = program
    .command("order")
    .description("Order management and trading (requires authentication)")

  registerLsCommand(order)
  registerCancelCommand(order)
  registerMarketCommand(order)
  registerLimitCommand(order)
  registerSetLeverageCommand(order)
  registerConfigureCommand(order)
}
