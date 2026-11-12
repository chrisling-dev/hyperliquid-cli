import { HttpTransport, InfoClient } from "@nktkas/hyperliquid"
import { customVariants } from "./extensions.js"
import { signL1Action } from "@nktkas/hyperliquid/signing"
import type { Address } from "viem"
import { privateKeyToAccount } from "viem/accounts"
import type { Config } from "../lib/config.js"
import { getDb } from "../lib/db/index.js"
import { type Method, modules, inputFields, validateInput } from "./registry.js"

export function resolveInput(
  method: Method,
  data: Record<string, unknown>,
  config: Config,
) {
  const result = { ...data }
  if (
    "user" in inputFields(method) &&
    result.user === undefined &&
    config.walletAddress
  )
    result.user = config.walletAddress
  return validateInput(method, result)
}
export function assertPermission(method: Method, config: Config): void {
  if (
    ["activateOutcomeDeployer", "outcomeDeploy"].includes(method.name) &&
    !config.testnet
  )
    throw new Error(`${method.name} is currently documented as testnet-only`)
  if (method.permission === "public") return
  if (!config.privateKey || config.account?.type === "readonly")
    throw new Error(
      `${method.name} requires a signing account; selected account is read-only or absent. Use --account <alias>.`,
    )
  if (method.permission === "master" && config.account?.type !== "master")
    throw new Error(
      `${method.name} requires a master wallet; an agent wallet cannot perform this action.`,
    )
}
export function nextNonce(signer: string, testnet: boolean): number {
  const db = getDb()
  return db
    .transaction(() => {
      const key = `${testnet}:${signer.toLowerCase()}`
      const previous = db
        .prepare("SELECT value FROM nonces WHERE signer = ?")
        .get(key) as { value: number } | undefined
      const value = Math.max(Date.now(), (previous?.value ?? 0) + 1)
      db.prepare(
        "INSERT INTO nonces(signer,value) VALUES(?,?) ON CONFLICT(signer) DO UPDATE SET value=excluded.value",
      ).run(key, value)
      return value
    })
    .immediate()
}
export async function execute(
  method: Method,
  params: Record<string, unknown>,
  config: Config,
  opts: { vaultAddress?: string; expiresAfter?: number } = {},
) {
  const transport = new HttpTransport({ isTestnet: config.testnet })
  if (method.family === "info")
    return transport.request("info", { type: method.name, ...params })
  assertPermission(method, config)
  if (opts.vaultAddress && !method.vault)
    throw new Error(`${method.name} does not support an execution vault`)
  if (opts.expiresAfter !== undefined && !method.expires)
    throw new Error(`${method.name} does not support expiresAfter`)
  const wallet = privateKeyToAccount(config.privateKey!)
  // Confirm the live role before signing: local labels alone do not prove delegation.
  const role = await new InfoClient({ transport }).userRole({
    user: wallet.address,
  })
  if (config.account?.type === "api_wallet") {
    if (
      role.role !== "agent" ||
      role.data.user.toLowerCase() !== config.walletAddress?.toLowerCase()
    )
      throw new Error(
        "Agent wallet is not approved for the selected user on this network",
      )
  } else if (
    role.role === "agent" ||
    wallet.address.toLowerCase() !== config.walletAddress?.toLowerCase()
  ) {
    throw new Error(
      "Selected master key is an agent or does not match the user address",
    )
  }
  if (
    method.schemaName === "extension" &&
    (!customVariants[method.name] ||
      customVariants[method.name].some((key) => key in params))
  ) {
    const nonce = nextNonce(wallet.address, config.testnet)
    const action = { type: method.name, ...params }
    const signature = await signL1Action({
      wallet,
      action,
      nonce,
      isTestnet: config.testnet,
      vaultAddress: opts.vaultAddress as Address | undefined,
      expiresAfter: opts.expiresAfter,
    })
    const result = (await transport.request("exchange", {
      action,
      nonce,
      signature,
      ...opts,
    })) as { status: string; response: unknown }
    if (result.status === "err")
      throw new Error(
        `Exchange rejected action: ${JSON.stringify(result.response)}`,
      )
    return result
  }
  const adapter = modules.exchange[method.sdkName] as (
    ...args: unknown[]
  ) => Promise<unknown>
  const sdkConfig = {
    transport,
    wallet,
    nonceManager: (address: string) => nextNonce(address, config.testnet),
  }
  if (["agentEnableDexAbstraction", "claimRewards"].includes(method.sdkName))
    return adapter(sdkConfig, opts)
  if (method.sdkName === "scheduleCancel" && params.time === undefined)
    return adapter(sdkConfig, opts)
  return adapter(sdkConfig, params, opts)
}
