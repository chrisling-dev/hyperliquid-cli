// In-memory cache for real-time data from WebSocket subscriptions

export interface CacheEntry<T> {
  data: T
  updatedAt: number
}

export interface AllMidsData {
  [coin: string]: string
}

export interface AssetCtx {
  dayNtlVlm: string
  funding: string
  impactPxs: string[] | null
  markPx: string
  midPx: string | null
  openInterest: string
  oraclePx: string
  premium: string | null
  prevDayPx: string
  dayBaseVlm: string
}

export interface AllDexsAssetCtxsData {
  // dex name -> array of asset contexts
  ctxs: Array<[string, AssetCtx[]]>
}

export interface PerpMeta {
  name: string
  szDecimals: number
  maxLeverage: number
  onlyIsolated?: boolean
}

export interface AllPerpMetasData {
  universe: PerpMeta[]
}

export class ServerCache {
  private allMids: CacheEntry<AllMidsData> | null = null
  private allDexsAssetCtxs: CacheEntry<AllDexsAssetCtxsData> | null = null
  private allPerpMetas: CacheEntry<AllPerpMetasData> | null = null

  // Update methods - called from subscription handlers
  setAllMids(data: AllMidsData): void {
    this.allMids = { data, updatedAt: Date.now() }
  }

  setAllDexsAssetCtxs(data: AllDexsAssetCtxsData): void {
    this.allDexsAssetCtxs = { data, updatedAt: Date.now() }
  }

  setAllPerpMetas(data: AllPerpMetasData): void {
    this.allPerpMetas = { data, updatedAt: Date.now() }
  }

  // Get methods - return data with cache timestamp
  getAllMids(): CacheEntry<AllMidsData> | null {
    return this.allMids
  }

  getAllDexsAssetCtxs(): CacheEntry<AllDexsAssetCtxsData> | null {
    return this.allDexsAssetCtxs
  }

  getAllPerpMetas(): CacheEntry<AllPerpMetasData> | null {
    return this.allPerpMetas
  }

  // Get status info
  getStatus(): {
    hasMids: boolean
    hasAssetCtxs: boolean
    hasPerpMetas: boolean
    midsAge?: number
    assetCtxsAge?: number
    perpMetasAge?: number
  } {
    const now = Date.now()
    return {
      hasMids: this.allMids !== null,
      hasAssetCtxs: this.allDexsAssetCtxs !== null,
      hasPerpMetas: this.allPerpMetas !== null,
      midsAge: this.allMids ? now - this.allMids.updatedAt : undefined,
      assetCtxsAge: this.allDexsAssetCtxs ? now - this.allDexsAssetCtxs.updatedAt : undefined,
      perpMetasAge: this.allPerpMetas ? now - this.allPerpMetas.updatedAt : undefined,
    }
  }
}
