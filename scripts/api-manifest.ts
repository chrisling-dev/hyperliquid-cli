import { writeFile, readFile } from "node:fs/promises"
import { methods, manifest } from "../src/api/registry.js"
const path = new URL("../api-manifest.json", import.meta.url)
const content =
  JSON.stringify({ sdk: "0.33.3", methods: methods.map(manifest) }, null, 2) +
  "\n"
if (process.argv.includes("--check")) {
  if ((await readFile(path, "utf8")) !== content)
    throw new Error(
      "API manifest changed. Run pnpm api:manifest and review the diff.",
    )
} else await writeFile(path, content)
