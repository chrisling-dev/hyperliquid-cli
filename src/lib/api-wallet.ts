import { generatePrivateKey, privateKeyToAccount } from "viem/accounts"
import { HttpTransport, InfoClient } from "@nktkas/hyperliquid"
import type { Address, Hex } from "viem"

/**
 * API wallet credentials
 */
export interface ApiWalletCredentials {
  privateKey: Hex
  publicKey: Address
}

/**
 * Generate a new API wallet (random private key)
 */
export function generateApiWallet(): ApiWalletCredentials {
  const privateKey = generatePrivateKey()
  const account = privateKeyToAccount(privateKey)

  return {
    privateKey,
    publicKey: account.address,
  }
}

/**
 * User role response types from Hyperliquid API
 */
export type UserRoleResponse =
  | { role: "missing" | "user" | "vault" }
  | { role: "agent"; data: { user: Address } }
  | { role: "subAccount"; data: { master: Address } }

/**
 * Check if an API wallet is approved as an agent for a user
 */
export async function checkApiWalletApproval(
  apiWalletAddress: Address,
  userAddress: Address,
  isTestnet: boolean = false
): Promise<{ approved: boolean; masterAddress?: Address }> {
  const transport = new HttpTransport({ isTestnet })
  const client = new InfoClient({ transport })

  try {
    const response = await client.userRole({ user: apiWalletAddress }) as UserRoleResponse

    if (response.role === "agent") {
      // Check if the agent is approved for the specified user
      const isApprovedForUser =
        response.data.user.toLowerCase() === userAddress.toLowerCase()
      return {
        approved: isApprovedForUser,
        masterAddress: response.data.user,
      }
    }

    return { approved: false }
  } catch {
    return { approved: false }
  }
}

/**
 * Get the Hyperliquid API approval URL
 */
export function getApprovalUrl(isTestnet: boolean = false): string {
  return isTestnet
    ? "https://app.hyperliquid-testnet.xyz/API"
    : "https://app.hyperliquid.xyz/API"
}

/**
 * Poll for API wallet approval with timeout
 * Returns true if approved, false if timed out
 */
export async function waitForApproval(
  apiWalletAddress: Address,
  userAddress: Address,
  isTestnet: boolean = false,
  pollIntervalMs: number = 3000,
  maxAttempts: number = 100 // About 5 minutes with 3s interval
): Promise<boolean> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await checkApiWalletApproval(
      apiWalletAddress,
      userAddress,
      isTestnet
    )

    if (result.approved) {
      return true
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }

  return false
}

/**
 * Get all extra agents (API wallets) for a user address
 */
export interface ExtraAgent {
  address: Address
  name: string
  validUntil: number
}

export async function getExtraAgents(
  userAddress: Address,
  isTestnet: boolean = false
): Promise<ExtraAgent[]> {
  const transport = new HttpTransport({ isTestnet })
  const client = new InfoClient({ transport })

  try {
    const response = await client.extraAgents({ user: userAddress })
    return response.map((agent) => ({
      address: agent.address as Address,
      name: agent.name,
      validUntil: agent.validUntil,
    }))
  } catch {
    return []
  }
}
