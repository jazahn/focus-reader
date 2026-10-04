---
name: highlight-api-architecture
description: Why Focus Reader paints via the CSS Custom Highlight API instead of wrapping words in tags, and what that choice costs
metadata:
  type: project
---

Focus Reader emphasizes word prefixes by building `Range` objects and registering
them with `CSS.highlights` (Chrome 105+), styled by a single
`::highlight(focus-fixation)` rule. It never creates, moves, or wraps a node.

**Why:** the obvious implementation — wrapping the first half of each word in
`<b>` — is what forces every other tool of this kind into a separate "reader
view". Splitting text nodes breaks three things at once: framework reconcilers
hold references to the exact nodes they created and will throw or silently revert
on the next render; selection and caret positions are `(node, offset)` pairs that
the split invalidates; and copy/paste plus find-in-page stop returning clean
text. The Highlight API sidesteps all three, and reverting is a single
`CSS.highlights.delete()` with nothing to unwrap.

**How to apply:** never "optimize" this into DOM wrapping. If richer styling is
needed, work within the constraint instead — `::highlight()` accepts only a short
property list and **`font-weight` is not among them**, which is why boldness is
faked with two stacked `text-shadow`s in `currentColor` (that also keeps it
correct on dark backgrounds and inside colored links). The tradeoff is that fake
bold reads weaker than real bold on thin fonts; the Boldness slider exists to
compensate.

Permanently out of reach, by design and not worth chasing: canvas-rendered text
(Google Docs, Figma), shadow DOM (a `::highlight()` rule must live inside the
same shadow root), and cross-origin iframes (`all_frames: false`).

See [[site-compat-heuristics]] for how prose is told apart from UI chrome.
