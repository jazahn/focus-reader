# Project memory index

Durable, project-scoped facts for Focus Reader. Committed so they travel between
machines. Imported into context by the project `CLAUDE.md` via
`@.claude/memory/INDEX.md`.

- [Highlight API architecture](highlight-api-architecture.md) — why ranges + `::highlight()` instead of `<b>` wrapping; `font-weight` is unavailable so bold is faked with `text-shadow`; canvas/shadow-DOM/iframes are permanently out of reach
- [Site-compat heuristics](site-compat-heuristics.md) — four gotchas found only against live sites: `pre-wrap` is prose not preformatted, monospace is the code signal, `childList` must invalidate the verdict cache, never score `block.textContent`
- [Trademark constraint](trademark-constraint.md) — "Bionic Reading" is registered incl. US 5557651 with a 2022 enforcement history; hence Focus Reader, and zero instances of the phrase in the shipped bundle
- [Store release state](store-release-state.md) — store id `nkjiekhhenickfmfphkncpofpcchbdpc` serves v0.2.0 (confirmed 2026-10-04), so the next upload needs ≥ 0.2.1; 0.2.1 (issue #4 fix) is in-tree and unreleased; no release tags exist
- [Sync storage write quota](sync-storage-write-quota.md) — `chrome.storage.sync.set` rejects past 120 writes/min; per-step slider writes burned it and the master-off write was silently dropped (root cause of issue #4); popup now debounces sliders and surfaces failed writes; never add per-event sync writes
- [iOS Safari port](ios-safari-port.md) — planned 2026-10-04, tracked in GitHub issue #7; same-repo `safari/` wrapper via `safari-web-extension-converter --no-copy-resources`; Highlight API needs Safari 17.2+ (silent blank below); nothing built yet
