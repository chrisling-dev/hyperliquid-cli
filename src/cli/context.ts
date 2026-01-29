import {
  HttpTransport,
  InfoClient,
  ExchangeClient,
} from "@nktkas/hyperliquid";
import { privateKeyToAccount } from "viem/accounts";
import type { Config } from "../lib/config.js";
import type { Address, Hex } from "viem";
import { ServerClient, tryConnectToServer } from "../client/index.js";

export interface CLIContext {
  config: Config;
  getPublicClient(): InfoClient;
  getWalletClient(): ExchangeClient;
  getWalletAddress(): Address;
  getServerClient(): Promise<ServerClient | null>;
}

export function createContext(config: Config): CLIContext {
  let publicClient: InfoClient | null = null;
  let walletClient: ExchangeClient | null = null;
  let serverClient: ServerClient | null | undefined = undefined; // undefined = not checked yet

  const transport = new HttpTransport({
    isTestnet: config.testnet,
  });

  return {
    config,

    getPublicClient(): InfoClient {
      if (!publicClient) {
        publicClient = new InfoClient({ transport });
      }
      return publicClient;
    },

    getWalletClient(): ExchangeClient {
      if (!walletClient) {
        if (!config.privateKey) {
          throw new Error(
            "HYPERLIQUID_PRIVATE_KEY environment variable is required for this command"
          );
        }
        const account = privateKeyToAccount(config.privateKey as Hex);
        walletClient = new ExchangeClient({ transport, wallet: account });
      }
      return walletClient;
    },

    getWalletAddress(): Address {
      if (config.walletAddress) {
        return config.walletAddress;
      }
      if (config.privateKey) {
        const account = privateKeyToAccount(config.privateKey as Hex);
        return account.address;
      }
      throw new Error(
        "HYPERLIQUID_PRIVATE_KEY or HYPERLIQUID_WALLET_ADDRESS environment variable is required"
      );
    },

    async getServerClient(): Promise<ServerClient | null> {
      // Return cached result if already checked
      if (serverClient !== undefined) {
        return serverClient;
      }
      // Try to connect to server
      serverClient = await tryConnectToServer();
      return serverClient;
    },
  };
}
