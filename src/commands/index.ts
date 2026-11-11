import type { Command } from "commander"
import { registerAccountCommands } from "./account/index.js"
import { registerApi } from "./api.js"
import { registerCore } from "./core.js"
import { registerAudit } from "./audit.js"
import { registerUpgradeCommand } from "./upgrade.js"
export function registerCommands(program: Command): void {
  registerAccountCommands(program)
  registerApi(program)
  registerCore(program)
  registerAudit(program)
  registerUpgradeCommand(program)
}
