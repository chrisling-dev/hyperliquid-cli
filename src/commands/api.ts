import { Command, Option } from "commander"
import { readFile } from "node:fs/promises"
import {
  methods,
  inputFields,
  manifest,
  getMethod,
  parseFlag,
  description,
  requiredInputs,
  assertRequiredInputs,
} from "../api/registry.js"
import {
  inputSchema,
  formatParameterHelp,
  parameterType,
} from "../api/parameter-help.js"
import { resolveInput, execute, assertPermission } from "../api/execution.js"
import { validateAddress } from "../lib/validation.js"
import { getContext } from "../cli/program.js"
import { stream } from "../core/client.js"
function object(text: string): Record<string, unknown> {
  const value = JSON.parse(text)
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Input must be a JSON object")
  return value
}
export function registerApi(program: Command) {
  for (const family of ["info", "ws", "exchange"] as const) {
    const group = program.command(family).description(
      {
        info: "Query API methods (JSON)",
        ws: "Subscribe through shared core (NDJSON)",
        exchange: "Sign and submit API actions (JSON)",
      }[family],
    )
    for (const m of methods.filter((x) => x.family === family)) {
      const cmd = group
        .command(m.name)
        .description(`${m.description} [${m.permission}]`)
        .option("--data <json>", "Inline JSON parameters")
        .option("--input <file>", "JSON parameters from file, or - for stdin")
        .option(
          "--dry-run",
          "Validate and print resolved parameters without connecting, signing, or submitting",
        )
      for (const [key, schema] of Object.entries(inputFields(m))) {
        // Transport input flags are reserved; overlapping API fields remain available via JSON.
        if (["data", "input"].includes(key)) continue
        cmd.addOption(
          new Option(
            `--${key} <value>`,
            `${description(schema) || key} (${parameterType(schema)}; ${requiredInputs(m).includes(key) ? (key === "user" ? "required unless an account is selected" : "required") : "optional or variant"})`,
          ).argParser((value) => parseFlag(value, schema)),
        )
      }
      if (family === "exchange") {
        if (m.vault)
          cmd.option(
            "--execution-vault <address>",
            "Execute for a vault or subaccount (distinct from action.vaultAddress)",
          )
        if (m.expires)
          cmd.option("--expires-after <ms>", "Action expiration timestamp")
      }
      cmd.addHelpText(
        "after",
        `\nInputs use API request fields${family === "exchange" ? " inside action (omit type, signature, and generated nonce)" : " (omit type)"}.\n--user defaults to the selected account where supported; explicit fields take precedence.\nUse JSON for arrays/objects. Example: --data '{"coin":"BTC"}' (where supported).\nParameter guide: hl schema ${family} ${m.name}\n${family === "ws" ? "Core starts automatically; Ctrl-C releases this subscription.\n" : ""}`,
      )
      cmd.action(async function (this: Command) {
        const opts = this.opts()
        if (opts.data !== undefined && opts.input !== undefined)
          throw new Error("Use either --data or --input")
        let params: Record<string, unknown> = {}
        if (opts.data !== undefined) params = object(opts.data)
        if (opts.input !== undefined)
          params = object(
            await readFile(
              opts.input === "-" ? "/dev/stdin" : opts.input,
              "utf8",
            ),
          )
        for (const key of Object.keys(inputFields(m))) {
          if (["data", "input"].includes(key)) continue
          if (opts[key] !== undefined) {
            if (key in params)
              throw new Error(
                `Field ${key} supplied both in JSON and as a flag`,
              )
            params[key] = opts[key]
          }
        }
        assertRequiredInputs(m, params, true)
        const config = getContext(this).config
        params = resolveInput(m, params, config)
        assertPermission(m, config)
        const execution = {
          vaultAddress: opts.executionVault
            ? validateAddress(opts.executionVault)
            : undefined,
          expiresAfter:
            opts.expiresAfter === undefined
              ? undefined
              : Number(opts.expiresAfter),
        }
        if (
          execution.expiresAfter !== undefined &&
          (!Number.isSafeInteger(execution.expiresAfter) ||
            execution.expiresAfter < 0)
        )
          throw new Error("--expires-after must be a non-negative integer")
        if (opts.dryRun) {
          console.log(
            JSON.stringify(
              {
                family,
                name: m.name,
                params,
                execution,
                account: config.account?.alias,
                network: config.testnet ? "testnet" : "mainnet",
              },
              null,
              2,
            ),
          )
          return
        }
        if (family === "ws")
          await stream(config.testnet, m.name, params, (event) =>
            console.log(JSON.stringify(event)),
          )
        else
          console.log(
            JSON.stringify(
              await execute(m, params, config, execution),
              null,
              2,
            ),
          )
      })
    }
  }
  program
    .command("schema <family> <method>")
    .description(
      "Show accepted parameters, required fields, and allowed values",
    )
    .action(function (this: Command, family: string, name: string) {
      const method = getMethod(family, name)
      console.log(
        this.optsWithGlobals().json
          ? JSON.stringify(inputSchema(method), null, 2)
          : formatParameterHelp(method),
      )
    })
  program
    .command("capabilities")
    .description(
      "List all mapped methods, schemas, and required account capabilities as JSON",
    )
    .action(() =>
      console.log(
        JSON.stringify(
          { sdk: "0.33.3", methods: methods.map(manifest) },
          null,
          2,
        ),
      ),
    )
}
