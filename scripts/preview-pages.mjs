// Static preview pages for the share links: /r/<owner>/<repo>/ and /r/instead-of/<slug>/.
// A link pasted into a chat app is fetched without running JS, so the Open Graph tags have to be in the HTML. This
// writes one small page per repo (and per alternatives page) at build time; the card image itself is drawn by the
// share worker in share/, whose address comes from share/cards.json.
import fs from "node:fs"
import path from "node:path"
import { altSlug, rankAlts } from "../share/src/altcard.js"
import { signs, summary } from "../docs/js/vitals.js"

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
const num = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n))

// site: where the app lives; cards: the share worker's origin (empty until it is deployed, then the generic image)
function config() {
  const file = new URL("../share/cards.json", import.meta.url)
  const conf = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {}
  const site = (process.env.SITE_ORIGIN || conf.site || "https://infinityrepo.pages.dev").replace(/\/$/, "")
  const cards = (process.env.CARD_HOST || conf.cards || "").replace(/\/$/, "")
  return { site, cards: cards || site, generic: !cards }
}

const tags = ({ title, desc, image, alt, url, target, note }) => `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="starwire">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(url)}"><meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(alt)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(image)}">
<link rel="canonical" href="${esc(target)}"><meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body style="background:#0b0b0b;color:#f2f2f2;font:16px system-ui;padding:40px"><a style="color:#75d079" href="${esc(target)}">${esc(note)}</a></body></html>`

const write = (out, rel, body) => {
  const dir = path.join(out, rel)
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, "index.html"), body)
}

export function writePreviews(src, out) {
  const read = (f) => {
    const p = path.join(src, "data", f)
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : {}
  }
  const data = read("data.json")
  if (!data.repos) return { repos: 0, alts: 0 }
  const vitals = read("vitals.json"), fit = read("fit.json")
  const today = data.updated.slice(0, 10), { site, cards, generic } = config()
  const image = (p) => (generic ? `${site}/og.png` : `${cards}${p}?v=${today}`)

  for (const r of data.repos) {
    const [, short] = r.r.split("/"), v = vitals[r.r]
    const facts = [`${num(r.s)} stars`, r.w > 0 ? `+${num(r.w)} ${(r.wt ?? "a week").replace(/^~?\+\S+\s*/, "")}` : ""].filter(Boolean).join(", ")
    const desc = [`${facts}.`, v ? `${summary(signs(v, today))}.` : "", r.alt?.length ? `Swaps out ${r.alt.join(", ")}.` : ""].filter(Boolean).join(" ")
    const target = `${site}/?page=${encodeURIComponent(r.r)}`
    write(out, path.join("r", ...r.r.split("/")), tags({
      title: `${short}: ${r.l || "open source repo"}`,
      desc,
      image: image(`/${r.r}/card.png`),
      alt: `${short} on starwire`,
      url: `${site}/r/${r.r}`,
      target,
      note: `Open ${short} on starwire`,
    }))
  }

  const healthy = (r) => {
    const v = vitals[r.r]
    if (!v) return -1
    const x = signs(v, today)
    return [x.activity, x.release, x.issues].filter((y) => y.level === "good").length
  }
  const alts = new Map()
  for (const r of data.repos) for (const a of r.alt ?? []) alts.set(altSlug(a), a)
  for (const [slug, name] of alts) {
    const ranked = rankAlts(name, data.repos, fit, healthy), top = ranked.slice(0, 3).map((x) => x.r.r.split("/")[1])
    const list = top.length > 1 ? `${top.slice(0, -1).join(", ")} and ${top.at(-1)}` : top[0]
    const target = `${site}/?alt=${encodeURIComponent(name)}`
    write(out, path.join("r", "instead-of", slug), tags({
      title: `Open source alternatives to ${name}`,
      desc: `${list} ${top.length > 1 ? "lead" : "leads"} the ${ranked.length} on starwire${fit?.products?.[name.toLowerCase()] ? `, ranked by how much of what ${name} does each one covers` : ""}.`,
      image: image(`/instead-of/${slug}/card.png`),
      alt: `Instead of ${name}: ${list}`,
      url: `${site}/r/instead-of/${slug}`,
      target,
      note: `See the open source alternatives to ${name} on starwire`,
    }))
  }

  return { repos: data.repos.length, alts: alts.size }
}
