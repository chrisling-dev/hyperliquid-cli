#!/usr/bin/env node
import { formatError } from "./cli/errors.js"
import { createProgram } from "./cli/program.js"
const program = createProgram()
try {
  await program.parseAsync()
} catch (error) {
  // Do not print input-bearing SDK validation objects or signing credentials.
  process.stderr.write(formatError(error, { json: !!program.opts().json }))
  process.exitCode = 1
}
