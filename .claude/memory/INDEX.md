# Project memory index

Durable, project-scoped facts for Focus Reader. Committed so they travel between
machines. Imported into context by the project `CLAUDE.md` via
`@.claude/memory/INDEX.md`.

- [Highlight API architecture](highlight-api-architecture.md) — why ranges + `::highlight()` instead of `<b>` wrapping; `font-weight` is unavailable so bold is faked with `text-shadow`; canvas/shadow-DOM/iframes are permanently out of reach
- [Site-compat heuristics](site-compat-heuristics.md) — four gotchas found only against live sites: `pre-wrap` is prose not preformatted, monospace is the code signal, `childList` must invalidate the verdict cache, never score `block.textContent`
- [Trademark constraint](trademark-constraint.md) — "Bionic Reading" is registered incl. US 5557651 with a 2022 enforcement history; hence Focus Reader, and zero instances of the phrase in the shipped bundle
- [Store release state](store-release-state.md) — v0.1.0 went Public 2026-08-20, so every later upload needs a `version` bump first; the toggle work is in-tree and unreleased
