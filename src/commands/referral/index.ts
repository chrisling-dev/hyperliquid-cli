import type { Command } from "commander"
import { registerSetCommand } from "./set.js"
import { registerStatusCommand } from "./status.js"

export function registerReferralCommands(program: Command): void {
  const referral = program.command("referral").description("Referral management")

  registerSetCommand(referral)
  registerStatusCommand(referral)
}
