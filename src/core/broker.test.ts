import { describe, it, expect, vi } from "vitest"
import { Broker, canonical, type Listener } from "./broker.js"
describe("shared subscription broker", () => {
  it("deduplicates concurrent subscriptions and releases only the final listener", async () => {
    let deliver: Listener = () => {}
    const unsubscribe = vi.fn(async () => {})
    const subscribe = vi.fn(async (_name, _params, listener) => {
      deliver = listener
      return { unsubscribe }
    })
    const broker = new Broker(subscribe)
    const first = vi.fn(),
      second = vi.fn()
    const [release1, release2] = await Promise.all([
      broker.add("l2Book", { coin: "BTC" }, first),
      broker.add("l2Book", { coin: "BTC" }, second),
    ])
    expect(subscribe).toHaveBeenCalledTimes(1)
    deliver({ levels: [] })
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    await release1()
    expect(unsubscribe).not.toHaveBeenCalled()
    deliver({ levels: [[]] })
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(2)
    await release2()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
    expect(broker.size).toBe(0)
  })
  it("removes failed entries so later subscriptions can retry", async () => {
    const subscribe = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ unsubscribe: async () => {} })
    const broker = new Broker(subscribe)
    await expect(broker.add("allMids", {}, () => {})).rejects.toThrow("offline")
    expect(broker.size).toBe(0)
    await broker.add("allMids", {}, () => {})
    expect(subscribe).toHaveBeenCalledTimes(2)
  })
  it("canonicalizes keys and rejects invalid subscription parameters before upstream work", async () => {
    expect(canonical({ b: 2, a: 1 })).toBe(canonical({ a: 1, b: 2 }))
    const subscribe = vi.fn()
    const broker = new Broker(subscribe)
    await expect(
      broker.add("l2Book", { coin: "BTC", typo: 1 }, () => {}),
    ).rejects.toThrow()
    expect(subscribe).not.toHaveBeenCalled()
  })
})

it("adapts parameterless subscriptions without passing an object as the listener", async () => {
  const { sdkSubscribe } = await import("./broker.js")
  let dispatch: ((event: { detail: unknown }) => void) | undefined
  const transport = {
    subscribe: vi.fn(async (_channel, _payload, listener) => {
      dispatch = listener
      return { unsubscribe: async () => {} }
    }),
  }
  const listener = vi.fn()
  await sdkSubscribe(transport)("allDexsAssetCtxs", {}, listener)
  dispatch!({ detail: { ctxs: [] } })
  expect(listener).toHaveBeenCalledWith({ ctxs: [] })
})
