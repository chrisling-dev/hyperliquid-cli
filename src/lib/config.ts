import { privateKeyToAccount } from "viem/accounts";
import type { Hex, Address } from "viem";
import { getDefaultAccount, type Account } from "./db/index.js";

export interface Config {
  privateKey?: Hex;
  walletAddress?: Address;
  testnet: boolean;
  // Account info if loaded from database
  account?: {
    alias: string;
    type: "readonly" | "api_wallet";
  };
}

export function loadConfig(testnet: boolean): Config {
  // First, try to load from default account in database
  let defaultAccount: Account | null = null;
  try {
    defaultAccount = getDefaultAccount();
  } catch {
    // Database may not exist yet or other error - that's fine, fall back to env vars
  }

  if (defaultAccount) {
    return {
      privateKey: defaultAccount.apiWalletPrivateKey || undefined,
      walletAddress: defaultAccount.userAddress,
      testnet,
      account: {
        alias: defaultAccount.alias,
        type: defaultAccount.type,
      },
    };
  }

  // Fall back to environment variables
  const privateKey = process.env.HYPERLIQUID_PRIVATE_KEY as Hex | undefined;
  let walletAddress = process.env.HYPERLIQUID_WALLET_ADDRESS as
    | Address
    | undefined;

  if (privateKey && !walletAddress) {
    const account = privateKeyToAccount(privateKey);
    walletAddress = account.address;
  }

  return {
    privateKey,
    walletAddress,
    testnet,
  };
}
