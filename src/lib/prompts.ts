import { confirm as askConfirm } from "@inquirer/prompts"
export function confirm(message: string, defaultValue = false): Promise<boolean> {
  return askConfirm({ message, default: defaultValue })
}
