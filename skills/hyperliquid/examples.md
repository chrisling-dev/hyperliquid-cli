# Hyperliquid CLI Examples

Workflow examples for common trading scenarios.

## Initial Setup

### Installing the CLI

```bash
# Check if already installed
which hl

# Install globally
npm install -g hyperliquid-cli

# Verify installation
hl --version
hl --help
```

### Adding Your First Account

```bash
# Interactive account setup
hl account add

# You'll be prompted for:
# 1. Account type (API wallet for trading, read-only for monitoring)
# 2. Private key or address
# 3. Alias (e.g., "main", "trading", "bot")
# 4. Whether to set as default

# Verify the account was added
hl account ls
```

### Setting Up the High-Performance Server

```bash
# Start the background server
hl server start

# Check it's running
hl server status

# Output:
# Server Status: Running
# WebSocket: Connected
# Uptime: 5m 32s
# Cache: Active (15 assets)
```

---

## Trading Crypto Perpetuals

### Basic Long Position

```bash
# Check current BTC price
hl asset price BTC

# Set leverage
hl order set-leverage BTC 10

# Place a limit buy order
hl order limit buy 0.01 BTC 50000

# Check your position
hl account positions

# Close position with market order
hl order market sell 0.01 BTC
```

### Short Position

```bash
# Open a short position
hl order market sell 0.05 ETH

# Monitor position
hl account positions -w

# Close with market order when ready
hl order market buy 0.05 ETH
```

### Quick Scalping

```bash
# Start server for fastest execution
hl server start

# Watch the order book in real-time
hl asset book BTC -w

# In another terminal, place quick orders
hl order limit buy 0.001 BTC 49950
hl order limit sell 0.001 BTC 50050

# Cancel if price moves away
hl order cancel-all --coin BTC -y
```

---

## Trading HIP3 Traditional Assets

### Trading Stocks

```bash
# Check NVIDIA price
hl asset price NVDA

# View order book
hl asset book NVDA

# Buy 10 shares of NVIDIA at limit price
hl order limit buy 10 NVDA 140

# Check your position
hl account positions

# Sell with market order
hl order market sell 10 NVDA
```

### Trading Apple Stock

```bash
# Get Apple price
hl asset price AAPL

# Place a limit order for 5 shares
hl order limit buy 5 AAPL 195

# Monitor price in real-time
hl asset price AAPL -w

# Sell with limit order at target
hl order limit sell 5 AAPL 205
```

### Trading Commodities

```bash
# Check gold price
hl asset price GOLD

# Buy gold
hl order limit buy 0.5 GOLD 2400

# Check silver
hl asset price SILVER

# Buy silver
hl order limit buy 10 SILVER 28

# Monitor commodity positions
hl account positions
```

---

## Multi-Account Setup

### Managing Multiple Accounts

```bash
# Add trading account
hl account add
# Enter private key, set alias "trading"

# Add monitoring-only account
hl account add
# Choose read-only, enter address, set alias "whale-watch"

# List all accounts
hl account ls
# Output:
# Alias        Address         Type        Default
# trading      0x1234...abcd   api-wallet  *
# whale-watch  0xabcd...1234   read-only

# Switch default account
hl account set-default
# Select from list
```

### Monitoring Another Address

```bash
# Watch positions of any address
hl account positions --user 0xabcd...1234

# Watch their orders
hl account orders --user 0xabcd...1234 -w

# Get their portfolio
hl account portfolio --user 0xabcd...1234
```

---

## Real-Time Monitoring

### Position Dashboard

```bash
# Terminal 1: Watch positions
hl account positions -w

# Terminal 2: Watch orders
hl account orders -w

# Terminal 3: Watch BTC price
hl asset price BTC -w
```

### Order Book Analysis

```bash
# Watch ETH order book with depth visualization
hl asset book ETH -w

# The display shows:
# - Top bid/ask levels
# - Cumulative depth bars
# - Current spread
# - Updates in real-time
```

### Portfolio Monitoring

```bash
# Combined view of everything
hl account portfolio -w

# Shows:
# - All positions with live PnL
# - Spot balances
# - Total account value
```

---

## Automated Trading Scripts

### Price Alert Script

