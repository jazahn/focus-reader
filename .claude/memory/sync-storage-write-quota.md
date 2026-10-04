---
name: sync-storage-write-quota
description: chrome.storage.sync rejects writes past 120/min; slider drags used to burn the quota and then the master-off write was silently dropped (issue #4) — coalesce slider writes, surface failed writes
metadata:
  type: project
---

**`chrome.storage.sync.set` is rate-limited** (`MAX_WRITE_OPERATIONS_PER_MINUTE`
= 120, `MAX_WRITE_OPERATIONS_PER_HOUR` = 1800, verified against Chrome 154 on
2026-10-04). Past the limit every `set` rejects with
`This request exceeds the MAX_WRITE_OPERATIONS_PER_MINUTE quota.` for the rest
of that minute. There is no equivalent limit on `chrome.storage.local`.

**Why this matters:** this was the real cause of GitHub issue #4 ("on sites
stay on even after globally turned off"). `effectiveState()` in `content.js`
was correct all along — master off beats any site rule, including legacy
`'on'` values — and every direct toggle scenario passed. What failed was the
*write*: a range input fires `input` on every step of a drag, and the popup
wrote each one straight to sync storage. A few minutes of tuning sliders hit
120/min, after which the master-switch write was rejected. The popup had
already flipped its own `settings` copy and the checkbox, so it showed "off"
while storage still said `enabled: true` and every open tab stayed painted.

**How to apply:**
- `popup.js` now coalesces slider writes (150 ms trailing debounce, flushed on
  `pagehide` so a drag just before the popup closes still lands) and, on any
  rejected write, reloads real stored state, re-renders, and shows a red status
  line. Keep both behaviours when touching the popup.
- Never add a per-event `chrome.storage.sync.set` anywhere (content script,
  Alt+B handler, future options page). `background.js`'s Alt+B handler still
  writes unguarded; it is one write per keypress so it cannot hit the quota on
  its own, but it will fail silently if the popup has just exhausted it.
- Reproduction/regression harness: puppeteer-core against the installed
  Chrome with `launch({ headless: true, enableExtensions: [repoDir] })`
  (`--load-extension` is ignored by branded Chrome 137+), serve the repo over
  `python3 -m http.server`, drive `popup.html` in a tab (its global `save()`
  and the real `#enabled` / slider controls), read
  `CSS.highlights.get('focus-fixation').size` in the article tab. ~130 slider
  `input` events then a click on `#enabled` reproduced the bug every time.

See [[store-release-state]] for the version this shipped in.
