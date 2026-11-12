# Hyperliquid CLI agent guide (v1 beta)

Use Node 22.12+. Start with `hl --help`, then `hl info --help`, `hl ws --help`, and `hl exchange --help`.

- Inspect nested inputs with `hl schema <family> <method>`; list method names by family with `hl capabilities`. Use `hl capabilities --json` only when full schemas and permission metadata are needed.
- Public reads need no account. User reads accept `--user <address>` or default to the selected account's owner.
- Select a saved account with `--account <alias>`; list accounts using `hl account ls --json`.
- Import read-only addresses with `hl account add --alias <name> --user <address>`.
- Signing accounts use `--type api_wallet|master --key-env <environment-variable-name>`. Never put a private key in command-line arguments.
- Master-only actions fail for read-only/agent accounts. A valid local key does not imply live approval.
- Named API flags preserve field names and casing. Boolean flags accept an optional value: `--fast` means `--fast true`; use `--fast false` to disable it. Arrays/objects require JSON.
- Use `--data '<JSON object>'`, `--input <file>`, or `--input -` for complex inputs. Do not duplicate fields between JSON and flags.
- Exchange inputs are action parameters, excluding the action wrapper, type, signature, and generated nonce. Inspect each method's schema rather than guessing field names or asset IDs.
- `--dry-run` validates locally without submitting. It does not verify live authorization.
- `info`/`exchange` write JSON to stdout; `ws` writes NDJSON. Diagnostics go to stderr. Check exit status; never blindly retry writes after network errors.
- Streams share an automatically started `hl core`. Ctrl-C releases a subscription. Gaps can occur on reconnect; reconcile with info queries when needed.
- `hl core status`, `hl core stop`, and `hl core cleanup` manage shared and legacy runtime state.
- `info allMids` and `ws allMids` default to `dex=ALL_DEXS`. Use `--dex ''` for native markets or `--dex xyz` for one venue. The sentinel is not supported by every method.
- For all perpetual venues, use `info allPerpMetas` (one metadata request) and `ws allDexsAssetCtxs` (one context subscription), rather than calling `metaAndAssetCtxs` per venue. `meta` and `metaAndAssetCtxs` remain single-DEX methods.
- `ws l2 --coin BTC` is an undocumented compressed feed decoded into full books. Identical coin/nSigFigs/mantissa inputs share a subscription; different inputs use isolated connections. `mantissa` requires `nSigFigs=5`; updated levels have `n: null` because counts are not provided. The book resets after reconnect and waits for a snapshot. Error events can appear in the stream; do not treat them as books. `l2Book --fast true` is a separate API.
- CLI errors are readable text by default; use global `--json` for structured CLI errors. Missing required inputs fail locally. Schema guides describe parameters, not transport envelopes.
- Documentation drift auditing is repository tooling (`npm run api:audit`), not an installed `hl` command. It checks coverage and docs changes, not complete semantic correctness of undocumented feeds.
- Friendly `order`, `asset`, `markets`, and portfolio commands are intentionally absent in this beta.

Examples:

```sh
hl info allMids
hl info allPerpMetas
hl ws allDexsAssetCtxs
hl ws l2 --coin BTC --nSigFigs 5 --mantissa 2
hl info clearinghouseState --user 0xADDRESS
hl --testnet ws l2Book --coin BTC
hl exchange updateLeverage --asset 0 --isCross true --leverage 5 --account trading --dry-run
hl schema exchange order
```
