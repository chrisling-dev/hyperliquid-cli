# v1 beta command reference

The installed registry is the authoritative reference. Avoid copying static method tables that drift from the implementation.

```sh
hl --help
hl account --help
hl info --help
hl ws --help
hl exchange --help
hl schema exchange order
hl capabilities --json
```

Use `hl <family> <method> --help` for named flags and `hl schema <family> <method>` for nested input variants. `api-manifest.json` is the reviewed generated snapshot. See the repository README for account permissions, input conventions, core lifecycle, and migration details.

For cross-DEX joins, `allPerpMetas` follows `perpDexs` order (the native DEX is
its null entry). `allDexsAssetCtxs` emits `ctxs: [[dexName, contexts], ...]`,
using `""` for native markets. Match the DEX first, then join its contexts to
its metadata universe by index. Do not flatten unrelated venue arrays together.
Filter delisted assets and invalid/zero `prevDayPx` values when ranking gainers;
24-hour mark-price change is `(markPx / prevDayPx - 1) * 100`. A market's
`maxLeverage` is a ceiling, not the account's selected leverage or a guarantee
for every position size.

`hl capabilities` lists method names grouped by `info`, `ws`, and `exchange`.
Use `hl capabilities --json` for the full manifest, or `hl schema <family> <method>`
for the parameters of one method.
