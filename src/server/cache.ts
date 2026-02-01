// In-memory cache for real-time data from WebSocket subscriptions

import { AllPerpMetasResponse, SpotMetaResponse } from "@nktkas/hyperliquid"
import { AllDexsAssetCtxsEvent, SpotAssetCtxsEvent } from "@nktkas/hyperliquid/api/subscription"

export interface CacheEntry<T> {
  data: T
  updatedAt: number
}

export interface AllMidsData {
  [coin: string]: string
}

export class ServerCache {
  private allMids: CacheEntry<AllMidsData> | null = null
  private allDexsAssetCtxs: CacheEntry<AllDexsAssetCtxsEvent> | null = null
  private allPerpMetas: CacheEntry<AllPerpMetasResponse> | null = null
  private spotMeta: CacheEntry<SpotMetaResponse> | null = null
  private spotAssetCtxs: CacheEntry<SpotAssetCtxsEvent> | null = null

  // Update methods - called from subscription handlers
  setAllMids(data: AllMidsData): void {
    this.allMids = { data, updatedAt: Date.now() }
  }

  setAllDexsAssetCtxs(data: AllDexsAssetCtxsEvent): void {
    this.allDexsAssetCtxs = { data, updatedAt: Date.now() }
  }

  setAllPerpMetas(data: AllPerpMetasResponse): void {
    this.allPerpMetas = { data, updatedAt: Date.now() }
  }

  setSpotMeta(data: SpotMetaResponse): void {
    this.spotMeta = { data, updatedAt: Date.now() }
  }

  setSpotAssetCtxs(data: SpotAssetCtxsEvent): void {
    this.spotAssetCtxs = { data, updatedAt: Date.now() }
  }

  // Get methods - return data with cache timestamp
  getAllMids(): CacheEntry<AllMidsData> | null {
    return this.allMids
  }

  getAllDexsAssetCtxs(): CacheEntry<AllDexsAssetCtxsEvent> | null {
    return this.allDexsAssetCtxs
  }

  getAllPerpMetas(): CacheEntry<AllPerpMetasResponse> | null {
    return this.allPerpMetas
  }

  getSpotMeta(): CacheEntry<SpotMetaResponse> | null {
    return this.spotMeta
  }

  getSpotAssetCtxs(): CacheEntry<SpotAssetCtxsEvent> | null {
    return this.spotAssetCtxs
  }

  // Get status info
  getStatus(): {
    hasMids: boolean
    hasAssetCtxs: boolean
    hasPerpMetas: boolean
    hasSpotMeta: boolean
    hasSpotAssetCtxs: boolean
    midsAge?: number
    assetCtxsAge?: number
    perpMetasAge?: number
    spotMetaAge?: number
    spotAssetCtxsAge?: number
  } {
    const now = Date.now()
    return {
      hasMids: this.allMids !== null,
      hasAssetCtxs: this.allDexsAssetCtxs !== null,
      hasPerpMetas: this.allPerpMetas !== null,
      hasSpotMeta: this.spotMeta !== null,
      hasSpotAssetCtxs: this.spotAssetCtxs !== null,
      midsAge: this.allMids ? now - this.allMids.updatedAt : undefined,
      assetCtxsAge: this.allDexsAssetCtxs ? now - this.allDexsAssetCtxs.updatedAt : undefined,
      perpMetasAge: this.allPerpMetas ? now - this.allPerpMetas.updatedAt : undefined,
      spotMetaAge: this.spotMeta ? now - this.spotMeta.updatedAt : undefined,
      spotAssetCtxsAge: this.spotAssetCtxs ? now - this.spotAssetCtxs.updatedAt : undefined,
    }
  }
}
