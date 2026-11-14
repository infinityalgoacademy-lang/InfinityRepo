// Refresh docs/data/data.json from the GitHub GraphQL API.
// Usage:
//   node scripts/refresh-data.mjs            refresh every repo
//   LIMIT=200 node scripts/refresh-data.mjs  refresh only the first 200 (testing)
//
// Needs a token in GITHUB_TOKEN / GH_TOKEN, or an authenticated `gh` CLI.
// Updates per repo: s (stars), p (pushedAt), hs (daily star history), w + wt (stars gained a week).
import fs from "node:fs"
import { execSync } from "node:child_process"

const DATA = process.env.DATA_FILE || "docs/data/data.json"
const BATCH = 100
const HISTORY_DAYS = 14
const WEEK = 7
const TODAY = new Date().toISOString().slice(0, 10)

const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || readGhToken()
if (!token) {
  console.error("No GitHub token. Set GITHUB_TOKEN or run `gh auth login`.")
  process.exit(1)
}

function readGhToken() {
  try {
    return execSync("gh auth token", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()
  } catch {
    return null
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const num = (n) => n.toLocaleString("en-US")

const data = JSON.parse(fs.readFileSync(DATA, "utf8"))
const repos = data.repos
const limit = Number(process.env.LIMIT) || repos.length
const targets = repos.slice(0, limit)

async function graphql(query, tries = 0) {
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "InfinityRepo-refresh",
    },
    body: JSON.stringify({ query }),
  })
  if (res.status === 401 || res.status === 403 || res.status === 429) {
    const reset = Number(res.headers.get("x-ratelimit-reset")) * 1000
    const wait = Math.max(reset - Date.now(), 60_000) + 5_000
    if (tries < 2) {
      console.log(`rate limited (${res.status}), waiting ${Math.round(wait / 1000)}s`)
      await sleep(wait)
      return graphql(query, tries + 1)
    }
  }
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const body = await res.json()
  if (!body.data) throw new Error(`GraphQL error: ${JSON.stringify(body.errors ?? body).slice(0, 300)}`)
  return body.data
}

// one query per 100 repos: r0: repository(owner: "", name: "") { ... }
function batchQuery(batch) {
  const parts = batch.map((repo, i) => {
    const [owner, name] = repo.r.split("/")
    return `r${i}: repository(owner: ${JSON.stringify(owner)}, name: ${JSON.stringify(name)}) { nameWithOwner stargazerCount pushedAt }`
  })
  return `query { rateLimit { remaining resetAt } ${parts.join(" ")} }`
}

function weekGain(hs) {
  // hs = [[date, stars], ...] ascending, trimmed to HISTORY_DAYS
  if (hs.length < 2) return null
  const last = hs.at(-1)
  const cutoff = Date.parse(last[0]) - WEEK * 864e5
  const base = hs.find(([d]) => Date.parse(d) >= cutoff) ?? hs[0]
  const days = Math.max(1, Math.round((Date.parse(last[0]) - Date.parse(base[0])) / 864e5))
  const delta = last[1] - base[1]
  const w = days >= WEEK ? delta : Math.round((delta / days) * WEEK)
  return { w, estimate: days < WEEK }
}

let updated = 0
let missing = 0
const started = Date.now()

for (let i = 0; i < targets.length; i += BATCH) {
  const batch = targets.slice(i, i + BATCH)
  const data_ = await graphql(batchQuery(batch))

  batch.forEach((repo, j) => {
    const node = data_[`r${j}`]
    if (!node) {
      missing++
      return
    }
    const stars = node.stargazerCount
    const pushed = node.pushedAt
    let changed = false
    if (repo.s !== stars) {
      repo.s = stars
      changed = true
    }
    if (pushed && repo.p !== pushed) {
      repo.p = pushed
      changed = true
    }

    const hs = repo.hs ?? []
    const last = hs.at(-1)
    if (!last || last[0] < TODAY) hs.push([TODAY, stars])
    else last[1] = stars
    repo.hs = hs.slice(-HISTORY_DAYS)

    const gain = weekGain(repo.hs)
    if (gain) {
      repo.w = gain.w
      repo.wt = `${gain.estimate ? "~" : ""}+${num(gain.w)} a week`
    }
    repo.h = repo.h ?? 0

    if (changed) updated++
  })

  const done = Math.min(i + BATCH, targets.length)
  process.stdout.write(`\r${num(done)}/${num(targets.length)} repos`)
  if (done < targets.length) await sleep(250)
}

data.updated = new Date().toISOString().replace(/\.\d+Z$/, "Z")
fs.writeFileSync(DATA, JSON.stringify(data))

console.log(
  `\nrefreshed ${num(targets.length)} repos (${updated} changed stats, ${missing} not found) in ${Math.round((Date.now() - started) / 1000)}s`,
)
console.log(`stamp: ${data.updated} · file: ${(fs.statSync(DATA).size / 1048576).toFixed(2)} MB`)
