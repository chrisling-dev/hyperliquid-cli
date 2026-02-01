# How to manage trades

## List open orders

```sh
hl order ls
```

List all open orders

## Cancel an order

```sh
# cancel with oid
hl order cancel <oid>

# cancel without oid, an interactive wizzard will be created to select open orders using arrow navigation
hl order cancel
```

## Place order

### Market order

```sh
hl order market <long or short> <size> <coin or pairName> --reduce-only
hl order market <buy or sell> <size> <coin or pairName> --reduce-only
```

### Limit order

```sh
hl order limit <long or short> <size> <coin or pairName> <limitPrice> --tif=GTC|ALO|IOC --reduce-only
hl order limit <buy or sell> <size> <coin or pairName> <limitPrice> --tif=GTC|ALO|IOC --reduce-only
```

### Set leverage for perps

```sh
hl order set-leverage <coin> <leverage>
```

### To set other preferences

```sh
hl order configure --slippage
```
