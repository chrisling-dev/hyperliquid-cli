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
  hasAccount(): boolean;
  requiresAccountSetup(): boolean;
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
          if (config.account?.type === "readonly") {
            throw new Error(
              `Account "${config.account.alias}" is read-only and cannot perform trading operations.\n` +
              "Run 'hl account add' to set up an API wallet for trading."
            );
          }
          throw new Error(
            "No account configured. Run 'hl account add' to set up your account."
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
        "No account configured. Run 'hl account add' to set up your account."
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

    hasAccount(): boolean {
      return !!(config.walletAddress || config.privateKey);
    },

    requiresAccountSetup(): boolean {
      return !config.walletAddress && !config.privateKey;
    },
  };
}
