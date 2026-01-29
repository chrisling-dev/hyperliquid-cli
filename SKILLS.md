# Hyperliquid CLI Skills for AI Agents

This document describes how AI agents can use the `hl` command-line tool to interact with Hyperliquid DEX.

## Overview

The `hl` CLI provides programmatic access to Hyperliquid perpetual futures trading. Use this tool when users want to:

- Check cryptocurrency prices, market data, or order books
- View trading positions, balances, or open orders
- Place limit, market, stop-loss, or take-profit orders
- Cancel orders or adjust leverage
- Manage referral codes

## Prerequisites

- The `hl` command must be installed and available in PATH
- For trading commands: `HYPERLIQUID_PRIVATE_KEY` environment variable must be set
- For testnet: add `--testnet` flag to any command

## Command Reference

### Global Options

All commands support these options:

| Option | Description |
|--------|-------------|
| `--json` | Output structured JSON (recommended for parsing) |
| `--testnet` | Use Hyperliquid testnet |

### Account Commands (No Authentication Required for Read)

#### `hl account positions`

Get account positions with real-time watch mode.

```bash
# One-time fetch
hl account positions --json

# Watch mode - real-time updates
hl account positions -w

# Specific address (read-only)
hl account positions --user 0x... --json
```

**Output (JSON):**
```json
{
  "positions": [
    {
      "coin": "BTC",
      "size": "0.001",
      "entryPx": "85000.0",
      "unrealizedPnl": "45.0",
      "leverage": "10x cross"
    }
  ],
  "marginSummary": {"accountValue": "1000.0", "totalMarginUsed": "85.0"}
}
```

#### `hl account orders`

Get open orders with real-time watch mode.

```bash
# One-time fetch
hl account orders --json
hl account orders --user 0x... --json

# Watch mode - real-time updates
hl account orders -w
```

#### `hl account balances`

Get spot and perpetuals USD balances.

```bash
# One-time fetch
hl account balances --json

# Watch mode
hl account balances -w
```

**Output (JSON):**
```json
{
  "spotBalances": [
    {"token": "USDC", "total": "1000.0", "hold": "0", "available": "1000.0"}
  ],
  "perpBalance": "5000.0"
}
```

#### `hl account portfolio`

Get full portfolio (positions + spot balances combined).

```bash
# One-time fetch
hl account portfolio --json

# Watch mode
hl account portfolio -w
```

### Markets Commands (No Authentication Required)

#### `hl markets ls`

List all available markets (perpetuals and spot).

```bash
hl markets ls --json
```

**Output (JSON):**
```json
{
  "perpMarkets": [
    {"coin": "BTC", "maxLeverage": 50, "szDecimals": 5}
  ],
  "spotMarkets": [
    {"name": "HYPE/USDC", "baseCoin": "HYPE", "quoteCoin": "USDC"}
  ]
}
```

#### `hl markets prices`

Get mid prices for all assets.

```bash
hl markets prices --json
```

**Output (JSON):**
```json
[
  {"coin": "BTC", "price": "89500.0"},
  {"coin": "ETH", "price": "3200.0"}
]
```

### Asset Commands (No Authentication Required)

#### `hl asset price <coin>`

Get price of a specific asset with optional watch mode.

```bash
# One-time fetch
hl asset price BTC --json

# Watch mode - real-time price updates
hl asset price BTC -w
```

**Output (JSON):**
```json
{"coin": "BTC", "price": "89500.0"}
```

#### `hl asset book <coin>`

Get order book for a specific asset with depth visualization.

```bash
# One-time fetch
hl asset book BTC --json

# Watch mode - real-time order book
hl asset book BTC -w
```

**Output (JSON):**
```json
{
  "levels": [
    [{"px": "89500", "sz": "1.5", "n": 3}],
    [{"px": "89501", "sz": "2.0", "n": 5}]
  ]
}
```

### Trade Commands (Authentication Required)

#### `hl trade order <coin> <side> <size> [price]`

Place an order.

**Limit Order:**
```bash
hl trade order BTC buy 0.001 85000 --json
hl trade order ETH sell 0.1 3500 --tif Ioc --json
```

**Market Order:**
```bash
hl trade order BTC buy 0.001 --type market --json
hl trade order ETH sell 0.1 --type market --slippage 0.5 --json
```

