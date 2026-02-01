# Hyperliquid CLI

A command-line interface for [Hyperliquid DEX](https://hyperliquid.xyz/) built with the [@nktkas/hyperliquid](https://github.com/nktkas/hyperliquid) TypeScript SDK.

Features a beautiful terminal UI with real-time watch modes powered by [Ink](https://github.com/vadimdemedes/ink).

## Installation

```bash
npm install -g hyperliquid-cli
```

## Features

- **Multi-Account Management** - Store and manage multiple trading accounts locally with SQLite
- **Real-Time Monitoring** - WebSocket-powered live updates for positions, orders, balances, and prices
- **Beautiful Terminal UI** - Color-coded PnL, depth visualization, and interactive tables
- **Trading Support** - Place limit, market, stop-loss, and take-profit orders
- **Scripting Friendly** - JSON output mode for automation and scripting
- **Testnet Support** - Seamless switching between mainnet and testnet

## Global Options

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format |
| `--testnet` | Use testnet instead of mainnet |
| `-V, --version` | Show version number |
| `-h, --help` | Show help |

---

## Account Management

Manage multiple trading accounts locally. Accounts are stored in a SQLite database at `~/.hyperliquid/accounts.db`.

### Add Account

Interactive wizard to add a new account:

```bash
hl account add
```

- Import API wallets from Hyperliquid for trading
- Add read-only accounts for monitoring only
- Set account aliases for easy identification
- Choose default account for commands

### List Accounts

```bash
hl account ls
```

Shows all configured accounts with alias, address, type, and default status.

### Set Default Account

```bash
hl account set-default
```

Interactively select which account to use by default.

### Remove Account

```bash
hl account remove
```

Interactively remove an account from local storage.

---

## Balance & Portfolio Monitoring

View account balances and portfolio with optional real-time watch mode.

### Get Balances

```bash
# Spot + perpetuals balances
hl account balances

# Watch mode - real-time updates
hl account balances -w

# Specific address
hl account balances --user 0x...
```

Shows spot token balances (total, hold, available) and perpetuals USD balance.

### Get Full Portfolio

```bash
# Positions + spot balances combined
hl account portfolio

# Watch mode
hl account portfolio -w
```

Combined view of all positions and spot balances in a single display.

---

## Position Monitoring

View and monitor perpetual positions.

### Get Positions

```bash
# One-time fetch
hl account positions

# Watch mode - real-time updates with colored PnL
hl account positions -w

# Specific address
hl account positions --user 0x...
```

Displays: coin, size, entry price, position value, unrealized PnL, leverage, and liquidation price.

---

## Order Management

View, place, and cancel orders.

### View Open Orders

```bash
hl account orders

# Watch mode - real-time order updates
hl account orders -w

# Specific address
hl account orders --user 0x...
```

Or use the trade command:

```bash
hl trade order ls
```

### Place Limit Order

```bash
hl trade order limit <side> <size> <coin> <price>

# Examples
hl trade order limit buy 0.001 BTC 50000
hl trade order limit sell 0.1 ETH 3500 --tif Gtc
hl trade order limit long 1 SOL 100 --reduce-only
```

| Option | Description |
|--------|-------------|
| `--tif <tif>` | Time-in-force: `Gtc` (default), `Ioc`, `Alo` |
| `--reduce-only` | Reduce-only order |

### Place Market Order

```bash
hl trade order market <side> <size> <coin>

# Examples
hl trade order market buy 0.001 BTC
hl trade order market sell 0.1 ETH --slippage 0.5
```

| Option | Description |
|--------|-------------|
| `--slippage <pct>` | Slippage percentage (default: 1%) |
| `--reduce-only` | Reduce-only order |

### Place Stop-Loss Order

```bash
hl trade order stop-loss <side> <size> <coin> <price> <trigger>

# Examples
hl trade order stop-loss sell 0.001 BTC 48000 49000
hl trade order stop-loss sell 0.001 BTC 48000 49000 --tpsl
```

### Place Take-Profit Order

```bash
hl trade order take-profit <side> <size> <coin> <price> <trigger>

# Examples
hl trade order take-profit sell 0.001 BTC 55000 54000
hl trade order take-profit sell 0.001 BTC 55000 54000 --tpsl
```

### Configure Order Defaults

```bash
# View current configuration
hl trade order configure

# Set default slippage for market orders
hl trade order configure --slippage 0.5
```

### Cancel Order

```bash
# Cancel specific order
hl trade cancel <oid>

# Interactive selection from open orders
hl trade cancel
```

### Cancel All Orders

```bash
# Cancel all open orders
hl trade cancel-all

# Cancel all orders for a specific coin
hl trade cancel-all --coin BTC

# Skip confirmation
hl trade cancel-all -y
```

### Set Leverage

```bash
# Cross margin (default)
hl trade set-leverage <coin> <leverage>
hl trade set-leverage BTC 10

# Isolated margin
hl trade set-leverage BTC 10 --isolated

# Explicit cross margin
hl trade set-leverage ETH 5 --cross
```

---

## Market Information

View market data without authentication.

### List All Markets

```bash
# List all perpetual and spot markets
hl markets ls
```

Shows market metadata including leverage info, price decimals, and trading pairs.

### Get All Prices

```bash
hl markets prices
```

Returns mid prices for all available assets.

---

## Asset Information

View asset-specific data with optional watch mode.

### Get Price

```bash
# One-time fetch
hl asset price BTC

# Watch mode - real-time price updates
hl asset price BTC -w
```

### Get Order Book

```bash
# One-time fetch with depth visualization
hl asset book BTC

# Watch mode - real-time order book
hl asset book ETH -w
```

Shows top bid/ask levels with cumulative depth bars and spread calculation.

---

## Referral System

### Set Referral Code

```bash
hl referral set <code>
```

### Get Referral Status

```bash
hl referral status
```

---

## Background Server

Optional background server for caching market data and faster queries.

### Start Server

```bash
hl server start
```

Runs a detached WebSocket server that caches market data.

### Stop Server

```bash
hl server stop
```

### Check Status

```bash
hl server status
```

Shows server status, WebSocket connection state, uptime, and cache status.

---

## Examples

### Testnet Trading

```bash
# Check positions on testnet
hl --testnet account positions

# Place a testnet order
hl --testnet trade order limit buy 0.001 BTC 50000
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
hl trade order limit $SIDE $SIZE $COIN $PRICE --json
```

---

## Configuration

### Environment Variables

```bash
# Required for trading commands (if not using account management)
export HYPERLIQUID_PRIVATE_KEY=0x...

# Optional: explicitly set wallet address (derived from key if not provided)
export HYPERLIQUID_WALLET_ADDRESS=0x...
```

### Local Storage

| Path | Description |
|------|-------------|
| `~/.hyperliquid/accounts.db` | SQLite database for account management |
| `~/.hyperliquid/order-config.json` | Order configuration (default slippage, etc.) |

---

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
│   ├── commands/
│   │   ├── account/                # add, ls, remove, set-default, positions, orders, balances, portfolio
│   │   ├── order/                  # limit, market, stop-loss, take-profit, cancel, cancel-all, set-leverage
│   │   ├── markets/                # ls, prices
│   │   ├── asset/                  # price, book
│   │   ├── referral/               # set, status
│   │   └── server.ts               # start, stop, status
│   ├── lib/
│   │   ├── config.ts               # Environment config
│   │   ├── validation.ts           # Input validation
│   │   ├── db/                     # SQLite database for accounts
│   │   ├── *-watcher.ts            # WebSocket watchers (positions, orders, balances, prices, book)
│   │   └── ...
│   ├── client/                     # Server client
│   └── server/                     # Background server
```

## License

MIT
