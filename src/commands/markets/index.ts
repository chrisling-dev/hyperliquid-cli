import type { Command } from "commander"
import { registerLsCommand } from "./ls.js"

export function registerMarketsCommands(program: Command): void {
  const markets = program.command("markets").description("Market information")

  registerLsCommand(markets)
}
