// Automate adding repositories to StarWire's data/repos.json.
// Usage:
//   node scripts/add-repos.mjs owner/repo owner/repo ...   (add specific repos)
//   node scripts/add-repos.mjs --search "stars:>10000" --pages 2   (pull from GitHub search)
import fs from "node:fs"

const DATA = "docs/data/data.json"
const TODAY = new Date().toISOString().slice(0, 10)

function areaFor(it) {
  const topics = (it.topics || []).map((t) => t.toLowerCase())
  const desc = ((it.description || "") + " " + it.full_name).toLowerCase()
  const lang = (it.language || "").toLowerCase()
  const hay = topics.concat(desc.split(/\W+/))
  if (hay.some((k) => ["llm", "ai", "gpt", "ml", "agent", "transformers"].includes(k))) return ["ai", "llm-tooling", "AI & agents"]
  if (topics.some((k) => ["docker", "kubernetes", "terraform", "devops"].includes(k))) return ["infra", "containers", "Infrastructure & DevOps"]
  if (topics.some((k) => ["database", "sql", "postgres", "mongo", "redis"].includes(k))) return ["data", "databases", "Data"]
  if (hay.some((k) => ["awesome", "list", "book", "roadmap", "interview", "tutorial", "course"].includes(k))) return ["learning", "lists", "Learning & reference"]
  if (["javascript", "typescript"].includes(lang)) return ["web", "frameworks", "Web & frontend"]
  if (lang === "python") return ["ai", "llm-tooling", "AI & agents"]
  if (["go", "rust"].includes(lang)) return ["system", "system-tools", "System & desktop"]
  if (["java", "kotlin", "c#", "csharp"].includes(lang)) return ["dev", "languages", "Developer tools"]
  if (["c", "c++"].includes(lang)) return ["system", "system-tools", "System & desktop"]
  return ["dev", "languages", "Developer tools"]
}

function toEntry(it) {
  const [a, sa, c] = areaFor(it)
  return {
    r: it.full_name,
    a, sa, c,
    l: it.description || "",
    s: it.stargazers_count || 0,
    g: it.language || "Unknown",
    gc: "#888",
    t: it.topics || [],
    p: it.pushed_at,
    f: TODAY,
    h: 0,
    w: 0,
    wt: "+0 a week",
    fk: it.forks_count || 0,
    li: (it.license && it.license.spdx_id) || "Unknown",
    ca: (it.created_at || "").slice(0, 10),
    hp: it.homepage || "",
    fo: ["library"],
    pl: [],
    tg: [],
    sp: it.stargazers_count || 0,
    k: 1,
    oi: (it.owner && it.owner.id) || null,
    alt: [],
    hs: [],
    ai: null,
    mo: null,
    hy: null,
    ww: null,
    ho: null,
  }
}

async function fetchRepo(name) {
  const res = await fetch(`https://api.github.com/repos/${name}`, { headers: { "User-Agent": "starwire-add-repos" } })
  if (!res.ok) throw new Error(`${name}: ${res.status}`)
  return res.json()
}

async function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
async function searchRepos(q, pages) {
  const out = []
  for (let p = 1; p <= pages; p++) {
    let res
    for (let attempt=0; attempt<5; attempt++) {
      res = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(q)}&sort=stars&order=desc&per_page=100&page=${p}`, { headers: { "User-Agent": "starwire-add-repos" } })
      if (res.status === 403) { await sleep(65000); continue }
      break
    }
    if (!res.ok) throw new Error(`search: ${res.status}`)
    const data = await res.json()
    out.push(...(data.items || []))
    if ((data.items || []).length < 100) break
    await sleep(7000)
  }
  return out
}

async function main() {
  const args = process.argv.slice(2)
  const data = JSON.parse(fs.readFileSync(DATA, "utf8"))
  const existing = new Set(data.repos.map((r) => r.r.toLowerCase()))
  let items = []

  if (args.includes("--search")) {
    const qi = args.indexOf("--search")
    const q = args[qi + 1]
    const pi = args.indexOf("--pages")
    const pages = pi >= 0 ? Number(args[pi + 1]) : 1
    items = await searchRepos(q, pages)
  } else {
    for (const name of args) {
      try { items.push(await fetchRepo(name)) } catch (e) { console.warn(e.message) }
    }
  }

  let added = 0
  for (const it of items) {
    if (!it || !it.full_name) continue
    if (existing.has(it.full_name.toLowerCase())) continue
    data.repos.push(toEntry(it))
    existing.add(it.full_name.toLowerCase())
    added++
    console.log("added", it.full_name, it.stargazers_count)
  }
  fs.writeFileSync(DATA, JSON.stringify(data, null, 1))
  console.log(`added ${added}; total ${data.repos.length}`)
}

main().catch((e) => { console.error(e); process.exit(1) })
