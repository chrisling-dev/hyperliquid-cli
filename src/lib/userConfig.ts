import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs"
import { dirname } from "node:path"
import { USER_CONFIG_PATH } from "./paths.js"

export interface UserConfig {
  slippage: number // Default: 1 (percent)
}

const DEFAULT_CONFIG: UserConfig = {
  slippage: 1,
}

export function loadUserConfig(): UserConfig {
  try {
    if (!existsSync(USER_CONFIG_PATH)) {
      return { ...DEFAULT_CONFIG }
    }
    const data = readFileSync(USER_CONFIG_PATH, "utf-8")
    const parsed = JSON.parse(data) as Partial<UserConfig>
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function saveUserConfig(config: Partial<UserConfig>): void {
  const current = loadUserConfig()
  const updated = { ...current, ...config }

  const dir = dirname(USER_CONFIG_PATH)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }

  writeFileSync(USER_CONFIG_PATH, JSON.stringify(updated, null, 2))
}

export function getUserConfigPath(): string {
  return USER_CONFIG_PATH
}
