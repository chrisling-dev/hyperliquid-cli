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

Errors are readable text on stderr by default, with a red label and cyan hint in terminals. Use `--json` for structured errors. Redirected output and `NO_COLOR` disable colors.

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

Streaming commands start core automatically. Mainnet and testnet use separate sockets/processes. Core shares a reconnecting upstream WebSocket per network for SDK feeds and reference-counts matching subscriptions. The undocumented `l2` feed uses a separate reconnecting connection per unique coin/nSigFigs/mantissa tuple because its messages do not identify aggregation settings. Identical `l2` requests share that connection across clients. Disconnecting the final local consumer unsubscribes upstream. Slow local clients are disconnected when their pending IPC output exceeds the buffer limit.

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

The schedule is daily at 06:19 UTC (14:19 Malaysia time). GitHub runs cron only
from the default branch: while this workflow exists only on `v1`, it is not
scheduled. It becomes active after v1 lands on `main`; no v1 cron is needed.
Local `npm run api:audit` remains available meanwhile.

When the audit reports drift, inconclusive coverage, or execution failure, the
workflow creates one GitHub issue with a summary and a link to the run/artifacts.
Later failures update that issue. A clean audit closes it; future failures reopen
it. A stable body marker and bot author identify the issue even if its title is
edited. Serialized runs prevent concurrent duplicate creation, and any existing
duplicates are closed. Issue updates run only on the default branch. Subscribe
to the tracking issue for GitHub notifications; repeated failures update its body
without posting daily comments. Setup/build failures before the audit starts
remain workflow failures and do not create an audit issue.

For workflow failure notifications, enable GitHub/email under GitHub Settings →
Notifications → Actions and select failed workflows only. Scheduled notifications
go to the workflow's associated actor, not automatically everyone.
See [GitHub Actions notifications](https://docs.github.com/en/actions/concepts/workflows-and-actions/notifications-for-workflow-runs).
Exit 2 means drift/review required, exit 3 means inconclusive coverage, and exit
1 means the audit could not run; inspect the report/logs to distinguish them.

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

### Undocumented order-book feed

```sh
hl ws l2 --coin BTC
hl ws l2 --coin BTC --nSigFigs 5 --mantissa 2
```

`l2` emits reconstructed full books from a snapshot followed by compressed deltas.
`mantissa` requires `nSigFigs=5`. Updated levels have `n: null` because deltas do not
include order counts. Reconnects clear the book and wait for a fresh snapshot.
This extension is unverified by the official-docs audit and may change upstream.
After updating a running checkout, use `hl core stop` before starting a new stream
so core loads the new implementation.

### Query all perpetual venues without per-DEX loops

```sh
hl info allPerpMetas        # All DEX metadata in one HTTP request
hl ws allDexsAssetCtxs      # All DEX asset contexts in one shared subscription
hl info allMids             # All venue mid prices; defaults to dex=ALL_DEXS
hl ws allMids               # Same default for streaming mid prices
hl info allMids --dex ''    # Native markets only
hl info allMids --dex xyz   # One HIP-3 venue
```

The sentinel is **`ALL_DEXS`**, not `ALL_DEX` or `ALL_DEXES`. The CLI applies
this default to `info allMids` and `ws allMids`; explicit flags/JSON override it.
It is not a universal DEX selector: `meta` and `metaAndAssetCtxs` remain
single-DEX APIs and reject this value upstream. Use `allPerpMetas` for bulk
metadata and `allDexsAssetCtxs` for bulk contexts. For joins, metadata arrays
follow `perpDexs` order (the first/native entry is null); context updates contain
`ctxs: [[dexName, contexts], ...]`, with `""` for the native DEX. Within each DEX,
contexts follow that metadata's `universe` order. Match by DEX and index, not
by flattening arrays from different venues.

### Versions and releases

During the rewrite, API/core and TUI PRs target `v1`. Keep `main` on the existing
release until v1 is ready. For stable launch, merge `v1` into `main`, then use
`main` for ongoing development.

To release a milestone:

1. Bump `package.json` in a PR (`1.0.0-beta.1`, then `1.0.0-beta.2`, etc.).
   Merge beta changes into `v1`; merge stable releases into `main`.
2. In GitHub Releases, create a matching tag such as `v1.0.0-beta.1` targeting
   the merged commit. Mark beta releases as **pre-release**. Stable `v1.0.0`
   must target `main` and must not be marked pre-release.
3. Publish the GitHub Release. `release.yml` checks the version and branch
   ancestry, runs CI, installs and smoke-tests the packed CLI, then publishes
   that exact tarball to npm. Beta versions use `beta`; stable versions use
   `latest`. Feature merges alone do not publish anything.

One-time npm setup: in the `hyperliquid-cli` package settings, add a GitHub
Actions trusted publisher for owner `chrisling-dev`, repository
`hyperliquid-cli`, workflow filename `release.yml`, with no environment name.
Allow direct publishing. This uses OIDC; no npm token secret is required.
See [npm trusted publishing](https://docs.npmjs.com/trusted-publishers/).
The workflow must be present in the tagged commit. Publishing a draft is the
release trigger; merely creating a tag does not publish to npm.

If checks fail before publication, fix the problem and rerun or prepare a new
release as appropriate. Never move a published version's tag or reuse an npm
version; ship a new patch/beta version. `pnpm build && pnpm package:check` runs
the package smoke test locally without publishing or placing trades.

Boolean API flags accept an optional value: `hl ws l2Book --coin BTC --fast`
is equivalent to `--fast true`. Use `--fast false` for an explicit false value.
Omitting a flag preserves the API default or required-field validation; JSON
inputs continue to use JSON booleans.
