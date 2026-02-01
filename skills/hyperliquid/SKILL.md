---
name: hyperliquid
description: Trade crypto, stocks (AAPL, NVDA, TSLA), indexes, and commodities (GOLD, SILVER) 24/7 on Hyperliquid via HIP-3. Real-time position & P&L tracking, orderbook monitoring, multi-account management, and websocket client for sub-5ms low-latency high-frequency trading.
emoji: 🦞
homepage: https://github.com/chrisling-dev/hyperliquid-cli

requires:
  bins:
    - hl
  env:
    - HYPERLIQUID_PRIVATE_KEY

install:
  - npm install -g hyperliquid-cli

config:
  requiredEnv:
    - name: HYPERLIQUID_PRIVATE_KEY
      description: Private key for trading (hex string starting with 0x)
  stateDirs:
    - ~/.hyperliquid
---

# Hyperliquid CLI Skill

Trade crypto perpetuals and HIP3 traditional assets (stocks, commodities) on Hyperliquid DEX from the command line.

## What This Skill Does

This skill enables you to:

- **Trade Crypto Perpetuals** - BTC, ETH, SOL, and 100+ other assets with up to 50x leverage
- **Trade Traditional Assets via HIP3** - Stocks (AAPL, NVDA, TSLA, GOOGL) and commodities (GOLD, SILVER) with crypto-style 24/7 trading
- **Monitor Positions in Real-Time** - WebSocket-powered live updates with color-coded PnL
- **Manage Multiple Accounts** - Store and switch between trading accounts
- **Use High-Performance Server Mode** - Sub-5ms latency with persistent connections

## Setup Instructions

### 1. Check if CLI is Installed

```bash
which hl
```

If not found, install it:

```bash
npm install -g hyperliquid-cli
```

### 2. Verify Installation

```bash
hl --version
hl --help
```

### 3. Set Up API Key for Trading

To execute trades, you need a Hyperliquid API wallet:

1. Go to https://app.hyperliquid.xyz/API
2. Create a new API wallet (or use an existing one)
3. Export the private key (starts with `0x`)
4. Set the environment variable:

```bash
export HYPERLIQUID_PRIVATE_KEY=0x...your_private_key...
```

Or add an account to local storage:

```bash
hl account add
# Follow the interactive prompts
```

## Starting the Server (Recommended)

For best performance, start the background server before trading:

```bash
hl server start
hl server status  # Verify it's running
```

The server provides:

- Persistent WebSocket connections to Hyperliquid
- In-memory caching of market data
- ~20-50x faster response times
- Sub-5ms latency for queries

Stop when done:

```bash
hl server stop
```

## Key Innovations

### HIP3 Traditional Assets

Hyperliquid's HIP3 enables trading traditional assets with crypto primitives:

- **Stocks**: AAPL, NVDA, TSLA, GOOGL, AMZN, META, MSFT
- **Commodities**: GOLD, SILVER
- **24/7 Trading**: Unlike traditional markets, trade anytime
- **Crypto Leverage**: Use leverage like crypto perpetuals
- **Same Interface**: Use identical commands as crypto trading

```bash
# Check Apple stock price
hl asset price AAPL

# Buy 10 shares of NVIDIA
hl order limit buy 10 NVDA 140

# View order book for Gold
hl asset book GOLD
```

### Server Performance

The background server dramatically improves performance:

| Operation       | Without Server | With Server |
| --------------- | -------------- | ----------- |
| Price Query     | ~200ms         | ~5ms        |
| Order Placement | ~300ms         | ~50ms       |
| Position Fetch  | ~250ms         | ~10ms       |

## Quick Command Reference

### Account Management

```bash
hl account add          # Add new account (interactive)
hl account ls           # List all accounts
hl account set-default  # Change default account
hl account remove       # Remove an account
```

### Viewing Data

```bash
hl account positions           # View positions
hl account positions -w        # Watch mode (real-time)
hl account orders              # View open orders
hl account balances            # View balances
hl account portfolio           # Combined positions + balances
```

### Trading

```bash
# Limit orders
hl order limit buy 0.001 BTC 50000
hl order limit sell 1 ETH 3500 --tif Gtc

# Market orders
hl order market buy 0.001 BTC
hl order market sell 0.1 ETH --slippage 0.5

# Cancel orders
hl order cancel          # Interactive selection
hl order cancel <oid>    # Cancel specific order
hl order cancel-all      # Cancel all orders

# Set leverage
hl order set-leverage BTC 10
```

### Market Data

```bash
hl markets ls            # List all markets
hl asset price BTC       # Get price
hl asset price BTC -w    # Watch price
hl asset book ETH        # Order book
hl asset book ETH -w     # Watch order book
```

### Server Management

```bash
hl server start          # Start background server
hl server stop           # Stop server
hl server status         # Check server status
```

## Global Options

| Option       | Description                           |
| ------------ | ------------------------------------- |
| `--json`     | Output in JSON format (for scripting) |
| `--testnet`  | Use testnet instead of mainnet        |
| `-h, --help` | Show help                             |

## Prompting for API Keys

When a user needs to set up trading, guide them through this process:

1. **Check current setup**: Run `hl account ls` to see if accounts exist
2. **If no accounts**: Guide them to https://app.hyperliquid.xyz/API
3. **Explain wallet types**:
   - **API Wallet**: For trading (requires private key)
   - **Read-only**: For monitoring only (just address needed)
4. **Security reminder**: Never share private keys; store securely

Example prompt to user:

> To trade on Hyperliquid, you'll need an API wallet. Here's how to set it up:
>
> 1. Go to https://app.hyperliquid.xyz/API
> 2. Click "Create API Wallet" (you can name it anything)
> 3. Copy the private key (starts with 0x)
> 4. Run `hl account add` and paste it when prompted
>
> Would you like me to walk you through this?

## Further Reading

See [reference.md](./reference.md) for complete command documentation and [examples.md](./examples.md) for workflow examples.
