# Hyperliquid CLI agent guide (v1 beta)

Use Node 22.12+. Start with `hl --help`, then `hl info --help`, `hl ws --help`, and `hl exchange --help`.

- Inspect nested inputs with `hl schema <family> <method>`; inspect all mappings with `hl capabilities --json`.
- Public reads need no account. User reads accept `--user <address>` or default to the selected account's owner.
- Select a saved account with `--account <alias>`; list accounts using `hl account ls --json`.
- Import read-only addresses with `hl account add --alias <name> --user <address>`.
- Signing accounts use `--type api_wallet|master --key-env <environment-variable-name>`. Never put a private key in command-line arguments.
- Master-only actions fail for read-only/agent accounts. A valid local key does not imply live approval.
- Named API flags preserve field names and casing. Booleans require `true` or `false`; arrays/objects require JSON.
- Use `--data '<JSON object>'`, `--input <file>`, or `--input -` for complex inputs. Do not duplicate fields between JSON and flags.
- Exchange inputs are action parameters, excluding the action wrapper, type, signature, and generated nonce. Inspect each method's schema rather than guessing field names or asset IDs.
- `--dry-run` validates locally without submitting. It does not verify live authorization.
- `info`/`exchange` write JSON to stdout; `ws` writes NDJSON. Diagnostics go to stderr. Check exit status; never blindly retry writes after network errors.
- Streams share an automatically started `hl core`. Ctrl-C releases a subscription. Gaps can occur on reconnect; reconcile with info queries when needed.
- `hl core status`, `hl core stop`, and `hl core cleanup` manage shared and legacy runtime state.
- Friendly `order`, `asset`, `markets`, and portfolio commands are intentionally absent in this beta.

Examples:

```sh
hl info allMids
hl info clearinghouseState --user 0xADDRESS
hl --testnet ws l2Book --coin BTC
hl exchange updateLeverage --asset 0 --isCross true --leverage 5 --account trading --dry-run
hl schema exchange order
```
