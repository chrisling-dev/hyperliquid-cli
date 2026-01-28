# Hyperliquid CLI

A command-line interface for [Hyperliquid DEX](https://hyperliquid.xyz/) built with the [@nktkas/hyperliquid](https://github.com/nktkas/hyperliquid) TypeScript SDK.

## Installation

```bash
npm install -g hyperliquid-cli
```

## Configuration

### Environment Variables

```bash
# Required for trading commands
export HYPERLIQUID_PRIVATE_KEY=0x...

# Optional: explicitly set wallet address (derived from key if not provided)
export HYPERLIQUID_WALLET_ADDRESS=0x...
```

### Global Options

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |
| `--testnet` | Use testnet instead of mainnet |
| `-V, --version` | Show version number |
| `-h, --help` | Show help |

## Commands

### Info Commands (Read-only, no authentication required)

#### Get Prices

```bash
# All assets
hl info prices

# Specific asset
hl info prices --pair BTC

# JSON output
hl info prices --pair ETH --json
```

#### Get Asset Metadata

```bash
hl info meta
hl info allPerpMetas
```

#### Get Full Market Data

```bash
# Includes prices, funding rates, open interest
hl info markets
```

#### Get Order Book

```bash
hl info book BTC
hl info book ETH --json
```

#### Get Account Positions

```bash
# Using configured wallet
hl info positions

# Using specific address
hl info positions --user 0x...
```

#### Get Open Orders

```bash
# Using configured wallet
hl info orders

# Using specific address
hl info orders --user 0x...
```

### Trade Commands (Requires authentication)

#### Place Orders

**Limit Order (default):**

```bash
hl trade order BTC buy 0.001 50000
hl trade order ETH sell 0.1 3500 --tif Gtc
hl trade order SOL buy 1 100 --reduce-only
```

**Market Order:**

```bash
hl trade order BTC buy 0.001 --type market
hl trade order ETH sell 0.1 --type market --slippage 0.5
```

**Stop-Loss Order:**

```bash
hl trade order BTC sell 0.001 48000 --type stop-loss --trigger 49000
hl trade order BTC sell 0.001 48000 --type stop-loss --trigger 49000 --tpsl
```

**Take-Profit Order:**

```bash
hl trade order BTC sell 0.001 55000 --type take-profit --trigger 54000
hl trade order BTC sell 0.001 55000 --type take-profit --trigger 54000 --tpsl
```

**Order Options:**

| Option | Description |
|--------|-------------|
| `--type <type>` | Order type: `limit` (default), `market`, `stop-loss`, `take-profit` |
| `--tif <tif>` | Time-in-force: `Gtc` (default), `Ioc`, `Alo` |
| `--reduce-only` | Reduce-only order |
| `--slippage <pct>` | Slippage percentage for market orders (default: 1%) |
| `--trigger <price>` | Trigger price for stop-loss/take-profit orders |
| `--tpsl` | Mark as TP/SL order for position management |

#### Cancel Orders

```bash
hl trade cancel BTC 12345
```

#### Set Leverage

```bash
# Cross margin (default)
hl trade leverage BTC 10

# Isolated margin
hl trade leverage BTC 10 --isolated

# Explicit cross margin
hl trade leverage ETH 5 --cross
```

### Referral Commands

#### Set Referral Code

```bash
hl referral set MYCODE
```

#### Get Referral Status

```bash
hl referral status
```

## Examples

### Testnet Trading

```bash
# Set testnet private key
export HYPERLIQUID_PRIVATE_KEY=0x...

# Check positions on testnet
hl --testnet info positions

# Place a testnet order
hl --testnet trade order BTC buy 0.001 50000
```

### Scripting with JSON Output

```bash
# Get BTC price
BTC_PRICE=$(hl info prices --pair BTC --json | jq -r '.price')
echo "BTC: $BTC_PRICE"

# Get all positions as JSON
hl info positions --json | jq '.positions[] | {coin, size, pnl: .unrealizedPnl}'

# Check open orders
hl info orders --json | jq '.[] | select(.coin == "BTC")'
```

### Automated Trading

```bash
#!/bin/bash
# Simple limit order script

COIN="BTC"
SIDE="buy"
SIZE="0.001"
PRICE="85000"

echo "Placing $SIDE order for $SIZE $COIN @ $PRICE"
hl trade order $COIN $SIDE $SIZE $PRICE --json
```

## Development

### Setup

```bash
# Clone and install
git clone https://github.com/chrisling-dev/hyperliquid-cli.git
cd hyperliquid-cli
pnpm install

# Build and link globally
pnpm build
pnpm link --global

# Now 'hl' command is available globally
hl --help
```

### Commands

```bash
# Run without building
pnpm dev -- info prices

# Type check
pnpm typecheck

# Build
pnpm build
```

## Project Structure

```
hyperliquid-cli/
├── package.json
├── tsconfig.json
├── .env.example
├── src/
│   ├── index.ts                    # Entry point
│   ├── cli/
│   │   ├── program.ts              # Commander program setup
│   │   ├── context.ts              # CLI context (clients, config)
│   │   └── output.ts               # Output formatting (JSON/text)
│   ├── commands/
│   │   ├── index.ts                # Command registration
│   │   ├── referral.ts             # referral set/status
│   │   ├── info.ts                 # prices, meta, markets, positions, orders, book
│   │   └── trade.ts                # order, cancel, leverage
│   └── lib/
│       ├── config.ts               # Environment config
│       └── validation.ts           # Input validation
```

## License

MIT
