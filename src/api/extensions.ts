import * as v from "valibot"
// Explicit additions documented upstream but not yet available in the pinned SDK.
// Keep action field order: it is part of Hyperliquid's msgpack signing contract.
const uint = v.pipe(v.number(), v.safeInteger(), v.minValue(0))
const decimal = v.pipe(v.string(), v.regex(/^\d+(\.\d+)?$/))
const positive = v.pipe(
  decimal,
  v.check((s) => Number(s) > 0, "Must be positive"),
)
const trailingStop = v.object({
  type: v.literal("trailingStop"),
  asset: uint,
  isBuy: v.boolean(),
  sz: positive,
  reduceOnly: v.boolean(),
  retracement: v.union([
    v.object({ pct: v.pipe(v.string(), v.regex(/^\d+(\.\d+)?%$/)) }),
    v.object({ px: positive }),
  ]),
  activationPx: v.nullable(positive),
})
const cDeposit2 = v.object({ type: v.literal("cDeposit2"), wei: uint })
export const extensions = [
  {
    family: "info",
    name: "outcomeDeployerLimits",
    permission: "public",
    description: "Retrieve outcome deployer limits.",
    schema: v.object({
      type: v.literal("outcomeDeployerLimits"),
      venue: v.string(),
    }),
  },
  {
    family: "exchange",
    name: "trailingStop",
    permission: "agent",
    description: "Place a trailing stop order.",
    schema: v.object({
      action: trailingStop,
      vaultAddress: v.optional(v.string()),
      expiresAfter: v.optional(uint),
    }),
  },
  {
    family: "exchange",
    name: "cDeposit2",
    permission: "agent",
    description: "Deposit into staking using an agent or master wallet.",
    schema: v.object({ action: cDeposit2, expiresAfter: v.optional(uint) }),
  },
] as const

