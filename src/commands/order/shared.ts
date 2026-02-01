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
  publicClient: { meta: () => Promise<{ universe: Array<{ name: string }> }> },
  coin: string
): Promise<number> {
  const meta = await publicClient.meta()
  const assetIndex = meta.universe.findIndex(
    (a) => a.name.toUpperCase() === coin.toUpperCase()
  )
  if (assetIndex === -1) {
    throw new Error(`Unknown coin: ${coin}`)
  }
  return assetIndex
}
