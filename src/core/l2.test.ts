import { expect, it, vi } from "vitest"
import { deflateRawSync } from "node:zlib"
import { WebSocketTransport } from "@nktkas/hyperliquid"
import { L2State, subscribeL2 } from "./l2.js"
import { Broker } from "./broker.js"
const snapshot = { s: { coin: "BTC", time: 1, levels: [
  [{ px: "100", sz: "1", n: 1 }, { px: "99", sz: "2", n: 2 }],
  [{ px: "101", sz: "1", n: 1 }],
] as [{ px: string; sz: string; n: number }[], { px: string; sz: string; n: number }[]] } }
it("applies compressed removals before upserts and waits for a new snapshot after reset", () => {
  const state = new L2State("BTC")
  const diff = { c: "BTC", t: 2, l: [[{ p: "102", s: "3" }], []], r: [[1], []] }
  const frame = { c: deflateRawSync(JSON.stringify(diff)).toString("base64") }
  expect(state.apply(frame)).toBeUndefined()
  state.apply(snapshot)
  expect(state.apply(frame)?.levels[0]).toEqual([
    { px: "102", sz: "3", n: null }, { px: "100", sz: "1", n: 1 },
  ])
  state.reset()
  expect(state.apply(frame)).toBeUndefined()
  expect(state.apply(snapshot)?.time).toBe(1)
  expect(state.apply({ s: { ...snapshot.s, coin: "ETH" } })).toBeUndefined()
})
it("shares identical tuples, isolates different aggregation, and closes only unused transports", async () => {
  const feeds: { socket: EventTarget; deliver: (frame: unknown) => void; close: ReturnType<typeof vi.fn>; payload: unknown }[] = []
  const factory = () => {
    const socket = new EventTarget()
    const feed = { socket, deliver: (_frame: unknown) => {}, close: vi.fn(), payload: undefined as unknown }
    feeds.push(feed)
    return { socket, close: feed.close, subscribe: async (_channel: string, payload: unknown, callback: (event: { detail: unknown }) => void) => {
      feed.payload = payload
      feed.deliver = (detail) => callback({ detail })
      return { unsubscribe: vi.fn() }
    } } as unknown as WebSocketTransport
  }
  const broker = new Broker((_name, params, listener) => subscribeL2(params, listener, false, factory))
  const a = vi.fn(), b = vi.fn(), c = vi.fn()
  const releaseA = await broker.add("l2", { coin: "BTC" }, a)
  const releaseB = await broker.add("l2", { coin: "BTC", nSigFigs: null }, b)
  const releaseC = await broker.add("l2", { coin: "BTC", nSigFigs: 5, mantissa: 2 }, c)
  expect(feeds).toHaveLength(2)
  expect(feeds[1].payload).toEqual({ type: "l2", c: "BTC", s: 5, m: 2 })
  feeds[0].deliver(snapshot)
  expect(a).toHaveBeenCalledTimes(1)
  expect(b).toHaveBeenCalledTimes(1)
  expect(c).not.toHaveBeenCalled()
  feeds[1].deliver(snapshot)
  expect(c).toHaveBeenCalledTimes(1)
  feeds[1].socket.dispatchEvent(new Event("close"))
  feeds[1].deliver({ u: { c: "BTC", t: 3, l: [[], []] } })
  expect(c).toHaveBeenCalledTimes(1)
  await releaseA()
  expect(feeds[0].close).not.toHaveBeenCalled()
  await releaseB()
  expect(feeds[0].close).toHaveBeenCalledTimes(1)
  expect(feeds[1].close).not.toHaveBeenCalled()
  await releaseC()
  expect(feeds[1].close).toHaveBeenCalledTimes(1)
  expect(broker.size).toBe(0)
})
