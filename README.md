# Hyperliquid CLI — v1 beta

An account-aware Hyperliquid API CLI for agents and terminal users. Node **22.12+** on macOS or Linux is required (core uses Unix sockets).

This beta rebuild prioritizes API access. Human trading shortcuts and the interactive trading workspace will return in a later iteration.

```sh
npm install -g hyperliquid-cli@beta
hl --help
```

The beta tag is available after publication. To run this checkout:

```sh
pnpm install
pnpm build
node dist/index.js --help
# Or: pnpm dev --help
```

## Discover commands without leaving the terminal

```sh
hl info --help
hl ws --help
hl exchange --help
hl exchange order --help
hl schema exchange order
hl schema info l2Book --json
hl capabilities --json
```

The registry generates all mapped commands, typed flags, nested schemas, and help. Required parameters are marked in help and rejected locally before any request or stream starts. They can be supplied through flags, JSON, or a file; a selected account can satisfy `user`.

`hl schema <family> <method>` displays only accepted parameters, their required/optional status, allowed values, and nested fields. Add `--json` for a parameter-keyed JSON description. Internal SDK and request-envelope metadata remain in `hl capabilities --json`. API names and field casing follow Hyperliquid. The pinned SDK supplies most schemas and signing adapters; explicitly reviewed extensions cover documented SDK gaps. `api-manifest.json` records the installed surface for review.

- `info <method>`: JSON reads, no daemon or signer required.
- `ws <subscription>`: newline-delimited JSON events through the shared core.
- `exchange <action>`: authenticated writes, returning JSON.
- `account add|ls|remove|set-default`: local account management.
- `core start|stop|status|cleanup`: shared stream lifecycle and legacy cleanup.
- `upgrade`: check npm and show upgrade instructions.

## Accounts and permissions

```sh
hl account add --alias watch --type readonly --user 0xYOUR_ADDRESS
hl account add --alias trading --type api_wallet --key-env HL_AGENT_KEY
hl account add --alias owner --type master --key-env HL_MASTER_KEY
hl account ls --json
hl account set-default trading
hl account remove watch --force
```

With no arguments, `account add` opens a wizard in an interactive terminal. Keys are read from a hidden prompt or an environment variable named by `--key-env`, never from a key-valued command-line flag. Agent import resolves the owning user through Hyperliquid on the selected network. Master import derives the user address from the key. Seed phrases are not accepted.

Select an account globally with `--account <alias>`; otherwise the saved default is used. If no saved account is selected, `HYPERLIQUID_PRIVATE_KEY` and `HYPERLIQUID_WALLET_ADDRESS` remain supported. An explicit unknown alias errors rather than silently falling back.

| Account | Reads | Exchange actions |
|---|---|---|
| None | Public reads; supply `--user` where needed | Rejected |
| Read-only | Defaults `user` to saved address | Rejected |
| Agent/API wallet | Defaults `user` to owner, not signer | Reviewed agent-authorized actions; master-only actions rejected |
| Master | Defaults `user` to signer | All mapped actions, subject to exchange authorization |

Permissions are per action, not inferred from its signing scheme. Some explicitly agent-authorized actions, such as `agentSendAsset` and `cDeposit2`, can move funds within the restrictions imposed by Hyperliquid. A local account label does not grant permissions: writes check the live signer role before submission. Revoked or wrong-network agents fail.

Account keys remain stored **unencrypted** in `~/.hl/hl.db`, with file mode `0600`. The directory is created with `0700`. `HL_HOME` overrides the data directory. The first v1 database migration creates `hl.db.pre-v1` and retains existing accounts.

## Reads and streams

```sh
hl info allMids
hl info clearinghouseState --account trading
hl info clearinghouseState --user 0xUSER
hl --testnet info l2Book --coin BTC
hl info candleSnapshot --req '{"coin":"BTC","interval":"1h","startTime":1700000000000}'
hl ws l2Book --coin BTC
hl ws userFills --account trading
```

Explicit `user` inputs override the selected account's address. The API layer preserves wire identifiers: it does not guess market aliases or uppercase asset names. Nested request objects such as `candleSnapshot.req` retain the API envelope.

`ws activeSpotAssetCtx` is the SDK's spot-specific adapter for the `activeAssetCtx` subscription, which receives events on a different response channel.

## Writes and input formats

```sh
hl exchange updateLeverage --asset 0 --isCross true --leverage 5 --account trading
hl exchange order --orders '[{"a":0,"b":true,"p":"50000","s":"0.001","r":false,"t":{"limit":{"tif":"Gtc"}}}]' --account trading
hl exchange cancel --data '{"cancels":[{"a":0,"o":12345}]}' --account trading
hl exchange order --input orders.json --account trading
cat orders.json | hl exchange order --input - --account trading
```

