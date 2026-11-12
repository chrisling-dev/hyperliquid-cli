import { formatError } from "./errors.js"
import { Command } from "commander"
import { createRequire } from "node:module"
import { loadConfig } from "../lib/config.js"
import { createContext, type CLIContext } from "./context.js"
import { registerCommands } from "../commands/index.js"
const pkg = createRequire(import.meta.url)("../../package.json") as {
  version: string
}
export function createProgram(): Command {
  const program = new Command()
    .name("hl")
    .description(
      "Hyperliquid API CLI — account-aware JSON commands and shared streams",
    )
    .version(pkg.version)
    .option(
      "--json",
      "JSON output for errors, account and utility commands",
      false,
    )
    .option("--testnet", "Use testnet", false)
    .option(
      "--account <alias>",
      "Select a saved account (otherwise the default)",
    )
  program.configureOutput({
    outputError: (message, write) =>
      write(
        formatError(new Error(message.replace(/^error: /, "").trimEnd()), {
          json: !!program.opts().json,
        }),
      ),
  })
  registerCommands(program)
  program.addHelpText(
    "after",
    "\nStart here:\n  hl account add --help\n  hl info --help\n  hl ws --help\n  hl exchange --help\n  hl schema exchange order\n\nAPI commands return JSON; streams return NDJSON. No timing text is written to stdout.\n",
  )
  return program
}
export function getContext(command: Command): CLIContext {
  const opts = command.optsWithGlobals()
  return createContext(loadConfig(!!opts.testnet, opts.account))
}
export function getOutputOptions(command: Command): { json: boolean } {
  return { json: !!command.optsWithGlobals().json }
}
