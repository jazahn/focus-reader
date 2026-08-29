# Focus Reader

Chrome extension (Manifest V3) that emphasizes the leading letters of words in
article text, in place, without mutating the page DOM.

@.claude/memory/INDEX.md

## Commands

| Task | Command |
|---|---|
| Regenerate icons (active + faded sets) | `python3 tools/make-icons.py` |
| Build the store upload ZIP | `./tools/package.sh` |
| Syntax-check a script | `node --check content.js` |

No build step, no bundler, no dependencies — stdlib Python and plain browser
JavaScript only. `tools/package.sh` validates the manifest, syntax-checks the
JS, and zips only the 15 shipping files into `dist/focus-reader-<version>.zip`.

## Running and testing

Load unpacked at `chrome://extensions` with Developer mode on. After editing,
click the reload icon on the extension card **and** reload the page under test.
The first re-reads the code; the second re-injects it. Both are required.

- `test-page.html` is a self-labeling test bench — every block states whether it
  should or should not be emphasized, including the regression cases for
  `pre-wrap` prose, monospace code blocks, and deferred framework renders.
  Needs "Allow access to file URLs" on the extension card.
- `diagnose.js` is pasted into the DevTools console of any page that misbehaves.
  It re-runs the scoring gates read-only and prints a **Verdicts by reason**
  table naming which gate rejected what. Reach for this first on any
  site-compatibility report; it turns guessing into an answer.

Errors surface in three separate consoles, which is the usual stumbling block:
content script errors in the page's own console, service worker errors via the
"service worker" link on the extension card, popup errors via right-click →
Inspect popup.

## Architecture

- `content.js` — all scoring and painting. Builds `Range` objects and registers
  them under the `focus-fixation` highlight name. Never touches the DOM.
- `content.css` — the sole `::highlight(focus-fixation)` rule.
- `background.js` — service worker. Only per-tab icon state and the Alt+B
  command, because content scripts cannot do either.
- `popup.*` — toolbar UI.

Four identifiers must agree across file boundaries, and every one of them fails
**silently** rather than throwing:

| Identifier | Must match between | Symptom if it drifts |
|---|---|---|
| `focus-fixation` | `content.js` ↔ `content.css` | nothing renders at all |
| `--focus-strength` | `content.js` ↔ `content.css` | boldness slider does nothing |
| `focus:getState` | `popup.js` ↔ `content.js` | popup claims page is unreachable |
| `focus:state` | `content.js` ↔ `background.js` | toolbar icon never un-fades |

Grep all four after any rename.

## Conventions

- Keep it dependency-free and build-step-free. That is a large part of why a
  store reviewer can audit it.
- Icons are generated, never hand-edited — change `tools/make-icons.py`.
- Dev-only files (`test-page.html`, `diagnose.js`, `tools/`, docs) are kept out
  of the package by an explicit **allowlist** in `tools/package.sh`, not by
  ignore patterns, so a newly added dev file cannot ship by accident.