`--data` and `--input` accept a JSON object containing action parameters, **without** `action`, `type`, signatures, or generated nonces. Arrays and objects can also be passed as JSON-valued flags. Boolean flags take explicit values (`--isCross false`). Decimal strings remain strings; SDK canonicalization may remove trailing zeroes before signing. Duplicated inputs and unknown fields are rejected. If an API field is named `data` or `input`, supply it inside the JSON object to avoid colliding with input-control flags.

```sh
hl exchange order --input orders.json --dry-run --account trading
hl exchange order --input orders.json --execution-vault 0xVAULT --expires-after 1800000000000
```

`--dry-run` resolves local defaults, checks local permissions, and validates inputs without connecting or signing. It does not prove live authorization or order acceptance. `--execution-vault` and `--expires-after` appear only on actions whose envelope supports them. `vaultAddress` inside an action remains a separate API field.

Signing stays in the client process; private keys never cross the core socket. Nonces are allocated transactionally in SQLite across processes, keyed by signer and network. Writes are not automatically retried after ambiguous network failures. Multisig signer orchestration is not included in this beta; mapping an action is not a claim that every execution context is supported.

## Shared core

```sh
hl core start
hl core status
hl core stop
hl --testnet core start
hl core cleanup
```

Streaming commands start core automatically. Mainnet and testnet use separate sockets/processes. Core owns one reconnecting upstream WebSocket per network and reference-counts matching subscriptions. Disconnecting the final local consumer unsubscribes upstream. Slow local clients are disconnected when their pending IPC output exceeds the buffer limit.

The SDK handles heartbeat/reconnect/resubscribe. Connection notices go to stderr; event data goes to stdout. Reconnects can have event gaps: this is a live feed, not a durable event log. If core itself exits, the command fails so its caller can explicitly restart it.

Runtime files are `~/.hl/core-{mainnet,testnet}.{sock,pid,log}`. Socket permissions are `0600`. `hl-core` runs the daemon in the foreground.

Before starting core, legacy `server.sock`, `server.pid`, and `server.json` files in `~/.hl` and `~/.hyperliquid` are detected. A responsive old server is shut down over its IPC protocol. A live PID is only signaled if its process command identifies the old Hyperliquid server. Unknown/live unrelated processes are left alone and reported. Stale runtime files are removed; accounts and old logs are retained. `hl core cleanup` runs this independently.

## Maintainer documentation audit

```sh
npm run api:audit
npm run api:audit -- --save upstream-docs.json
npm run api:audit -- --snapshot upstream-docs.json
npm run api:audit -- --snapshot upstream-docs.json --baseline api-docs-snapshot.json
```

Run this development command from a repository checkout after installing dependencies; it is not part of the installed `hl` CLI.

The audit discovers API pages from the official `llms.txt`, fetches Markdown, and extracts request types without an LLM, including the separate HIP deployer pages. Signing, nonce, rate-limit, and other protocol pages are tracked by content hash. It reports:

- Missing `info`, `ws`, and `exchange` commands.
- Missing top-level info request fields and directly declared deployer variants.
- Request-documentation changes against the reviewed snapshot checked into this repository, plus response/prose/protocol-page changes requiring review.
- Removed documentation entries and methods exposed by the SDK but not found in those docs.
- Unparsed or missing pages/sections, which prevent a clean audit result.

Exit codes: **0** coverage checks pass, **2** missing mappings or review-required changes, **3** parser/page coverage is inconclusive; operational failures use **1**. The same snapshots and registry produce the same report. Request-text hashes detect changes but do not prove semantic compatibility, and this is not a complete nested schema comparison. Newly discovered pages with unknown formats are reported as unparsed. SDK-only methods are explicitly unverified against these documentation pages.

The scheduled GitHub workflow saves the report and upstream snapshot as artifacts and fails when attention is needed. It does not silently update signing behavior or publish releases.

Maintainer update sequence:

1. Run the audit and inspect upstream changes.
2. Update the pinned SDK and/or explicit extensions; review action permissions.
3. Run `pnpm api:manifest` and review the generated command/schema diff.
4. Add fixtures for changed inputs and behavior; run checks.
5. Update `api-docs-snapshot.json` only after reviewing the changed requests.

## Migration from 0.0.x

This is an intentionally breaking beta. `account add/ls/remove/set-default` and `upgrade` remain. The previous `order`, `asset`, `markets`, account display commands, and `server` interface have been removed. Use `info`, `ws`, and `exchange`; replace `server` with `core`. `hl-server` is no longer installed. Human-friendly commands and a trading TUI are a separate iteration.

## Development

```sh
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm api:manifest --check
npm run api:audit -- --snapshot api-docs-snapshot.json
# Optional live read/WebSocket test; never places trades:
node --import tsx scripts/smoke.ts
```

Unit tests cover registry generation, account capabilities, signing payloads with mocked transport, docs drift, database migration, nonce allocation, subscription sharing, and legacy cleanup. Live write acceptance still requires controlled testnet verification.
