import { fileURLToPath } from "node:url"
import { Command } from "commander"
import { readFile, writeFile } from "node:fs/promises"
import { audit, fetchSnapshot, type Snapshot } from "./lib/api-audit.js"
const program = new Command().name("npm run api:audit --")
program
  .description(
    "Deterministically report missing methods, fields, and documentation drift",
  )
  .option(
    "--snapshot <file>",
    "Audit a saved docs snapshot offline instead of fetching live docs",
  )
  .option(
    "--baseline <file>",
    "Compare with a previous docs snapshot for changed requests",
    fileURLToPath(new URL("../api-docs-snapshot.json", import.meta.url)),
  )
  .option("--save <file>", "Save fetched/input docs for reproducible audits")
  .addHelpText(
    "after",
    "\nExit codes: 0 coverage checks pass; 2 outdated/review required; 3 inconclusive parser coverage.\nDefaults to the documentation reviewed snapshot in this repository.\nUnparsed sections are reported explicitly; SDK-only methods are marked unverified.\n",
  )
  .action(async function (this: Command) {
    const o = this.opts()
    const snapshot: Snapshot = o.snapshot
      ? JSON.parse(await readFile(o.snapshot, "utf8"))
      : await fetchSnapshot()
    const baseline: Snapshot | undefined = o.baseline
      ? JSON.parse(await readFile(o.baseline, "utf8"))
      : undefined
    const report = audit(snapshot, baseline)
    if (o.save)
      await writeFile(o.save, JSON.stringify(snapshot, null, 2) + "\n")
    console.log(JSON.stringify(report, null, 2))
    process.exitCode = report.errors.length
      ? 3
      : report.status === "covered"
        ? 0
        : 2
  })

try {
  await program.parseAsync()
} catch (error) {
  console.error(
    JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    }),
  )
  process.exitCode = 1
}
