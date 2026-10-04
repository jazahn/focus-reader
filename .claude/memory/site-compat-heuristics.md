---
name: site-compat-heuristics
description: Four hard-won gotchas in the prose-detection heuristics, each found by testing against a real site rather than the test bench
metadata:
  type: project
---

The scoring gates in `content.js` stand in for a reader view. Four corrections
came out of real-site failures, and all four are easy to reintroduce:

1. **Only bare `white-space: pre` may be rejected, never `pre-wrap`.** Every
   WYSIWYG editor — Confluence, Notion — sets `pre-wrap` on *every* paragraph it
   renders, to preserve authored spacing. Since `pre-wrap` still reflows, that
   text is ordinary prose. Rejecting it discarded the entire article body on
   Confluence and looked like the extension was simply broken.
2. **A monospace font stack is the signal for code, not whitespace handling.**
   Syntax highlighters emit styled `<div>`s carrying no `<pre>` or `<code>` tag,
   so tag-based skipping misses them entirely. The `MONOSPACE` regex was tested
   against 16 real font stacks; the near-misses that matter are `Roboto` and
   `"Roboto Slab"` (must pass) versus `"Roboto Mono"` (must not).
3. **The verdict cache must be invalidated on `childList` mutations, not just
   `characterData`.** Framework apps render an empty shell and stream content
   into it. Scoring the empty container caches "too short" against it forever,
   so the content arrives and is never re-scored. Block *ancestors* need
   invalidating too, since `textContent` length propagates upward.
4. **Score the text a block would actually paint, never `block.textContent`.**
   `textContent` swallows `<script>` bodies and, on a container like `<body>`,
   allocates the whole page as a string on every rescan — 717 KB on a real
   Confluence page, recomputed on every mutation.

**Why:** none of these were visible on a synthetic test page. Each was found only
by running against a live application and reading `diagnose.js` output.

**How to apply:** when a site reports as broken, run `diagnose.js` in its console
before theorizing — the "Verdicts by reason" table names the offending gate
directly. Add a regression case to `test-page.html` for anything you fix. Note
that `<header>` is skipped wholesale, which also skips `<article><header><h1>`;
that is a deliberate trade, not an oversight.

Builds on [[highlight-api-architecture]].
