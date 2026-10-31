# Project memory index

Durable, project-scoped facts for Focus Reader. Committed so they travel between
machines. Imported into context by the project `CLAUDE.md` via
`@.claude/memory/INDEX.md`.

- [Highlight API architecture](highlight-api-architecture.md) — why ranges + `::highlight()` instead of `<b>` wrapping; `font-weight` is unavailable so bold is faked with `text-shadow`; canvas/shadow-DOM/iframes are permanently out of reach
- [Site-compat heuristics](site-compat-heuristics.md) — four gotchas found only against live sites: `pre-wrap` is prose not preformatted, monospace is the code signal, `childList` must invalidate the verdict cache, never score `block.textContent`
- [Trademark constraint](trademark-constraint.md) — "Bionic Reading" is registered incl. US 5557651 with a 2022 enforcement history; hence Focus Reader, and zero instances of the phrase in the shipped bundle
- [Store release state](store-release-state.md) — Chrome store id `nkjiekhhenickfmfphkncpofpcchbdpc` serves v0.2.1 since 2026-10-04; 0.2.2 (Safari compat) is in-tree, unreleased on both stores; no App Store record yet; release flow is dev → PR to main → GitHub release → upload; tags are unreliable (`v1.0.0` is stray, `v0.2.0` points at a 0.1.0 manifest)
- [Sync storage write quota](sync-storage-write-quota.md) — `chrome.storage.sync.set` rejects past 120 writes/min; per-step slider writes burned it and the master-off write was silently dropped (root cause of issue #4); popup now debounces sliders and surfaces failed writes; never add per-event sync writes
- [iOS Safari port](ios-safari-port.md) — issue #7, re-scoped 2026-10-31: ship via App Store Connect's Safari Web Extension Packager with the same ZIP, no Xcode project in the repo; this Mac (macOS 14.7, Xcode 16.2) cannot run Xcode 26 or deploy to the iOS 26 iPhone; Safari gets a tint not fake bold; `--no-copy-resources` was never a real flag
- [Safari highlight support](safari-highlight-support.md) — Safari ignores `text-shadow` inside `::highlight()` and disallows `-webkit-text-stroke` there since 27.0, so only a `background-color` tint can mark fixations; undetectable at runtime, hence `navigator.vendor` + `tools/highlight-probe.html`; device probe results still to be recorded
