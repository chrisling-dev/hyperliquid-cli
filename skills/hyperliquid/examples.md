# v1 beta examples

```sh
# Public data, no account needed
hl info allPerpMetas
hl info allMids
hl info allMids --dex xyz
hl info meta --dex xyz
hl info spotMeta
hl info l2Book --coin BTC

# Read-only account and address defaults
hl account add --alias watch --user 0xADDRESS
hl info clearinghouseState --account watch
hl info spotClearinghouseState --account watch
hl info openOrders --account watch

# Live streams share core automatically
hl ws allDexsAssetCtxs
hl ws l2 --coin BTC --nSigFigs 5 --mantissa 2
hl ws l2Book --coin BTC
hl ws userFills --account watch
hl core status

# Inspect and validate writes before submission
hl schema exchange order
hl exchange updateLeverage --asset 0 --isCross true --leverage 5 --account trading --dry-run
hl exchange order --input order.json --account trading --dry-run

```

Addresses and order IDs in examples are placeholders. Resolve API asset IDs from metadata; the v1 core intentionally does not interpret friendly symbols for exchange actions. Supply decimal prices/sizes as JSON strings. Remove `--dry-run` only when submission is intended.
