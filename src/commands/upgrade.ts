import { Command } from "commander"
import { createRequire } from "module"
import { getOutputOptions } from "../cli/program.js"
import { output, outputSuccess } from "../cli/output.js"

const require = createRequire(import.meta.url)
const pkg = require("../../package.json") as { version: string }

interface NpmRegistryResponse {
  "dist-tags": {
    latest: string
    beta?: string
  }
}

interface UpgradeResult {
  current: string
  latest: string
  updateAvailable: boolean
}

async function fetchLatestVersion(): Promise<string> {
  const response = await fetch("https://registry.npmjs.org/hyperliquid-cli")
  if (!response.ok) {
    throw new Error(`Failed to fetch package info: ${response.statusText}`)
  }
  const data = (await response.json()) as NpmRegistryResponse
  const tags = data["dist-tags"]
  return pkg.version.includes("-") &&
    tags.beta &&
    compareVersions(tags.latest, tags.beta)
    ? tags.beta
    : tags.latest
}

export function compareVersions(current: string, latest: string): boolean {
  const parse = (value: string) => {
    const [core, ...rest] = value.split("+")[0].split("-")
    return {
      core: core.split(".").map(Number),
      pre: rest.join("-").split(".").filter(Boolean),
    }
  }
  const a = parse(current),
    b = parse(latest)
  for (let i = 0; i < 3; i++) {
    if (a.core[i] !== b.core[i]) return b.core[i] > a.core[i]
  }
  if (!a.pre.length || !b.pre.length) return !!a.pre.length && !b.pre.length
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    if (a.pre[i] === b.pre[i]) continue
    if (a.pre[i] === undefined) return true
    if (b.pre[i] === undefined) return false
    const an = /^\d+$/.test(a.pre[i]),
      bn = /^\d+$/.test(b.pre[i])
    if (an && bn) return Number(b.pre[i]) > Number(a.pre[i])
    if (an !== bn) return an
    return b.pre[i] > a.pre[i]
  }
  return false
}

export function registerUpgradeCommand(program: Command): void {
  program
    .command("upgrade")
    .description("Check for updates and show upgrade instructions")
    .action(async function (this: Command) {
      const outputOpts = getOutputOptions(this)
      const current = pkg.version

      let latest: string
      try {
        latest = await fetchLatestVersion()
      } catch (err) {
        if (outputOpts.json) {
          output(
            { error: err instanceof Error ? err.message : String(err) },
            outputOpts,
          )
        } else {
          console.error(
            "Failed to check for updates:",
            err instanceof Error ? err.message : String(err),
          )
        }
        process.exit(1)
      }

      const updateAvailable = compareVersions(current, latest)

      const result: UpgradeResult = {
        current,
        latest,
        updateAvailable,
      }

      if (outputOpts.json) {
        output(result, outputOpts)
      } else {
        console.log(`Current version: ${current}`)
        console.log(`Latest version:  ${latest}`)

        if (updateAvailable) {
          console.log(``)
          outputSuccess("Update available!")
          console.log(``)
          console.log(`To upgrade, run:`)
          console.log(`  npm install -g hyperliquid-cli@${latest}`)
        } else {
          console.log(``)
          outputSuccess("No newer published version is available.")
        }
      }
    })
}
