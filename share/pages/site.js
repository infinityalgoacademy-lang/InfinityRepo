// The site's own data for the Pages preview routes (/r/...), read from the deployment's assets instead of a
// second host. Kept in memory for ten minutes per isolate, so the nightly refresh lands within that window.
import { knowOwners } from "../../docs/js/avatar.js"
import { altSlug } from "../src/altcard.js"

let memo = { at: 0, origin: "" }

export async function site(env, origin) {
  if (memo.data && memo.origin === origin && Date.now() - memo.at < 6e5) return memo
  const one = async (path) => {
    const res = await env.ASSETS.fetch(new URL(`/data/${path}`, origin))
    return res.ok ? res.json() : null
  }
  // the site's data lives in data/; the old top-level address is the fallback while a deploy rolls out
  const get = async (f) => (await one(f)) ?? env.ASSETS.fetch(new URL(`/${f}`, origin)).then((r) => (r.ok ? r.json() : null))
  const [data, vitals, art, fit] = await Promise.all([get("data.json"), get("vitals.json"), get("art.json"), get("fit.json")])
  if (!data) throw new Error("site data unavailable")
  knowOwners(data.repos)
  memo = {
    at: Date.now(), origin, data, vitals: vitals ?? {}, art: art ?? {}, fit: fit ?? {},
    alts: new Map(data.repos.flatMap((r) => r.alt ?? []).map((a) => [altSlug(a), a])), // slug -> product name
    byName: new Map(data.repos.map((r) => [r.r.toLowerCase(), r])),
    area: new Map(data.taxonomy.areas.flatMap((a) => a.subs.map(([id, n]) => [`${a.id}/${id}`, n]))),
  }
  return memo
}
