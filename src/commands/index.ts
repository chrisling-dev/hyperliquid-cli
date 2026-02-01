import type { Command } from "commander"
import { registerAccountCommands } from "./account/index.js"
import { registerMarketsCommands } from "./markets/index.js"
import { registerAssetCommands } from "./asset/index.js"
import { registerTradeCommands } from "./trade.js"
import { registerServerCommands } from "./server.js"

export function registerCommands(program: Command): void {
  registerAccountCommands(program)
  registerMarketsCommands(program)
  registerAssetCommands(program)
  registerTradeCommands(program)
  registerServerCommands(program)
}
