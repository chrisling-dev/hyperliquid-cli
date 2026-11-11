#!/usr/bin/env node
import { createProgram } from "./cli/program.js"
const program = createProgram()
try {
  await program.parseAsync()
} catch (error) {
  // Do not print input-bearing SDK validation objects or signing credentials.
  const message = error instanceof Error ? error.message : "Command failed"
  process.stderr.write(JSON.stringify({ error: message }) + "\n")
  process.exitCode = 1
}
