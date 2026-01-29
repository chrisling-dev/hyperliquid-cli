import { Command } from "commander"
import { getOutputOptions } from "../cli/program.js"
import { output, outputError, outputSuccess } from "../cli/output.js"
import {
  loadUserConfig,
  saveUserConfig,
  getUserConfigPath,
  type UserConfig,
} from "../lib/userConfig.js"

const VALID_CONFIG_KEYS: (keyof UserConfig)[] = ["slippage"]

export function registerConfigCommand(program: Command): void {
  const config = program
    .command("config")
    .description("Manage CLI configuration")

  config
    .command("set")
    .description("Set a configuration value")
    .argument("<key>", "Configuration key (slippage)")
    .argument("<value>", "Configuration value")
    .action(async function (this: Command, key: string, value: string) {
      const outputOpts = getOutputOptions(this)

      try {
        const lowerKey = key.toLowerCase() as keyof UserConfig

        if (!VALID_CONFIG_KEYS.includes(lowerKey)) {
          throw new Error(
            `Unknown config key: ${key}. Valid keys: ${VALID_CONFIG_KEYS.join(", ")}`
          )
        }

        let parsedValue: number

        if (lowerKey === "slippage") {
          parsedValue = parseFloat(value)
          if (isNaN(parsedValue) || parsedValue < 0) {
            throw new Error("Slippage must be a non-negative number")
          }
        } else {
          throw new Error(`Unknown config key: ${key}`)
        }

        saveUserConfig({ [lowerKey]: parsedValue })

        if (outputOpts.json) {
          output({ key: lowerKey, value: parsedValue }, outputOpts)
        } else {
          outputSuccess(`Set ${lowerKey} to ${parsedValue}`)
        }
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })

  config
    .command("get")
    .description("Get a configuration value")
    .argument("<key>", "Configuration key (slippage)")
    .action(async function (this: Command, key: string) {
      const outputOpts = getOutputOptions(this)

      try {
        const lowerKey = key.toLowerCase() as keyof UserConfig

        if (!VALID_CONFIG_KEYS.includes(lowerKey)) {
          throw new Error(
            `Unknown config key: ${key}. Valid keys: ${VALID_CONFIG_KEYS.join(", ")}`
          )
        }

        const userConfig = loadUserConfig()
        const value = userConfig[lowerKey]

        if (outputOpts.json) {
          output({ key: lowerKey, value }, outputOpts)
        } else {
          console.log(`${lowerKey}: ${value}`)
        }
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })

  config
    .command("list")
    .description("List all configuration values")
    .action(async function (this: Command) {
      const outputOpts = getOutputOptions(this)

      try {
        const userConfig = loadUserConfig()
        const configPath = getUserConfigPath()

        if (outputOpts.json) {
          output({ config: userConfig, path: configPath }, outputOpts)
        } else {
          console.log(`Config file: ${configPath}`)
          console.log("")
          for (const key of VALID_CONFIG_KEYS) {
            console.log(`${key}: ${userConfig[key]}`)
          }
        }
      } catch (err) {
        outputError(err instanceof Error ? err.message : String(err))
        process.exit(1)
      }
    })
}
