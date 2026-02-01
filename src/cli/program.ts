import { Command } from "commander"
import { loadConfig } from "../lib/config.js"
import { createContext, type CLIContext } from "./context.js"
import { registerCommands } from "../commands/index.js"

export interface GlobalOptions {
  json: boolean
  testnet: boolean
}

export function createProgram(): Command {
  const program = new Command()

  program
    .name("hl")
    .description("CLI for Hyperliquid DEX")
    .version("1.0.0")
    .option("--json", "Output in JSON format", false)
    .option("--testnet", "Use testnet instead of mainnet", false)
    .hook("preAction", async (thisCommand) => {
      const opts = thisCommand.opts() as GlobalOptions
      const config = loadConfig(opts.testnet)
      const context = createContext(config)

      // Store context on the command for subcommands to access
      thisCommand.setOptionValue("_context", context)
      thisCommand.setOptionValue("_outputOptions", { json: opts.json })

      // Store start time for timing
      thisCommand.setOptionValue("_startTime", performance.now())
    })
    .hook("postAction", (thisCommand) => {
      const opts = thisCommand.opts() as GlobalOptions
      const startTime = thisCommand.opts()._startTime as number | undefined

      // Only show timing for non-JSON output
      if (!opts.json && startTime !== undefined) {
        const duration = (performance.now() - startTime) / 1000
        console.log(`\nCompleted in ${duration.toFixed(2)}s`)
      }
    })

  registerCommands(program)

  return program
}

export function getContext(command: Command): CLIContext {
  let current: Command | null = command
  while (current) {
    const ctx = current.opts()._context as CLIContext | undefined
    if (ctx) return ctx
    current = current.parent
  }
  throw new Error("Context not found")
}

export function getOutputOptions(command: Command): { json: boolean } {
  let current: Command | null = command
  while (current) {
    const opts = current.opts()._outputOptions as { json: boolean } | undefined
    if (opts) return opts
    current = current.parent
  }
  return { json: false }
}
