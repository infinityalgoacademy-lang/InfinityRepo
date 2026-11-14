// Preview pages at /r/<owner>/<repo> and /r/instead-of/<slug>: the same Open Graph tags the r.starwire.foo worker
// writes, but served from this deployment, so the link people share is on this site and carries the page address.
// Chat apps read the tags; people are sent on to the app page. Card images live beside them at /card.png.
import { site } from "./site.js"
import { rankAlts } from "../src/altcard.js"
import { signs, summary } from "../../docs/js/vitals.js"

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
const num = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n))
const href = (...parts) => `/${parts.map(encodeURIComponent).join("/")}`
const html = (body) => new Response(body, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=600" } })
const redirect = (to) => new Response(null, { status: 302, headers: { location: to } })

// the shared skeleton: every tag a chat app or social site reads, then the browser on to the app
function tags({ origin, path, title, desc, image, alt, target, note }) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="website"><meta property="og:site_name" content="starwire">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}">
<meta property="og:url" content="${esc(origin + path)}"><meta property="og:image" content="${esc(image)}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${esc(alt)}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${esc(image)}">
<link rel="canonical" href="${esc(target)}"><meta http-equiv="refresh" content="0;url=${esc(target)}">
</head><body style="background:#0b0b0b;color:#f2f2f2;font:16px system-ui;padding:40px"><a style="color:#75d079" href="${esc(target)}">${esc(note)}</a></body></html>`
}

export async function repoPreview(request, env, owner, name) {
  const origin = new URL(request.url).origin
  const s = await site(env, origin), r = s.byName.get(`${owner}/${name}`.toLowerCase())
  if (!r) return redirect(`${origin}/?page=${encodeURIComponent(`${owner}/${name}`)}`)
  const [, short] = r.r.split("/"), today = s.data.updated.slice(0, 10), v = s.vitals[r.r]
  const facts = [`${num(r.s)} stars`, r.w > 0 ? `+${num(r.w)} ${(r.wt ?? "a week").replace(/^~?\+\S+\s*/, "")}` : ""].filter(Boolean).join(", ")
  const desc = [`${facts}.`, v ? `${summary(signs(v, today))}.` : "", r.alt?.length ? `Swaps out ${r.alt.join(", ")}.` : ""].filter(Boolean).join(" ")
  const title = `${short}: ${r.l || "open source repo"}`
  return html(tags({
    origin,
    path: href("r", ...r.r.split("/")),
    title,
    desc,
    image: `${origin}${href("r", ...r.r.split("/"), "card.png")}?v=${today}`,
    alt: `${short} on starwire`,
    target: `${origin}/?page=${encodeURIComponent(r.r)}`,
    note: `Open ${short} on starwire`,
  }))
}

export async function altPreview(request, env, slug) {
  const origin = new URL(request.url).origin
  const s = await site(env, origin), name = s.alts.get(slug.toLowerCase())
  if (!name) return redirect(`${origin}/?alt=all`)
  const ranked = rankAlts(name, s.data.repos, s.fit, healthy(s)), top = ranked.slice(0, 3).map((x) => x.r.r.split("/")[1])
  const list = top.length > 1 ? `${top.slice(0, -1).join(", ")} and ${top.at(-1)}` : top[0]
  const title = `Open source alternatives to ${name}`
  const desc = `${list} ${top.length > 1 ? "lead" : "leads"} the ${ranked.length} on starwire${s.fit?.products?.[name.toLowerCase()] ? `, ranked by how much of what ${name} does each one covers` : ""}.`
  return html(tags({
    origin,
    path: href("r", "instead-of", slug),
    title,
    desc,
    image: `${origin}${href("r", "instead-of", slug, "card.png")}?v=${s.data.updated.slice(0, 10)}`,
    alt: `Instead of ${name}: ${list}`,
    target: `${origin}/?alt=${encodeURIComponent(name)}`,
    note: `See the open source alternatives to ${name} on starwire`,
  }))
}

// ties go to the healthier project, as on the site: how many of activity, releases and issues are green
const healthy = (s) => (r) => {
  const v = s.vitals[r.r]
  if (!v) return -1
  const x = signs(v, s.data.updated.slice(0, 10))
  return [x.activity, x.release, x.issues].filter((y) => y.level === "good").length
}
