// Card images at /r/<owner>/<repo>/card.png and /r/instead-of/<slug>/card.png, drawn with the same renderer as the
// r.starwire.foo worker (src/card.js, src/altcard.js) but from this deployment's data. Cached for a day at the edge.
import { ImageResponse, GoogleFont, cache } from "@cf-wasm/og/workerd"
import { t } from "@cf-wasm/og/html-to-react"
import { cardHTML } from "../src/card.js"
import { altCardHTML, rankAlts } from "../src/altcard.js"
import { pickArt } from "../src/art.js"
import { signs } from "../../docs/js/vitals.js"
import { site } from "./site.js"

const fonts = [400, 600, 700, 800].map((weight) => new GoogleFont("Geist", { weight }))
const png = (body) => new Response(body, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } })

async function cached(request, waitUntil, draw) {
  const hit = await caches.default.match(new Request(request.url))
  if (hit) return hit
  const res = png(await draw())
  waitUntil(caches.default.put(new Request(request.url), res.clone()))
  return res
}

export async function repoCard(request, env, owner, name, waitUntil) {
  const s = await site(env, new URL(request.url).origin), r = s.byName.get(`${owner}/${name}`.toLowerCase())
  if (!r) return new Response("not listed on starwire", { status: 404 })
  const today = s.data.updated.slice(0, 10), v = s.vitals[r.r]
  const base = { v, repos: s.data.repos, today, area: s.area.get(`${r.a}/${r.sa}`) }
  const draw = (art) => ImageResponse.async(t(cardHTML(r, { ...base, art })), { width: 1200, height: 630, fonts })
  // a picture the renderer can't read falls back to the avatar, then to no picture, so a card always comes back
  return cached(request, waitUntil, async () => {
    const first = await pickArt(r.r, s.art[r.r], { cf: { cacheTtl: 86400, cacheEverything: true } })
    for (const art of [first, first?.kind === "avatar" ? null : await pickArt(r.r, undefined), null]) {
      try { const res = await draw(art); await res.clone().arrayBuffer(); return res } catch (e) { console.error(r.r, art?.kind, e?.message) }
    }
    throw new Error("card failed")
  })
}

export async function altCard(request, env, slug, waitUntil) {
  const s = await site(env, new URL(request.url).origin), name = s.alts.get(slug.toLowerCase())
  if (!name) return new Response("not listed on starwire", { status: 404 })
  const healthy = (r) => {
    const v = s.vitals[r.r]
    if (!v) return -1
    const x = signs(v, s.data.updated.slice(0, 10))
    return [x.activity, x.release, x.issues].filter((y) => y.level === "good").length
  }
  const ranked = rankAlts(name, s.data.repos, s.fit, healthy), opts = { cf: { cacheTtl: 86400, cacheEverything: true } }
  const draw = (ps) => ImageResponse.async(t(altCardHTML(name, ps, ranked.length)), { width: 1200, height: 630, fonts })
  return cached(request, waitUntil, async () => {
    const picks = await Promise.all(ranked.slice(0, 3).map(async (p) => ({ ...p, avatar: (await pickArt(p.r.r, undefined, opts))?.src ?? null })))
    // an avatar the renderer can't read: draw the card again without pictures
    for (const ps of [picks, picks.map((p) => ({ ...p, avatar: null }))]) {
      try { const res = await draw(ps); await res.clone().arrayBuffer(); return res } catch (e) { console.error(name, e?.message) }
    }
    throw new Error("alt card failed")
  })
}
