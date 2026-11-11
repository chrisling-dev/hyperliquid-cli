import { CLIError } from "../cli/errors.js"
import * as info from "@nktkas/hyperliquid/api/info"
import * as exchange from "@nktkas/hyperliquid/api/exchange"
import * as subscriptions from "@nktkas/hyperliquid/api/subscription"
import * as v from "valibot"
import { extensions, deployerExtensions } from "./extensions.js"

// SDK request schemas are the source for flags, validation and discoverable schemas.
// This structural interface deliberately avoids depending on individual Valibot generic types.
export interface Schema {
  type: string
  entries?: Record<string, Schema>
  wrapped?: Schema
  options?: (Schema | string | number)[]
  item?: Schema
  items?: Schema[]
  literal?: unknown
  pipe?: { type: string; description?: string }[]
  default?: unknown
}
export type Family = "info" | "ws" | "exchange"
export type Permission = "public" | "agent" | "master"
export interface Method {
  family: Family
  name: string
  sdkName: string
  schemaName: string
  schema: Schema
  payload: Schema
  permission: Permission
  description: string
  vault: boolean
  expires: boolean
  userSigned: boolean
}
export const modules = {
  info,
  exchange,
  ws: subscriptions,
} as unknown as Record<Family, Record<string, unknown>>
// Agent authorization is action-specific, not inferred from the L1 signing scheme.
const agentActions = new Set([
  "order",
  "cancel",
  "cancelByCloid",
  "batchModify",
  "modify",
  "scheduleCancel",
  "updateLeverage",
  "updateIsolatedMargin",
  "topUpIsolatedOnlyMargin",
  "twapOrder",
  "twapCancel",
  "noop",
  "agentEnableDexAbstraction",
  "agentSetAbstraction",
  "agentSendAsset",
])
export const unwrap = (s: Schema): Schema => (s.wrapped ? unwrap(s.wrapped) : s)
export function fields(s: Schema): Record<string, Schema> {
  const base = unwrap(s)
  return (
    base.entries ??
    Object.assign(
      {},
      ...(base.options ?? [])
        .filter((x) => typeof x === "object")
        .map((x) => fields(x as Schema)),
    )
  )
}
export function description(s: Schema): string {
  return (
    s.pipe
      ?.filter((p) => p.type === "description")
      .map((p) => p.description)
      .join(" ") || (s.wrapped ? description(s.wrapped) : "")
  )
}
function discriminator(s: Schema): string | undefined {
  const value = fields(s).type?.literal
  return typeof value === "string" ? value : undefined
}
export const methods: Method[] = (
  ["info", "ws", "exchange"] as Family[]
).flatMap((family) => {
  const mod = modules[family]
  return Object.entries(mod)
    .filter(([name]) => name.endsWith("Request"))
    .map(([schemaName, value]) => {
      const schema = value as Schema
      const payload = family === "exchange" ? schema.entries!.action : schema
      const sdkName = schemaName[0].toLowerCase() + schemaName.slice(1, -7)
      if (typeof mod[sdkName] !== "function")
        throw new Error(`Missing SDK adapter: ${family}.${sdkName}`)
      const userSigned = "signatureChainId" in fields(payload)
      return {
        family,
        name:
          sdkName === "activeSpotAssetCtx"
            ? sdkName
            : (discriminator(payload) ?? sdkName),
        sdkName,
        schemaName,
        schema,
        payload,
        permission:
          family !== "exchange"
            ? "public"
            : agentActions.has(sdkName)
              ? "agent"
              : "master",
        description: description(schema) || `${family} ${sdkName}`,
        vault: !!schema.entries?.vaultAddress,
        expires: !!schema.entries?.expiresAfter,
        userSigned,
      } as Method
    })
    .sort((a, b) => a.name.localeCompare(b.name))
})
for (const extension of [...extensions, ...deployerExtensions]) {
  const old = methods.findIndex(
    (m) => m.family === extension.family && m.name === extension.name,
  )
  if (old >= 0) methods.splice(old, 1)
  const schema = extension.schema as unknown as Schema
  methods.push({
    family: extension.family,
    name: extension.name,
    sdkName: extension.name,
    schemaName: "extension",
    schema,
    payload: extension.family === "exchange" ? schema.entries!.action : schema,
    permission: extension.permission,
    description: extension.description,
    vault: !!schema.entries?.vaultAddress,
    expires: !!schema.entries?.expiresAfter,
    userSigned: false,
  })
}
for (const method of methods) {
  if (method.family === "info" && method.name === "allPerpMetas")
    method.description = "Retrieve perpetual metadata across all DEXs in one request; includes HIP-3 venues."
  if (method.family === "ws" && method.name === "allDexsAssetCtxs")
    method.description = "Stream asset contexts across all perpetual DEXs in one subscription; grouped by DEX."
  if (method.family === "info" && ["meta", "metaAndAssetCtxs"].includes(method.name))
    method.description += " Single DEX only. For all venues use info allPerpMetas and ws allDexsAssetCtxs; ALL_DEXS is not supported here."
}
export function getMethod(family: string, name: string): Method {
  const method = methods.find((m) => m.family === family && m.name === name)
  if (!method)
    throw new Error(
      `Unknown method ${family} ${name}. Run hl ${family} --help.`,
    )
  return method
}
export function systemFields(m: Method): Set<string> {
  return new Set([
    "type",
    ...(m.userSigned
      ? ["signatureChainId", "hyperliquidChain", "nonce", "time"]
      : []),
    ...(["agentSendAsset", "createVault"].includes(m.sdkName) ? ["nonce"] : []),
  ])
}
export function inputFields(m: Method): Record<string, Schema> {
  const entries = Object.fromEntries(
    Object.entries(fields(m.payload)).filter(([k]) => !systemFields(m).has(k)),
  )
  if (m.sdkName === "noop") entries.nonce = { type: "number" }
  return entries
}
export function describeSchema(s: Schema): unknown {
  const b = unwrap(s)
  return {
    type: b.type,
    optional: ["optional", "nullish", "undefinedable"].includes(s.type),
    ...(description(s) ? { description: description(s) } : {}),
    ...(s.default !== undefined && typeof s.default !== "function"
      ? { default: s.default }
      : {}),
    ...(b.literal !== undefined ? { const: b.literal } : {}),
    ...(b.entries
      ? {
          properties: Object.fromEntries(
            Object.entries(b.entries).map(([k, x]) => [k, describeSchema(x)]),
          ),
        }
      : {}),
    ...(b.item ? { items: describeSchema(b.item) } : {}),
    ...(b.items ? { prefixItems: b.items.map(describeSchema) } : {}),
    ...(b.options
      ? {
          options: b.options.map((x) =>
            typeof x === "object" ? describeSchema(x) : x,
          ),
        }
      : {}),
  }
}
export function manifest(m: Method) {
  return {
    family: m.family,
    name: m.name,
    sdkName: m.sdkName,
    permission: m.permission,
    description: m.description,
    vault: m.vault,
    expires: m.expires,
    userSigned: m.userSigned,
    parameters: Object.fromEntries(
      Object.entries(inputFields(m)).map(([k, s]) => [k, describeSchema(s)]),
    ),
    request: describeSchema(m.schema),
  }
}
export function parseFlag(text: string, schema: Schema): unknown {
  const s = unwrap(schema)
  if (
    s.type === "string" ||
    (s.type === "picklist" && s.options?.every((x) => typeof x === "string")) ||
    (s.type === "literal" && typeof s.literal === "string")
  )
    return text
  if (
    s.type === "union" &&
    v.safeParse(schema as unknown as v.GenericSchema, text).success
  )
    return text
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Expected JSON ${s.type}, got invalid input`)
  }
}
// Reject unknown keys instead of allowing Valibot's object schemas to silently strip them.
function checkKeys(schema: Schema, value: unknown, path = ""): void {
  const b = unwrap(schema)
  if (!value || typeof value !== "object") return
  if (Array.isArray(value)) {
    if (b.items)
      value.forEach((x, i) => {
        if (b.items![i]) checkKeys(b.items![i], x, `${path}[${i}].`)
      })
    if (b.item) value.forEach((x, i) => checkKeys(b.item!, x, `${path}[${i}]`))
    return
  }
  if (b.type === "union" || b.type === "variant") {
    const candidates = (b.options ?? []).filter(
      (option): option is Schema =>
        typeof option === "object" &&
        v.safeParse(option as unknown as v.GenericSchema, value).success,
    )
    if (candidates.length) {
      const errors: unknown[] = []
      for (const candidate of candidates) {
        try {
          checkKeys(candidate, value, path)
          return
        } catch (error) {
          errors.push(error)
        }
      }
      throw errors[0]
    }
  }
  const entries = fields(b)
  if (!Object.keys(entries).length) return
  for (const [key, child] of Object.entries(value)) {
    if (!entries[key]) throw new Error(`Unknown field: ${path}${key}`)
    checkKeys(entries[key], child, `${path}${key}.`)
  }
}
export function validateInput(
  m: Method,
  input: Record<string, unknown>,
): Record<string, unknown> {
  assertRequiredInputs(m, input)
  const allowed = inputFields(m)
  for (const key of Object.keys(input))
    if (!(key in allowed))
      throw new Error(`Unknown or system-managed field: ${key}`)
  if (m.sdkName === "noop") {
    if (!Number.isSafeInteger(input.nonce) || Number(input.nonce) < 0)
      throw new Error("nonce must be a non-negative safe integer")
    return input
  }
  const system: Record<string, unknown> = {
    type: discriminator(m.payload) ?? m.name,
  }
  if (m.userSigned)
    Object.assign(system, {
      signatureChainId: "0x66eee",
      hyperliquidChain: "Mainnet",
      nonce: 0,
      time: 0,
    })
  if (["agentSendAsset", "createVault"].includes(m.sdkName)) system.nonce = 0
  const full = { ...system, ...input }
  // Remove unused system placeholders before strict key checks.
  for (const k of Object.keys(system))
    if (!(k in fields(m.payload))) delete full[k]
  checkKeys(m.payload, full)
  const parsed = v.safeParse(m.payload as unknown as v.GenericSchema, full)
  if (!parsed.success)
    throw new Error(
      parsed.issues
        .map(
          (i) =>
            `${i.path?.map((p) => p.key).join(".") || "input"}: ${i.message}`,
        )
        .join("; "),
    )
  const result = parsed.output as Record<string, unknown>
  if (m.name === "l2" && m.family === "ws") {
    if (result.nSigFigs == null) delete result.nSigFigs
    if (result.mantissa == null) delete result.mantissa
  }
  return Object.fromEntries(
    Object.entries(result).filter(([k]) => !systemFields(m).has(k)),
  )
}

export function isOptional(schema: Schema): boolean {
  return ["optional", "nullish", "undefinedable", "exact_optional"].includes(
    schema.type,
  )
}
function commonRequired(schema: Schema): string[] {
  const base = unwrap(schema)
  if (base.entries)
    return Object.entries(base.entries)
      .filter(([, s]) => !isOptional(s))
      .map(([name]) => name)
  const alternatives = (base.options ?? [])
    .filter((s): s is Schema => typeof s === "object")
    .map(commonRequired)
  return alternatives.length
    ? alternatives[0].filter((name) =>
        alternatives.every((keys) => keys.includes(name)),
      )
    : []
}
export function requiredInputs(method: Method): string[] {
  if (method.sdkName === "noop") return ["nonce"]
  return commonRequired(method.payload).filter(
    (name) => name in inputFields(method),
  )
}
export function assertRequiredInputs(
  method: Method,
  input: Record<string, unknown>,
  allowAccountUser = false,
): void {
  const missing = requiredInputs(method).filter(
    (name) =>
      input[name] === undefined && !(allowAccountUser && name === "user"),
  )
  if (missing.length)
    throw new CLIError(
      `Missing required parameter${missing.length > 1 ? "s" : ""}: ${missing.map((name) => `--${name}`).join(", ")}`,
      `Supply ${missing.length > 1 ? "them" : "it"} as ${missing.length > 1 ? "flags" : "a flag"}, or in --data / --input.${missing.includes("user") ? " You can also select an account for --user." : ""}`,
      `hl ${method.family} ${method.name} --help`,
    )
}
