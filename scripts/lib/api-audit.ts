import { createHash } from "node:crypto"
import { methods, fields } from "../../src/api/registry.js"
export const DOC_ROOT = "https://hyperliquid.gitbook.io/hyperliquid-docs"
export interface Page {
  url: string
  text: string
}
export interface Snapshot {
  format: 1
  pages: Page[]
}
export interface DocumentedMethod {
  family: string
  name: string
  source: string
  heading: string
  hash: string
  fields: string[]
}
const referencePages = new Set([
  "notation",
  "asset-ids",
  "tick-and-lot-size",
  "nonces-and-api-wallets",
  "websocket",
  "websocket/post-requests",
  "websocket/timeouts-and-heartbeats",
  "error-responses",
  "signing",
  "rate-limits-and-user-limits",
  "activation-gas-fee",
  "optimizing-latency",
  "priority-fees",
  "usdc",
])
const deployerPages = new Set([
  "deploying-hip-1-and-hip-2-assets",
  "hip-3-deployer-actions",
  "hip-3-deployer-actions-1",
  "hip-4-deployer-actions",
])
const hash = (text: string) =>
  createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex")
export function parseDocs(pages: Page[]) {
  const entries: DocumentedMethod[] = []
  const errors: string[] = []
  for (const page of pages) {
    const slug = page.url.split("/for-developers/api/")[1]?.replace(/\.md$/, "")
    if (referencePages.has(slug)) continue
    if (deployerPages.has(slug)) {
      const blocks = [
        ...page.text.matchAll(/```(?:json|typescript)?\n([\s\S]*?)```/g),
      ].map((m) => m[1])
      let found = 0
      for (const block of blocks) {
        for (const name of new Set(
          [...block.matchAll(/"?type"?\s*:\s*"([A-Za-z0-9]+)"/g)].map(
            (m) => m[1],
          ),
        )) {
          found++
          entries.push({
            family: page.text.includes("`" + name + "` info request")
              ? "info"
              : "exchange",
            name,
            source: page.url,
            heading: `example:${found}`,
            hash: hash(block),
            fields: [
              ...new Set(
                [
                  ...block.matchAll(
                    /"?type"?\s*:\s*"([A-Za-z0-9]+)"[;,]\s*"?([A-Za-z0-9]+)"?\??\s*:/g,
                  ),
                ]
                  .filter((m) => m[1] === name)
                  .map((m) => m[2]),
              ),
            ],
          })
        }
      }
      if (!found)
        errors.push(`No action examples found in deployer page: ${page.url}`)
      continue
    }
    const family = page.url.includes("/websocket/subscriptions")
      ? "ws"
      : page.url.includes("/info-endpoint")
        ? "info"
        : page.url.includes("/exchange-endpoint")
          ? "exchange"
          : undefined
    if (!family) {
      errors.push(`Unrecognized API page: ${page.url}`)
      continue
    }
    const sections =
      family === "ws"
        ? page.text.split(/(?=^\d+\.\s)/m).filter((s) => /^\d+\./.test(s))
        : page.text.split(/(?=^## )/m).filter((s) => /`POST`/.test(s))
    if (!sections.length) {
      errors.push(`No request sections found: ${page.url}`)
      continue
    }
    for (const section of sections) {
      const heading = section.split("\n")[0]
      const request =
        family === "ws"
          ? section.split(/^### /m)[0]
          : section
              .split(
                /(?:#### (?:Request )?Body|\*\*(?:Request )?Body\*\*)\s*/i,
              )[1]
              ?.trimStart()
              .split(/\n\s*\n/)[0]
      if (!request) {
        errors.push(`${page.url}: cannot parse ${heading}`)
        continue
      }
      const name =
        family === "info"
          ? request.match(
              /^\|\s*type[^\n]*?\|\s*String\s*\|\s*["`]?([A-Za-z0-9]+)["`]?/m,
            )?.[1]
          : request.match(/["`]type["`]\s*:\s*"([A-Za-z0-9]+)"/)?.[1]
      if (!name) {
        errors.push(`${page.url}: cannot identify request type in ${heading}`)
        continue
      }
      const names =
        family === "info"
          ? [
              ...request.matchAll(
                /^\|\s*([a-zA-Z][a-zA-Z0-9]*)\s*(?:<mark[^|]*|)\|/gm,
              ),
            ]
              .map((m) => m[1])
              .filter((n) => n !== "Name" && n !== "type")
          : []
      entries.push({
        family,
        name,
        source: page.url,
        heading,
        hash: hash(request),
        fields: [...new Set(names)].sort(),
      })
    }
  }
  return { entries, errors }
}
export async function fetchSnapshot(): Promise<Snapshot> {
  async function fetchText(url: string) {
    const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
    if (!response.ok)
      throw new Error(`Docs fetch failed: ${response.status} ${url}`)
    return response.text()
  }
  const index = await fetchText(`${DOC_ROOT}/llms.txt`)
  const urls = [
    ...new Set(
      [...index.matchAll(/\]\((https:\/\/[^)]+)\)/g)]
        .map((m) => m[1])
        .filter(
          (url) =>
            url.startsWith(`${DOC_ROOT}/for-developers/api/`) &&
            url.endsWith(".md"),
        ),
    ),
  ].sort()
  if (
    !urls.some((u) => u.endsWith("/info-endpoint.md")) ||
    !urls.some((u) => u.endsWith("/exchange-endpoint.md")) ||
    !urls.some((u) => u.endsWith("/subscriptions.md"))
  )
    throw new Error("Documentation index is incomplete or its format changed")
  return {
    format: 1,
    pages: await Promise.all(
      urls.map(async (url) => ({ url, text: await fetchText(url) })),
    ),
  }
}
export function audit(snapshot: Snapshot, baseline?: Snapshot) {
  if (snapshot.format !== 1 || !Array.isArray(snapshot.pages))
    throw new Error("Unsupported documentation snapshot")
  const current = parseDocs(snapshot.pages)
  for (const suffix of [
    "/info-endpoint.md",
    "/exchange-endpoint.md",
    "/websocket/subscriptions.md",
  ]) {
    if (!snapshot.pages.some((p) => p.url.endsWith(suffix)))
      current.errors.push(`Required documentation page missing: ${suffix}`)
  }
  for (const page of baseline?.pages ?? [])
    if (!snapshot.pages.some((p) => p.url === page.url))
      current.errors.push(
        `Baseline documentation page disappeared: ${page.url}`,
      )
  const previous = baseline ? parseDocs(baseline.pages) : undefined
  const key = (m: { family: string; name: string }) => `${m.family}.${m.name}`
  const implemented = new Map(methods.map((m) => [key(m), m]))
  const documented = new Set(current.entries.map(key))
  const uniqueEntries = [
    ...new Map(
      current.entries.map((m) => [`${key(m)}:${m.source}`, m]),
    ).values(),
  ]
  const missing = uniqueEntries
    .filter((m) => !implemented.has(key(m)))
    .map((m) => ({ command: `hl ${m.family} ${m.name}`, source: m.source }))
  const missingFields = [
    ...new Map(
      current.entries
        .flatMap((m) => {
          const local = implemented.get(key(m))
          if (!local) return []
          return m.fields
            .filter((f) => !(f in fields(local.payload)))
            .map((field) => ({
              command: `hl ${m.family} ${m.name}`,
              field,
              source: m.source,
            }))
        })
        .map((item) => [JSON.stringify(item), item]),
    ).values(),
  ]
  const changed = previous
    ? current.entries
        .filter((m) => {
          const old = previous.entries.find(
            (x) =>
              key(x) === key(m) &&
              x.source === m.source &&
              x.heading === m.heading,
          )
          return old && old.hash !== m.hash
        })
        .map((m) => ({
          command: `hl ${m.family} ${m.name}`,
          source: m.source,
          reason:
            "Request documentation changed; schema/behavior review required",
        }))
    : []
  const removed = previous
    ? previous.entries
        .filter((m) => !documented.has(key(m)))
        .map((m) => ({ command: `hl ${m.family} ${m.name}`, source: m.source }))
    : []
  const changedPages = baseline
    ? snapshot.pages
        .filter((page) => {
          const old = baseline.pages.find((p) => p.url === page.url)
          return !old || hash(old.text) !== hash(page.text)
        })
        .map((page) => ({
          source: page.url,
          reason:
            "Documentation page changed; review request, response, or protocol semantics",
        }))
    : []
  const unverified = methods
    .filter((m) => !documented.has(key(m)))
    .map((m) => `hl ${m.family} ${m.name}`)
  const errors = [
    ...current.errors,
    ...(previous?.errors.map((e) => `Baseline: ${e}`) ?? []),
  ]
  return {
    status:
      missing.length || missingFields.length
        ? "outdated"
        : errors.length
          ? "inconclusive"
          : changed.length || removed.length || changedPages.length
            ? "review-required"
            : "covered",
    scope:
      "Documented method coverage, info top-level fields, request-text and protocol-page drift; not proof of semantic or live compatibility",
    baselineCompared: !!baseline,
    documentedMethods: documented.size,
    mappedMethods: methods.length,
    missing,
    missingFields,
    changed,
    changedPages,
    removed,
    unverified,
    errors,
    sourceHashes: snapshot.pages.map((p) => ({
      url: p.url,
      sha256: hash(p.text),
    })),
  }
}
