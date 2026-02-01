import { homedir } from "os"
import { join } from "path"
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs"

export interface OrderConfig {
  slippage: number
}

const DEFAULT_CONFIG: OrderConfig = {
  slippage: 1.0,
}

function getConfigPath(): string {
  return join(homedir(), ".hl", "order-config.json")
}

export function getOrderConfig(): OrderConfig {
  const configPath = getConfigPath()

  try {
    if (!existsSync(configPath)) {
      return { ...DEFAULT_CONFIG }
    }
    const content = readFileSync(configPath, "utf-8")
    const parsed = JSON.parse(content) as Partial<OrderConfig>
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
    }
  } catch {
    return { ...DEFAULT_CONFIG }
  }
}

export function updateOrderConfig(updates: Partial<OrderConfig>): OrderConfig {
  const configPath = getConfigPath()
  const configDir = join(homedir(), ".hl")

  // Ensure directory exists
  if (!existsSync(configDir)) {
    mkdirSync(configDir, { recursive: true })
  }

  const current = getOrderConfig()
  const updated: OrderConfig = {
    ...current,
    ...updates,
  }

  writeFileSync(configPath, JSON.stringify(updated, null, 2))
  return updated
}
