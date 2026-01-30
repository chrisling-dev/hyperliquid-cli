import * as readline from "node:readline"

/**
 * Create a readline interface for prompting
 */
function createReadline(): readline.Interface {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })
}

/**
 * Prompt for text input
 */
export function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createReadline()
    rl.question(question, (answer) => {
      rl.close()
      resolve(answer.trim())
    })
  })
}

/**
 * Prompt for selection from a list of options
 */
export async function select<T extends string>(
  question: string,
  options: { value: T; label: string }[]
): Promise<T> {
  console.log(question)
  options.forEach((opt, idx) => {
    console.log(`  ${idx + 1}. ${opt.label}`)
  })

  while (true) {
    const answer = await prompt("\nEnter your choice (number): ")
    const idx = parseInt(answer, 10) - 1

    if (idx >= 0 && idx < options.length) {
      return options[idx].value
    }

    console.log("Invalid choice. Please enter a valid number.")
  }
}

/**
 * Prompt for yes/no confirmation
 */
export async function confirm(question: string, defaultValue: boolean = false): Promise<boolean> {
  const hint = defaultValue ? "[Y/n]" : "[y/N]"
  const answer = await prompt(`${question} ${hint}: `)

  if (answer === "") {
    return defaultValue
  }

  return answer.toLowerCase() === "y" || answer.toLowerCase() === "yes"
}

/**
 * Wait for user to press Enter
 */
export function waitForEnter(message: string = "Press Enter to continue..."): Promise<void> {
  return new Promise((resolve) => {
    const rl = createReadline()
    rl.question(message, () => {
      rl.close()
      resolve()
    })
  })
}
