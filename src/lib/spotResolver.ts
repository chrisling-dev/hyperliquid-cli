import type { InfoClient } from "@nktkas/hyperliquid"

export interface SpotPair {
  name: string // e.g., "@107" or "HYPE/USDC"
  assetId: number // 10000 + index
  baseToken: string
  quoteToken: string
}

interface SpotToken {
  name: string
  szDecimals: number
  weiDecimals: number
  index: number
  tokenId: string
  isCanonical: boolean
  evmContract: string | null
  fullName: string | null
}

interface SpotUniverse {
  tokens: number[] // [baseTokenIndex, quoteTokenIndex]
  name: string
  index: number
  isCanonical: boolean
}

interface SpotMeta {
  tokens: SpotToken[]
  universe: SpotUniverse[]
}

export async function resolveSpotPair(
  client: InfoClient,
  symbol: string
): Promise<SpotPair> {
  const spotMeta = (await client.spotMeta()) as unknown as SpotMeta

  const upperSymbol = symbol.toUpperCase()

  // Check if it's an explicit pair (e.g., "BTC/USDC")
  if (upperSymbol.includes("/")) {
    const [baseSymbol, quoteSymbol] = upperSymbol.split("/")

    // Find the matching pair in universe
    for (const pair of spotMeta.universe) {
      const baseToken = spotMeta.tokens.find((t) => t.index === pair.tokens[0])
      const quoteToken = spotMeta.tokens.find((t) => t.index === pair.tokens[1])

      if (!baseToken || !quoteToken) continue

      if (
        baseToken.name.toUpperCase() === baseSymbol &&
        quoteToken.name.toUpperCase() === quoteSymbol
      ) {
        return {
          name: pair.name,
          assetId: 10000 + pair.index,
          baseToken: baseToken.name,
          quoteToken: quoteToken.name,
        }
      }
    }

    throw new Error(`Spot pair not found: ${symbol}`)
  }

  // Just a symbol (e.g., "BTC") - find pair with USDC quote first
  const pairs: Array<{
    pair: SpotUniverse
    baseToken: SpotToken
    quoteToken: SpotToken
  }> = []

  for (const pair of spotMeta.universe) {
    const baseToken = spotMeta.tokens.find((t) => t.index === pair.tokens[0])
    const quoteToken = spotMeta.tokens.find((t) => t.index === pair.tokens[1])

    if (!baseToken || !quoteToken) continue

    if (baseToken.name.toUpperCase() === upperSymbol) {
      pairs.push({ pair, baseToken, quoteToken })
    }
  }

  if (pairs.length === 0) {
    throw new Error(`No spot pair found for base token: ${symbol}`)
  }

  // Prefer USDC quote
  const usdcPair = pairs.find(
    (p) => p.quoteToken.name.toUpperCase() === "USDC"
  )
  if (usdcPair) {
    return {
      name: usdcPair.pair.name,
      assetId: 10000 + usdcPair.pair.index,
      baseToken: usdcPair.baseToken.name,
      quoteToken: usdcPair.quoteToken.name,
    }
  }

  // Use first available pair
  const first = pairs[0]
  return {
    name: first.pair.name,
    assetId: 10000 + first.pair.index,
    baseToken: first.baseToken.name,
    quoteToken: first.quoteToken.name,
  }
}

export async function resolvePerpAsset(
  client: InfoClient,
  symbol: string
): Promise<{ name: string; assetIndex: number }> {
  const meta = await client.meta()
  const upperSymbol = symbol.toUpperCase()

  const assetIndex = meta.universe.findIndex(
    (a: { name: string }) => a.name.toUpperCase() === upperSymbol
  )

  if (assetIndex === -1) {
    throw new Error(`Unknown perp coin: ${symbol}`)
  }

  return {
    name: meta.universe[assetIndex].name,
    assetIndex,
  }
}