**Stop-Loss Order:**
```bash
hl trade order BTC sell 0.001 48000 --type stop-loss --trigger 49000 --json
```

**Take-Profit Order:**
```bash
hl trade order BTC sell 0.001 55000 --type take-profit --trigger 54000 --json
```

**Options:**

| Option | Values | Description |
|--------|--------|-------------|
| `--type` | `limit`, `market`, `stop-loss`, `take-profit` | Order type (default: limit) |
| `--tif` | `Gtc`, `Ioc`, `Alo` | Time-in-force (default: Gtc) |
| `--reduce-only` | flag | Only reduce position |
| `--slippage` | number | Slippage % for market orders (default: 1) |
| `--trigger` | price | Trigger price for stop/TP orders |
| `--tpsl` | flag | Mark as TP/SL for position management |

**Success Output:**
```json
{
  "status": "ok",
  "response": {
    "type": "order",
    "data": {
      "statuses": [{"resting": {"oid": 12345}}]
    }
  }
}
```

#### `hl trade cancel <coin> <order-id>`

Cancel an order by ID.

```bash
hl trade cancel BTC 12345 --json
```

#### `hl trade leverage <coin> <leverage>`

Set leverage for an asset.

```bash
# Cross margin (default)
hl trade leverage BTC 10 --json

# Isolated margin
hl trade leverage BTC 10 --isolated --json
```

### Referral Commands

#### `hl referral set <code>`

Set a referral code.

```bash
hl referral set MYCODE --json
```

#### `hl referral status`

Get referral information.

```bash
hl referral status --json
```

## Common Workflows

### Check Market Before Trading

```bash
# 1. Get current price
hl asset price BTC --json

# 2. Check order book depth
hl asset book BTC --json

# 3. Review all markets
hl markets ls --json
```

### Monitor Positions in Real-Time

```bash
# Watch positions with live PnL updates
hl account positions -w

# Or watch full portfolio
hl account portfolio -w
```

### Watch Order Book

```bash
# Real-time order book with depth visualization
hl asset book BTC -w
```

### Open a Position

```bash
# 1. Set leverage
hl trade leverage BTC 5 --json

# 2. Place limit order
hl trade order BTC buy 0.01 85000 --json

# 3. Verify order placed
hl account orders --json
```

### Close a Position

```bash
# 1. Check current position
hl account positions --json

# 2. Close with market order
hl trade order BTC sell 0.01 --type market --reduce-only --json
```

### Set Stop-Loss and Take-Profit

```bash
# After opening a long position at 85000

# Stop-loss at 83000
hl trade order BTC sell 0.01 82500 --type stop-loss --trigger 83000 --tpsl --json

# Take-profit at 90000
hl trade order BTC sell 0.01 90500 --type take-profit --trigger 90000 --tpsl --json
```

### Cancel All Orders for an Asset

```bash
# Get all order IDs for BTC
ORDERS=$(hl account orders --json | jq -r '.[] | select(.coin == "BTC") | .oid')

# Cancel each order
for oid in $ORDERS; do
  hl trade cancel BTC $oid --json
done
```

## Error Handling

Commands exit with code 1 on error and print to stderr:

```bash
hl trade order BTC buy 0.001 85000 --json
# Error: HYPERLIQUID_PRIVATE_KEY environment variable is required for this command
```

Common errors:
- Missing `HYPERLIQUID_PRIVATE_KEY` for trade commands
- Invalid coin symbol
- Insufficient balance/margin
- Invalid order parameters

## Tips for AI Agents

1. **Always use `--json`** for reliable parsing
2. **Use watch mode (`-w`)** for real-time monitoring without polling
3. **Check prices first** before placing orders to validate parameters
4. **Use `jq`** to filter and extract specific fields from JSON output
5. **Validate coin symbols** using `hl markets ls --json` to get valid asset names
6. **For testnet testing**, always add `--testnet` flag
7. **Handle errors gracefully** - check exit codes and stderr
8. **Market orders use IOC** with slippage - may partially fill or fail in low liquidity

## Asset Symbol Reference

Common perpetual assets: BTC, ETH, SOL, AVAX, BNB, ARB, OP, DOGE, MATIC, ATOM, LINK, UNI, AAVE, etc.

Get full list:
```bash
hl markets ls --json | jq '.perpMarkets[].coin'
```
