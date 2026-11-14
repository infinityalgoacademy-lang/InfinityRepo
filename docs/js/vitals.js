// Vital signs: the pipeline measures them (scripts/vitals.mjs) into vitals.json; these rules turn the numbers into
// a level per sign. good / ok / low are colours, never grades shown as words; "none" means there's nothing to judge.
// The same rules are written out on how.html#vitals. Run `node scripts/vitals.test.mjs` to check them.

const DAY = 864e5
export const days = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / DAY)

// v: one repo's vitals ({ release, weeks, opened, closed, gfi, guide }); today: ISO date
export function signs(v, today) {
  const total = v.weeks.reduce((a, b) => a + b, 0), active = v.weeks.filter(Boolean).length
  const ago = v.release ? days(v.release[1], today) : null
  const few = v.opened < 5 && v.closed < 5
  const pct = Math.min(1, v.closed / Math.max(v.opened, 1))
  return {
    activity: { total, active, level: active >= 6 ? "good" : total ? "ok" : "low" },
    release: { ago, tag: v.release?.[0], date: v.release?.[1], level: ago == null ? "none" : ago <= 90 ? "good" : ago <= 365 ? "ok" : "low" },
    issues: { pct, opened: v.opened, closed: v.closed, level: few ? "none" : pct >= 0.6 ? "good" : pct >= 0.3 ? "ok" : "low" },
  }
}

// rank by measured star gain among the repos in the same subarea; top quarter is good
export function momentum(r, repos) {
  if (r.w == null || !r.a) return { level: "none" }
  const peers = repos.filter((x) => x.a === r.a && x.sa === r.sa && x.w != null).sort((a, b) => b.w - a.w)
  const rank = peers.indexOf(r) + 1, n = peers.length
  return { rank, n, level: rank <= Math.max(1, Math.ceil(n / 4)) ? "good" : rank <= Math.ceil(n * 0.6) ? "ok" : "low" }
}

// issues closed in the period against issues opened in it. They are not the same issues, so this is a pace, never
// "N% of new issues closed": closing an old backlog would read as 100% while every new one sat unanswered.
export const issuesText = (pct) => (pct >= 1 ? "issues closed as fast as they open" : `${Math.round(pct * 100)}% as many issues closed as opened`)

// one plain line for the side panel: what the numbers say, no verdict words
export function summary(s) {
  const a = s.activity.level === "good" ? "Steady commits" : s.activity.total ? `${s.activity.total} commits in 12 weeks` : "No commits in 12 weeks"
  const r = s.release.ago == null ? "no releases" : `last release ${s.release.ago < 1 ? "today" : s.release.ago === 1 ? "yesterday" : `${s.release.ago} days ago`}`
  const i = s.issues.level === "none" ? "few new issues" : issuesText(s.issues.pct)
  return `${a}, ${r}, ${i}`
}
