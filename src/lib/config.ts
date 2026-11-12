import { privateKeyToAccount } from "viem/accounts"
import type { Address, Hex } from "viem"
import {
  getAccountByAlias,
  getDefaultAccount,
  type AccountType,
} from "./db/index.js"

export interface Config {
  privateKey?: Hex
  walletAddress?: Address
  testnet: boolean
  account?: { alias: string; type: AccountType }
}
export function loadConfig(testnet: boolean, alias?: string): Config {
  const account = alias ? getAccountByAlias(alias) : getDefaultAccount()
  if (alias && !account)
    throw new Error(`Account "${alias}" not found. Run hl account ls.`)
  if (account)
    return {
      testnet,
      privateKey: account.apiWalletPrivateKey || undefined,
      walletAddress: account.userAddress,
      account: { alias: account.alias, type: account.type },
    }
  const privateKey = (process.env.HYPERLIQUID_PRIVATE_KEY || undefined) as
    | Hex
    | undefined
  const signer = privateKey
    ? privateKeyToAccount(privateKey).address
    : undefined
  const walletAddress = (process.env.HYPERLIQUID_WALLET_ADDRESS || signer) as
    | Address
    | undefined
  return {
    testnet,
    privateKey,
    walletAddress,
    account: walletAddress
      ? {
          alias: "environment",
          type: !privateKey
            ? "readonly"
            : signer?.toLowerCase() === walletAddress.toLowerCase()
              ? "master"
              : "api_wallet",
        }
      : undefined,
  }
}
