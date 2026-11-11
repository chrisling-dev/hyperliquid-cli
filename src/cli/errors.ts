/** User-facing failures with an optional explanation and a concrete next step. */
export class CLIError extends Error {
  constructor(
    message: string,
    readonly detail?: string,
    readonly hint?: string,
  ) {
    super(message)
    this.name = "CLIError"
  }
}

export function errorColorsEnabled(
  isTTY = process.stderr.isTTY,
  env = process.env,
): boolean {
  return !!isTTY && env.NO_COLOR === undefined && env.TERM !== "dumb"
}

export function formatError(
  error: unknown,
  options: { json?: boolean; color?: boolean } = {},
): string {
  const message = error instanceof Error ? error.message : "Command failed"
  const detail = error instanceof CLIError ? error.detail : undefined
  const hint = error instanceof CLIError ? error.hint : undefined
  if (options.json)
    return (
      JSON.stringify({
        error: message,
        ...(detail ? { detail } : {}),
        ...(hint ? { hint } : {}),
      }) + "\n"
    )
  const color = options.color ?? errorColorsEnabled()
  const label = color ? "\x1b[1;31mError\x1b[0m" : "Error"
  const next = color ? "\x1b[36mTry\x1b[0m" : "Try"
  return (
    [
      `${label}: ${message}`,
      ...(detail ? [`\n  ${detail}`] : []),
      ...(hint ? [`\n  ${next}: ${hint}`] : []),
    ].join("\n") + "\n"
  )
}