// Deployer APIs evolve independently of trading. Extend only the documented variants;
// existing variants continue to use the SDK's canonicalization/signing adapter.
import {
  PerpDeployRequest,
  SpotDeployRequest,
  OrderRequest,
  CancelRequest,
} from "@nktkas/hyperliquid/api/exchange"
const address = v.pipe(v.string(), v.regex(/^0x[0-9a-fA-F]{40}$/))
const venue = v.pipe(v.string(), v.regex(/^[a-z]{2,4}$/))
const pair = v.tuple([v.string(), v.string()])
const pairs = v.pipe(
  v.array(pair),
  v.check(
    (rows) => rows.every((row, i) => i === 0 || rows[i - 1][0] < row[0]),
    "Tuple keys must be unique and lexicographically sorted",
  ),
  v.description("Lexicographically sorted list of [key, value] tuples."),
)
const instance = v.object({ id: v.string(), keywordToValue: pairs })
const feeInstance = v.object({
  ...instance.entries,
  deployerFeeScale: v.pipe(
    decimal,
    v.check((s) => Number(s) <= 10, "Maximum fee scale is 10"),
  ),
})
const settlement = v.object({
  outcome: uint,
  settleFraction: v.pipe(
    decimal,
    v.check((s) => Number(s) <= 1, "Settlement fraction must be <= 1"),
  ),
  details: v.literal(""),
  nameAndDescription: pair,
  sideNames: pair,
})
const outcome = v.object({
  type: v.literal("outcomeDeploy"),
  venue,
  operation: v.union([
    v.object({ registerStandaloneOutcomeFromTemplate: feeInstance }),
    v.object({
      registerQuestionFromTemplate: v.object({
        questionTemplateInstance: feeInstance,
        namedOutcomeTemplateInstances: v.array(instance),
      }),
    }),
    v.object({
      registerAndAssociateNamedOutcomeFromTemplate: v.object({
        question: uint,
        namedOutcomeTemplateInstance: instance,
      }),
    }),
    v.object({ settleOutcome: settlement }),
    v.object({
      settleQuestion2: v.object({
        question: uint,
        outcomeSettlements: v.array(settlement),
        nameAndDescription: pair,
      }),
    }),
    v.object({
      setSubDeployers: v.array(
        v.object({
          variant: v.picklist([
            "registerStandaloneOutcomeFromTemplate",
            "registerQuestionFromTemplate",
            "registerAndAssociateNamedOutcomeFromTemplate",
            "settleOutcome",
            "settleQuestion",
          ]),
          user: address,
          allowed: v.boolean(),
        }),
      ),
    }),
  ]),
})
const activation = v.union([
  v.object({
    type: v.literal("activateOutcomeDeployer"),
    activate: v.object({ venueName: venue }),
  }),
  v.object({
    type: v.literal("activateOutcomeDeployer"),
    deactivate: v.null(),
  }),
])
const proxy = v.union([
  v.object({ modifyApproval: v.boolean() }),
  v.object({ modifyBackstopLiquidatorApproval: v.boolean() }),
  v.object({ setReduceOnly: v.boolean() }),
  v.object({ cancel: v.omit(CancelRequest.entries.action, ["type"]) }),
  v.object({ order: v.omit(OrderRequest.entries.action, ["type"]) }),
  v.object({
    cancelAll: v.object({ assets: v.optional(v.nullable(v.array(uint))) }),
  }),
  v.object({ sendAsset: v.object({ destination: address, amount: decimal }) }),
])
const star = v.object({
  dex: v.string(),
  operation: v.union([
    v.object({ proxy: v.tuple([address, proxy]) }),
    v.object({ setOracle: v.object({ oraclePxs: pairs }) }),
  ]),
})
const perp = v.union([
  PerpDeployRequest.entries.action,
  v.object({
    type: v.literal("perpDeploy"),
    setFundingClamps: v.array(
      v.tuple([
        v.string(),
        v.pipe(
          decimal,
          v.check((s) => Number(s) <= 0.01, "Maximum clamp is 0.01"),
        ),
      ]),
    ),
  }),
  v.object({
    type: v.literal("perpDeploy"),
    setDeployerFees: v.array(
      v.tuple([
        v.string(),
        v.object({ scale: decimal, growthMode: v.boolean() }),
      ]),
    ),
  }),
  v.object({ type: v.literal("perpDeploy"), star }),
])
const spot = v.union([
  SpotDeployRequest.entries.action,
  v.object({
    type: v.literal("spotDeploy"),
    enableAlignedQuoteToken: v.object({ token: uint }),
  }),
  v.object({
    type: v.literal("spotDeploy"),
    disableAlignedQuoteToken: v.object({ token: uint }),
  }),
  v.object({
    type: v.literal("spotDeploy"),
    setTokenAnnotation: v.object({
      token: uint,
      annotation: v.object({
        category: v.pipe(v.string(), v.maxLength(15)),
        description: v.pipe(v.string(), v.maxLength(400)),
        displayName: v.nullable(v.pipe(v.string(), v.maxLength(9))),
        keywords: v.pipe(
          v.array(v.pipe(v.string(), v.maxLength(10))),
          v.maxLength(2),
        ),
      }),
    }),
  }),
  v.object({
    type: v.literal("spotDeploy"),
    setDeployerLabel: v.object({ label: venue }),
  }),
])
export const deployerExtensions = [
  {
    family: "info",
    name: "userStarState",
    permission: "public",
    description: "Read HIP-3 star user approvals.",
    schema: v.object({ type: v.literal("userStarState"), user: address }),
  },
  {
    family: "exchange",
    name: "outcomeDeploy",
    permission: "master",
    description: "Deploy or manage HIP-4 outcomes (testnet only).",
    schema: v.object({ action: outcome, expiresAfter: v.optional(uint) }),
  },
  {
    family: "exchange",
    name: "activateOutcomeDeployer",
    permission: "master",
    description:
      "Activate or permanently deactivate a HIP-4 deployer (testnet only).",
    schema: v.object({ action: activation, expiresAfter: v.optional(uint) }),
  },
  {
    family: "exchange",
    name: "perpDeploy",
    permission: "master",
    description: "Deploy and manage HIP-3 perpetual DEXs.",
    schema: v.object({ ...PerpDeployRequest.entries, action: perp }),
  },
  {
    family: "exchange",
    name: "spotDeploy",
    permission: "master",
    description: "Deploy and manage spot tokens and pairs.",
    schema: v.object({ ...SpotDeployRequest.entries, action: spot }),
  },
] as const
export const customVariants: Record<string, string[]> = {
  perpDeploy: ["setFundingClamps", "setDeployerFees", "star"],
  spotDeploy: [
    "enableAlignedQuoteToken",
    "disableAlignedQuoteToken",
    "setTokenAnnotation",
    "setDeployerLabel",
  ],
}
