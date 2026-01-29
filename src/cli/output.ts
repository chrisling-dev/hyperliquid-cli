export interface OutputOptions {
  json: boolean;
}

export function output(data: unknown, options: OutputOptions): void {
  if (options.json) {
    console.log(JSON.stringify(data, null, 2));
  } else {
    if (typeof data === "string") {
      console.log(data);
    } else if (Array.isArray(data)) {
      formatArray(data);
    } else if (typeof data === "object" && data !== null) {
      formatObject(data as Record<string, unknown>);
    } else {
      console.log(data);
    }
  }
}

function formatArray(arr: unknown[]): void {
  if (arr.length === 0) {
    console.log("(empty)");
    return;
  }

  const first = arr[0];
  if (typeof first === "object" && first !== null) {
    // Table format for array of objects
    const keys = Object.keys(first);
    const widths = keys.map((k) =>
      Math.max(
        k.length,
        ...arr.map((item) => {
          const val = (item as Record<string, unknown>)[k];
          return String(val ?? "").length;
        })
      )
    );

    // Header
    console.log(keys.map((k, i) => k.padEnd(widths[i])).join("  "));
    console.log(widths.map((w) => "-".repeat(w)).join("  "));

    // Rows
    for (const item of arr) {
      const row = keys.map((k, i) => {
        const val = (item as Record<string, unknown>)[k];
        return String(val ?? "").padEnd(widths[i]);
      });
      console.log(row.join("  "));
    }
  } else {
    // Simple list
    for (const item of arr) {
      console.log(item);
    }
  }
}

function formatObject(obj: Record<string, unknown>, indent = 0): void {
  const prefix = "  ".repeat(indent);
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      console.log(`${prefix}${key}:`);
      formatObject(value as Record<string, unknown>, indent + 1);
    } else if (Array.isArray(value)) {
      console.log(`${prefix}${key}: [${value.length} items]`);
    } else {
      console.log(`${prefix}${key}: ${value}`);
    }
  }
}

export function outputError(message: string): void {
  console.error(`Error: ${message}`);
}

export function outputSuccess(message: string): void {
  console.log(message);
}

/**
 * Format an array of objects as a table string (for watch mode display)
 * Returns the formatted string instead of printing to console
 */
export function formatArrayAsTable(arr: unknown[]): string {
  if (arr.length === 0) {
    return "(empty)"
  }

  const first = arr[0]
  if (typeof first !== "object" || first === null) {
    return arr.map(String).join("\n")
  }

  const keys = Object.keys(first)
  const widths = keys.map((k) =>
    Math.max(
      k.length,
      ...arr.map((item) => {
        const val = (item as Record<string, unknown>)[k]
        return String(val ?? "").length
      }),
    ),
  )

  const lines: string[] = []

  // Header
  lines.push(keys.map((k, i) => k.padEnd(widths[i])).join("  "))
  // Separator
  lines.push(widths.map((w) => "-".repeat(w)).join("  "))

  // Rows
  for (const item of arr) {
    const row = keys.map((k, i) => {
      const val = (item as Record<string, unknown>)[k]
      return String(val ?? "").padEnd(widths[i])
    })
    lines.push(row.join("  "))
  }

  return lines.join("\n")
}
