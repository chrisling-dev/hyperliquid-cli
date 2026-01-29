import type { Command } from "commander"
import { registerInfoCommands } from "./info.js"
import { registerTradeCommands } from "./trade.js"
import { registerReferralCommands } from "./referral.js"
import { registerServerCommands } from "./server.js"
import { registerCancelCommand } from "./cancel.js"
import { registerLeverageCommand } from "./leverage.js"
import { registerConfigCommand } from "./config.js"

export function registerCommands(program: Command): void {
  registerInfoCommands(program)
  registerTradeCommands(program)
  registerCancelCommand(program)
  registerLeverageCommand(program)
  registerConfigCommand(program)
  registerReferralCommands(program)
  registerServerCommands(program)
}
