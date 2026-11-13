import fs from "node:fs"

const DATA = "docs/data/data.json"
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN
if (!TOKEN) {
  // try gh auth token
  const { execSync } = await import("node:child_process")
  try { process.env.GITHUB_TOKEN = execSync("gh auth token", { encoding: "utf8" }).trim() } catch {}
}
const TOKEN2 = process.env.GITHUB_TOKEN
if (!TOKEN2) { console.error("No GitHub token. Set GITHUB_TOKEN or run gh auth login."); process.exit(1) }

const data = JSON.parse(fs.readFileSync(DATA, "utf8"))
const repos = data.repos
let i = 0
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchRepo(name) {
  const res = await fetch(`https://api.github.com/repos/${name}`, {
    headers: { Authorization: `Bearer ${TOKEN2}`, "User-Agent": "InfnityRepo-updater", Accept: "application/vnd.github+json" },
  })
  if (res.status === 403) {
    const reset = Number(res.headers.get("x-ratelimit-reset")) * 1000
    const wait = Math.max(reset - Date.now(), 60000) + 5000
    console.log(`rate limited, waiting ${Math.round(wait/1000)}s`)
    await sleep(wait)
    return fetchRepo(name)
  }
  if (!res.ok) return null
  return res.json()
}

for (const r of repos) {
  i++
  try {
    const gh = await fetchRepo(r.r)
    if (gh) {
      r.s = gh.stargazers_count ?? r.s
      r.fk = gh.forks_count ?? r.fk
      r.p = gh.pushed_at ?? r.p
      r.ca = (gh.created_at || r.ca || "").slice(0, 10)
      r.l = gh.description || r.l
      r.li = (gh.license && gh.license.spdx_id) || r.li
      r.g = gh.language || r.g
      r.hp = gh.homepage || r.hp
      r.t = gh.topics || r.t
    }
  } catch (e) {
    console.warn(r.r, e.message)
  }
  if (i % 50 === 0) {
    fs.writeFileSync(DATA, JSON.stringify(data, null, 1))
    console.log(`updated ${i}/${repos.length}`)
  }
  await sleep(750) // ~4800/hour, under 5000 limit
}
fs.writeFileSync(DATA, JSON.stringify(data, null, 1))
console.log(`done: ${repos.length} repos`)
