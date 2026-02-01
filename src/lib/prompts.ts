import {
  input,
  select as inquirerSelect,
  confirm as inquirerConfirm,
  checkbox,
} from "@inquirer/prompts"
import { inquirerTheme } from "../cli/ink/theme.js"

/**
 * Prompt for text input
 */
export async function prompt(question: string): Promise<string> {
  const answer = await input({
    message: question,
    theme: inquirerTheme,
  })
  return answer.trim()
}

/**
 * Prompt for selection from a list of options with arrow key navigation
 */
export async function select<T extends string>(
  question: string,
  options: { value: T; label: string; description?: string }[]
): Promise<T> {
  const result = await inquirerSelect({
    message: question,
    choices: options.map((opt) => ({
      value: opt.value,
      name: opt.label,
      description: opt.description,
    })),
    theme: inquirerTheme,
  })
  return result
}

/**
 * Prompt for multiple selections with checkboxes
 */
export async function multiSelect<T extends string>(
  question: string,
  options: { value: T; label: string; description?: string }[]
): Promise<T[]> {
  const results = await checkbox({
    message: question,
    choices: options.map((opt) => ({
      value: opt.value,
      name: opt.label,
      description: opt.description,
    })),
    theme: inquirerTheme,
  })
  return results
}

/**
 * Prompt for yes/no confirmation
 */
export async function confirm(question: string, defaultValue: boolean = false): Promise<boolean> {
  return inquirerConfirm({
    message: question,
    default: defaultValue,
    theme: inquirerTheme,
  })
}

/**
 * Wait for user to press Enter
 */
export async function waitForEnter(message: string = "Press Enter to continue..."): Promise<void> {
  await input({
    message,
    theme: {
      ...inquirerTheme,
      prefix: {
        idle: "\x1b[33m→\x1b[0m",
        done: "\x1b[32m✔\x1b[0m",
      },
    },
  })
}

/**
 * Wait for user to press Enter (returns true) or Escape (returns false)
 */
export async function pressEnterOrEsc(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    console.log(`\x1b[33m→\x1b[0m ${message}`)

    const stdin = process.stdin
    const wasRaw = stdin.isRaw
    stdin.setRawMode(true)
    stdin.resume()

    const onData = (key: Buffer) => {
      const char = key.toString()
      // Enter key
      if (char === "\r" || char === "\n") {
        cleanup()
        console.log("\x1b[32m✔\x1b[0m Opening browser...")
        resolve(true)
      }
      // Escape key
      else if (char === "\x1b") {
        cleanup()
        console.log("\x1b[90m✔\x1b[0m Skipped")
        resolve(false)
      }
      // Ctrl+C
      else if (char === "\x03") {
        cleanup()
        process.exit(0)
      }
    }

    const cleanup = () => {
      stdin.removeListener("data", onData)
      stdin.setRawMode(wasRaw)
      stdin.pause()
    }

    stdin.on("data", onData)
  })
}
