# Hyperliquid CLI

A command-line interface for [Hyperliquid DEX](https://hyperliquid.xyz/) built with the [@nktkas/hyperliquid](https://github.com/nktkas/hyperliquid) TypeScript SDK.

Features a beautiful terminal UI with real-time watch modes powered by [Ink](https://github.com/vadimdemedes/ink).

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

### Account Commands

View account information with optional real-time watch mode.

#### Get Positions

```bash
# One-time fetch
hl account positions

# Watch mode - real-time updates with colored PnL
hl account positions -w

# Specific address
hl account positions --user 0x...
```

#### Get Open Orders

```bash
hl account orders
hl account orders --user 0x...

# Watch mode - real-time order updates
hl account orders -w
```

#### Get Balances

```bash
# Spot + perps balances
hl account balances

# Watch mode
hl account balances -w
```

#### Get Full Portfolio

```bash
# Positions + spot balances combined
hl account portfolio

# Watch mode
hl account portfolio -w
```

### Markets Commands

View market information.

#### List All Markets

```bash
# List all perpetual and spot markets
hl markets ls
```

#### Get All Prices

```bash
hl markets prices
```

### Asset Commands

View asset-specific information with optional watch mode.

#### Get Price

```bash
# One-time fetch
hl asset price BTC

# Watch mode - real-time price updates
hl asset price BTC -w
```

#### Get Order Book

```bash
# One-time fetch with depth visualization
hl asset book BTC

# Watch mode - real-time order book
hl asset book ETH -w
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
hl --testnet account positions

# Place a testnet order
hl --testnet trade order BTC buy 0.001 50000
```

### Real-Time Monitoring

```bash
# Watch positions with live PnL
hl account positions -w

# Watch order book with depth visualization
hl asset book BTC -w

# Watch specific asset price
hl asset price ETH -w
```

### Scripting with JSON Output

```bash
# Get BTC price
BTC_PRICE=$(hl asset price BTC --json | jq -r '.price')
echo "BTC: $BTC_PRICE"

# Get all positions as JSON
hl account positions --json | jq '.positions[] | {coin, size, pnl: .unrealizedPnl}'

# Check open orders
hl account orders --json | jq '.[] | select(.coin == "BTC")'
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
pnpm dev -- account positions

# Type check
pnpm typecheck

# Build
pnpm build

# Run tests
pnpm test

# Lint
pnpm lint
```

## Project Structure

```
hyperliquid-cli/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                    # Entry point
│   ├── cli/
│   │   ├── program.ts              # Commander program setup
│   │   ├── context.ts              # CLI context (clients, config)
│   │   ├── output.ts               # Output formatting (JSON/text)
│   │   ├── watch.ts                # Watch mode utilities
│   │   └── ink/                    # Ink TUI components
│   │       ├── theme.ts            # Color theme
│   │       ├── render.tsx          # Render utilities
│   │       └── components/         # React components
│   │           ├── Table.tsx
│   │           ├── PnL.tsx
│   │           ├── WatchHeader.tsx
│   │           └── Spinner.tsx
│   ├── commands/
│   │   ├── index.ts                # Command registration
│   │   ├── account/                # positions, orders, balances, portfolio
│   │   ├── markets/                # ls, prices
│   │   ├── asset/                  # price, book
│   │   ├── referral/               # set, status
│   │   ├── trade.ts                # order, cancel, leverage
│   │   └── server.ts               # start, stop, status
│   ├── lib/
│   │   ├── config.ts               # Environment config
│   │   ├── validation.ts           # Input validation
│   │   ├── position-watcher.ts     # WebSocket position watcher
│   │   ├── balance-watcher.ts      # Balance watcher
│   │   ├── portfolio-watcher.ts    # Portfolio watcher
│   │   ├── price-watcher.ts        # Price watcher
│   │   └── book-watcher.ts         # Order book watcher
│   ├── client/
│   │   └── index.ts                # Server client
│   └── server/
│       ├── index.ts                # Background server
│       ├── cache.ts                # Data cache
│       └── subscriptions.ts        # WebSocket subscriptions
```

## License

MIT
