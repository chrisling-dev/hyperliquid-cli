import { subscribeL2 } from "./l2.js"
import {
  getMethod,
  validateInput,
  modules,
  inputFields,
} from "../api/registry.js"
export type Listener = (event: unknown) => void
export interface Subscription {
  unsubscribe(): Promise<void>
}
export type Subscribe = (
  name: string,
  params: Record<string, unknown>,
  listener: Listener,
) => Promise<Subscription>
interface Entry {
  listeners: Set<Listener>
  ready: Promise<Subscription>
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`
  return JSON.stringify(value)
}
export class Broker {
  private entries = new Map<string, Entry>()
  constructor(private subscribe: Subscribe) {}
  get size() {
    return this.entries.size
  }
  async add(
    name: string,
    input: Record<string, unknown>,
    listener: Listener,
  ): Promise<() => Promise<void>> {
    const method = getMethod("ws", name)
    const params = validateInput(method, input)
    const key = canonical({ name, params })
    let entry = this.entries.get(key)
    if (!entry) {
      const listeners = new Set<Listener>([listener])
      entry = {
        listeners,
        ready: Promise.resolve().then(() =>
          this.subscribe(method.sdkName, params, (event) => {
            for (const send of listeners) send(event)
          }),
        ),
      }
      this.entries.set(key, entry)
    } else entry.listeners.add(listener)
    try {
      await entry.ready
    } catch (error) {
      this.entries.delete(key)
      throw error
    }
    const target = entry
    return async () => {
      target.listeners.delete(listener)
      if (!target.listeners.size && this.entries.get(key) === target) {
        this.entries.delete(key)
        await (await target.ready).unsubscribe()
      }
    }
  }
}
export function sdkSubscribe(transport: unknown, isTestnet = false): Subscribe {
  return (name, params, listener) => {
    if (name === "l2") return subscribeL2(params, listener, isTestnet)
    const fn = modules.ws[name] as (
      config: unknown,
      params: unknown,
      listener: Listener,
    ) => Promise<Subscription>
    const method = getMethod("ws", name)
    if (!Object.keys(inputFields(method)).length) {
      const withoutParams = modules.ws[name] as (
        config: unknown,
        listener: Listener,
      ) => Promise<Subscription>
      return withoutParams({ transport }, listener)
    }
    return fn({ transport }, params, listener)
  }
}
