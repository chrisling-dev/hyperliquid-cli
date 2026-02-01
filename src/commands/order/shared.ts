export type Side = "buy" | "sell"

export function validateSideWithAliases(value: string): Side {
  const lower = value.toLowerCase()
  if (lower === "long" || lower === "buy") {
    return "buy"
  }
  if (lower === "short" || lower === "sell") {
    return "sell"
  }
  throw new Error('Side must be "buy", "sell", "long", or "short"')
}

export async function getAssetIndex(
  publicClient: {
    allPerpMetas: () => Promise<Array<{ universe: Array<{ name: string }> }>>
    spotMeta: () => Promise<{ universe: Array<{ name: string }> }>
  },
  coin: string,
): Promise<number> {
  // Fetch all perp metas (includes main dex at index 0 and builder dexes at index 1+)
  const allPerpMetas = await publicClient.allPerpMetas()

  // Check all perp dexes (case-sensitive matching)
  for (let dexIndex = 0; dexIndex < allPerpMetas.length; dexIndex++) {
    const dex = allPerpMetas[dexIndex]
    const marketIndex = dex.universe.findIndex((a) => a.name === coin)
    if (marketIndex !== -1) {
      if (dexIndex === 0) {
        // Main perp: just the index
        return marketIndex
      } else {
        // Builder-deployed perp: 100000 + perp_dex_index * 10000 + index_in_meta
        return 100000 + dexIndex * 10000 + marketIndex
      }
    }
  }

  // Then check spot markets (case-sensitive matching)
  const spotMeta = await publicClient.spotMeta()
  const spotIndex = spotMeta.universe.findIndex((a) => a.name === coin)
  if (spotIndex !== -1) {
    // Spot assets use 10000 + index per Hyperliquid API docs
    return 10000 + spotIndex
  }

  throw new Error(`Unknown coin: ${coin}`)
}