```bash
#!/bin/bash
# price-alert.sh - Alert when BTC crosses threshold

TARGET=55000

while true; do
  PRICE=$(hl asset price BTC --json | jq -r '.price')

  if (( $(echo "$PRICE > $TARGET" | bc -l) )); then
    echo "ALERT: BTC above $TARGET at $PRICE"
    # Add notification command here
  fi

  sleep 5
done
```

### Position Size Calculator

```bash
#!/bin/bash
# calc-position.sh - Calculate position size based on risk

RISK_AMOUNT=100  # Risk $100 per trade
ENTRY_PRICE=$1
STOP_PRICE=$2
COIN=$3

RISK_PER_UNIT=$(echo "$ENTRY_PRICE - $STOP_PRICE" | bc -l)
SIZE=$(echo "$RISK_AMOUNT / $RISK_PER_UNIT" | bc -l)

echo "Position size for $COIN: $SIZE"
echo "Entry: $ENTRY_PRICE, Stop: $STOP_PRICE, Risk: $RISK_AMOUNT"
```

### Automated Order Placement

```bash
#!/bin/bash
# place-order.sh - Place order with logging

COIN="BTC"
SIDE="buy"
SIZE="0.001"
PRICE="50000"

echo "$(date): Placing $SIDE $SIZE $COIN @ $PRICE"

RESULT=$(hl order limit $SIDE $SIZE $COIN $PRICE --json)
OID=$(echo $RESULT | jq -r '.response.data.statuses[0].resting.oid // empty')

if [ -n "$OID" ]; then
  echo "$(date): Order placed successfully - ID: $OID"
else
  echo "$(date): Order failed or filled immediately"
  echo $RESULT | jq .
fi
```

### Portfolio Snapshot

```bash
#!/bin/bash
# snapshot.sh - Save portfolio snapshot to file

DATE=$(date +%Y%m%d_%H%M%S)
OUTDIR="./snapshots"
mkdir -p $OUTDIR

echo "Taking portfolio snapshot..."

hl account positions --json > "$OUTDIR/positions_$DATE.json"
hl account orders --json > "$OUTDIR/orders_$DATE.json"
hl account balances --json > "$OUTDIR/balances_$DATE.json"

echo "Snapshot saved to $OUTDIR/"
```

### Multi-Asset Price Tracker

```bash
#!/bin/bash
# track-prices.sh - Track multiple assets

ASSETS="BTC ETH SOL AAPL NVDA GOLD"

echo "Asset Prices - $(date)"
echo "========================"

for ASSET in $ASSETS; do
  PRICE=$(hl asset price $ASSET --json 2>/dev/null | jq -r '.price // "N/A"')
  printf "%-6s: %s\n" "$ASSET" "$PRICE"
done
```

---

## Testnet Trading

### Practice on Testnet

```bash
# All commands support --testnet flag
hl --testnet account positions
hl --testnet account balances

# Place testnet orders
hl --testnet order limit buy 0.01 BTC 50000

# Watch testnet positions
hl --testnet account positions -w
```

---

## JSON Output for Integration

### Getting Structured Data

```bash
# Get all prices as JSON
hl markets ls --json | jq '.[] | {name, price}'

# Get specific position data
hl account positions --json | jq '.positions[] | select(.coin == "BTC")'

# Get open orders for a coin
hl account orders --json | jq '.[] | select(.coin == "ETH")'

# Extract account value
hl account balances --json | jq '.perp.accountValue'
```

### Piping to Other Tools

```bash
# Export positions to CSV
hl account positions --json | jq -r '.positions[] | [.coin, .size, .entryPx, .unrealizedPnl] | @csv'

# Send to monitoring service
hl account positions --json | curl -X POST -d @- https://your-webhook.com/positions

# Log to file with timestamp
echo "{\"timestamp\": \"$(date -Iseconds)\", \"data\": $(hl account positions --json)}" >> positions.log
```

---

## Troubleshooting

### Server Issues

```bash
# Check if server is running
hl server status

# If stuck, force restart
hl server stop
sleep 2
hl server start
hl server status
```

### Connection Issues

```bash
# Test connection with simple query
hl markets ls

# If issues, try without server
hl server stop
hl markets ls  # Uses direct API
```

### Account Issues

```bash
# List accounts to verify setup
hl account ls

# If no default, set one
hl account set-default

# If key issues, remove and re-add
hl account remove
hl account add
```
