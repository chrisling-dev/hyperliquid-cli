import { inflateRawSync } from "node:zlib"
import { WebSocketTransport } from "@nktkas/hyperliquid"
import type { Listener, Subscription } from "./broker.js"

type Level = { px: string; sz: string; n: number | null }
type Book = { coin: string; time: number; levels: [Level[], Level[]] }
type Diff = {
  c: string; t: number
  l: [{ p: string; s: string }[], { p: string; s: string }[]]
  r?: [number[], number[]]
}
type Frame = { s: Book } | { u: Diff } | { c: string }

// Each decoder belongs to exactly one wire subscription. Never infer aggregation
// from a price grid: coarser grids overlap finer grids and cannot identify a stream.
export class L2State {
  private book?: Book
  constructor(private coin: string) {}
  reset() { this.book = undefined }
  apply(frame: Frame): Book | undefined {
    if ("s" in frame) {
      if (frame.s.coin !== this.coin) return
      this.book = structuredClone(frame.s)
    } else {
      const diff: Diff = "u" in frame ? frame.u : JSON.parse(
        inflateRawSync(Buffer.from(frame.c, "base64"), { maxOutputLength: 1024 * 1024 }).toString(),
      )
      if (diff.c !== this.coin || !this.book) return
      const next = structuredClone(this.book)
      for (const side of [0, 1] as const) {
        const levels = next.levels[side]
        const removals = diff.r?.[side] ?? []
        if (new Set(removals).size !== removals.length || removals.some(
          (i) => !Number.isInteger(i) || i < 0 || i >= levels.length,
        )) throw new Error("Invalid l2 removal index; book must be resynchronized")
        for (const i of [...removals].sort((a, b) => b - a)) levels.splice(i, 1)
        for (const update of diff.l[side]) {
          const i = levels.findIndex((level) => Number(level.px) === Number(update.p))
          if (i >= 0) levels.splice(i, 1)
          // Deltas omit order counts. Null means unknown, not zero orders.
          if (Number(update.s) !== 0) levels.push({ px: update.p, sz: update.s, n: null })
        }
        levels.sort((a, b) => side === 0 ? Number(b.px) - Number(a.px) : Number(a.px) - Number(b.px))
      }
      next.time = diff.t
      this.book = next
    }
    return structuredClone(this.book)
  }
}

export async function subscribeL2(
  params: Record<string, unknown>, listener: Listener, isTestnet: boolean,
  createTransport = () => new WebSocketTransport({ isTestnet }),
): Promise<Subscription> {
  // Broker deduplicates identical tuples. Different tuples never share a socket,
  // because l2 frames carry no subscription ID or aggregation parameters.
  const transport = createTransport()
  const state = new L2State(String(params.coin))
  let stopped = false
  const reset = () => state.reset()
  transport.socket.addEventListener("close", reset)
  const payload = { type: "l2", c: params.coin, s: params.nSigFigs ?? null, m: params.mantissa ?? null }
  try {
    const subscription = await transport.subscribe<Frame>("l2", payload, (event) => {
      if (stopped) return
      try {
        const book = state.apply(event.detail)
        if (book) listener(book)
      } catch (error) {
        state.reset()
        // Reconnect requests a fresh snapshot; never continue a corrupted book.
        listener({ error: `l2 decode failed; reconnecting: ${(error as Error).message}` })
        transport.socket.reconnect()
      }
    }, { onError: (error) => listener({ error: error.message }) })
    return { unsubscribe: async () => {
      stopped = true
      state.reset()
      transport.socket.removeEventListener("close", reset)
      try { await subscription.unsubscribe() } finally { await transport.close() }
    } }
  } catch (error) {
    await transport.close()
    throw error
  }
}
