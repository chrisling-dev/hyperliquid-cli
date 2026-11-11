import {
  type Method,
  type Schema,
  inputFields,
  requiredInputs,
  describeSchema,
  description,
  isOptional,
  unwrap,
} from "./registry.js"

export function inputSchema(method: Method) {
  const required = requiredInputs(method)
  return Object.fromEntries(
    Object.entries(inputFields(method)).map(([name, schema]) => {
      const { optional: _optional, ...details } = describeSchema(
        schema,
      ) as Record<string, unknown>
      return [
        name,
        {
          required: required.includes(name),
          ...details,
          ...(name === "user"
            ? { default: "Selected account's user address, when available" }
            : {}),
        },
      ]
    }),
  )
}
export function parameterType(schema: Schema): string {
  const base = unwrap(schema)
  let type: string
  if (base.type === "literal") type = JSON.stringify(base.literal)
  else if (base.options)
    type = base.options
      .map((option) =>
        typeof option === "object"
          ? parameterType(option)
          : JSON.stringify(option),
      )
      .join(" | ")
  else if (base.item) type = `array<${parameterType(base.item)}>`
  else if (base.items) type = `[${base.items.map(parameterType).join(", ")}]`
  else type = base.type
  return ["nullable", "nullish"].includes(schema.type) ? `${type} | null` : type
}
export function formatParameterHelp(method: Method): string {
  const required = requiredInputs(method)
  const lines = [`hl ${method.family} ${method.name}`, "", "Parameters:"]
  function append(
    name: string,
    schema: Schema,
    requirement: string,
    indent = "  ",
  ) {
    const base = unwrap(schema)
    const complex =
      base.entries ||
      base.item ||
      base.items ||
      base.options?.some(
        (o) =>
          typeof o === "object" && (unwrap(o).entries || unwrap(o).options),
      )
    const type = complex ? base.type : parameterType(schema)
    lines.push(`${indent}${name}  ${requirement}  ${type}`)
    if (description(schema)) lines.push(`${indent}  ${description(schema)}`)
    if (schema.default !== undefined && typeof schema.default !== "function")
      lines.push(`${indent}  Default: ${JSON.stringify(schema.default)}`)
    if (base.entries)
      for (const [key, child] of Object.entries(base.entries))
        append(
          key,
          child,
          isOptional(child) ? "optional" : "required",
          `${indent}  `,
        )
    if (base.item) append("item", base.item, "", `${indent}  `)
    if (base.items)
      base.items.forEach((item, index) =>
        append(`[${index}]`, item, "required", `${indent}  `),
      )
    if (complex && base.options)
      base.options.forEach((option, index) => {
        if (typeof option === "object")
          append(
            `alternative ${index + 1}`,
            option,
            "choose one",
            `${indent}  `,
          )
      })
  }
  for (const [name, schema] of Object.entries(inputFields(method))) {
    append(
      name,
      schema,
      required.includes(name)
        ? "required"
        : isOptional(schema)
          ? "optional"
          : "variant",
    )
    if (name === "user")
      lines.push(
        "    Defaults to the selected account's user address, when available.",
      )
  }
  if (!Object.keys(inputFields(method)).length) lines.push("  None.")
  lines.push(
    "",
    "Supply parameters as named flags, --data '<JSON object>', or --input <file|->.",
  )
  return lines.join("\n")
}
