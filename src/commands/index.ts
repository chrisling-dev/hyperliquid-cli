import type { Command } from "commander";
import { registerInfoCommands } from "./info.js";
import { registerTradeCommands } from "./trade.js";
import { registerReferralCommands } from "./referral.js";
import { registerServerCommands } from "./server.js";

export function registerCommands(program: Command): void {
  registerInfoCommands(program);
  registerTradeCommands(program);
  registerReferralCommands(program);
  registerServerCommands(program);
}
