// Pages advanced mode: the only dynamic routes on the site are the preview pages people share (/r/...) and their
// card images. Everything else is the static app, served as before. Living in docs/ means it is picked up whether
// the Pages project publishes docs/ itself or a stamped copy of it.
import { repoPreview, altPreview } from "../share/pages/preview.js"
import { repoCard, altCard } from "../share/pages/card.js"

const seg = (s) => {
  try { return decodeURIComponent(s) } catch { return s }
}

export default {
  async fetch(request, env, ctx) {
    const { pathname } = new URL(request.url)
    const card = pathname.match(/^\/r\/([^/]+)\/([^/]+)\/card\.png$/)
    if (card) {
      return seg(card[1]) === "instead-of"
        ? altCard(request, env, seg(card[2]), ctx.waitUntil)
        : repoCard(request, env, seg(card[1]), seg(card[2]), ctx.waitUntil)
    }
    const alt = pathname.match(/^\/r\/instead-of\/([^/]+)\/?$/)
    if (alt) return altPreview(request, env, seg(alt[1]))
    const repo = pathname.match(/^\/r\/([^/]+)\/([^/]+)\/?$/)
    if (repo) return repoPreview(request, env, seg(repo[1]), seg(repo[2]))
    return env.ASSETS.fetch(request)
  },
}
