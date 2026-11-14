// Checks the vital-signs rules in docs/js/vitals.js. Run: node scripts/vitals.test.mjs
import { strict as assert } from "node:assert"
import { signs, momentum, summary, issuesText } from "../docs/js/vitals.js"

const busy = signs({ release: ["v1", "2026-10-22"], weeks: [35, 27, 40, 18, 22, 34, 32, 20, 17, 13, 33, 44], opened: 222, closed: 164 }, "2026-11-07")
assert.deepEqual([busy.activity.level, busy.release.level, busy.issues.level, busy.release.ago], ["good", "good", "good", 16])
const quiet = signs({ release: null, weeks: Array(12).fill(0), opened: 2, closed: 0 }, "2026-11-07")
assert.deepEqual([quiet.activity.level, quiet.release.level, quiet.issues.level], ["low", "none", "none"])
const lagging = signs({ release: ["v0", "2025-01-01"], weeks: [0, 0, 3, 0, 0, 0, 0, 0, 1, 0, 0, 0], opened: 40, closed: 8 }, "2026-11-07")
assert.deepEqual([lagging.activity.level, lagging.release.level, lagging.issues.level], ["ok", "low", "low"])
assert.equal(signs({ release: null, weeks: Array(12).fill(1), opened: 10, closed: 30 }, "2026-11-07").issues.pct, 1) // old issues closed count, capped
const rs = Array.from({ length: 8 }, (_, i) => ({ a: "dev", sa: "apis", w: 80 - i * 10 }))
assert.deepEqual([momentum(rs[0], rs).level, momentum(rs[3], rs).level, momentum(rs[7], rs).level, momentum(rs[1], rs).rank], ["good", "ok", "low", 2])
assert.equal(summary(busy), "Steady commits, last release 16 days ago, 74% as many issues closed as opened")
assert.equal(issuesText(1), "issues closed as fast as they open")
console.log("vitals rules ok")
