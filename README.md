# Bionic Reader (in-place)

A Chrome extension that adds bionic-reading fixation points to article text
**on the live page**, without building a reader view and without modifying the
page's DOM.

---

## Part 1 — How Chrome extensions work

If you have never built one, here is the whole model in five paragraphs.

**An extension is just a folder of web files.** HTML, CSS, JavaScript, and one
required file called `manifest.json`. There is no build step, no compiler, no
package to install. Chrome loads the folder directly. When you change a file,
you reload the extension and the change is live.

**`manifest.json` is the contract.** It declares the extension's name, what
permissions it wants, and — most importantly — which of your scripts run where.
Chrome reads it first and refuses to load the extension if it is malformed. The
`"manifest_version": 3` at the top means this uses the current extension
platform (MV3); tutorials written before ~2021 describe MV2 and will not work.

**A "content script" runs inside the page.** The `content_scripts` block in the
manifest says: for every URL matching `<all_urls>`, inject `content.js` and
`content.css` once the page has settled. That script shares the page's DOM —
it can read and change everything you see in DevTools — but it lives in an
*isolated world*, meaning it cannot see JavaScript variables the page itself
defined, and the page cannot see yours. This is the sandbox that makes content
scripts reasonably safe.

**A "service worker" runs in the background, outside any page.** That is
`background.js`. It has no DOM and no window. It wakes up when an event it
registered for fires, does its work, and is killed again — so you cannot keep
state in a variable there, only in storage. Here, its single job is the
keyboard shortcut, because content scripts are not allowed to listen for
extension-level hotkeys.

**A "popup" is a tiny web page.** `popup.html` opens when you click the
extension's toolbar icon. It is a real page with its own JavaScript, but note
that Chrome forbids inline `<script>` tags in extension pages, which is why the
code lives in a separate `popup.js`.

Those pieces cannot call each other's functions directly — they are separate
JavaScript contexts. They communicate two ways, both used here:

- **`chrome.storage`** — a shared key/value store. Anything can write to it,
  and everything can subscribe to changes via `chrome.storage.onChanged`. This
  is how a slider in the popup reaches the content script.
- **`chrome.runtime.sendMessage` / `chrome.tabs.sendMessage`** — direct
  request/response. The popup uses this to ask the page "are you active, and
  how many words did you highlight?"

---

## Part 2 — Install and test it

### Load the extension

1. Open Chrome and go to `chrome://extensions`.
2. Turn on **Developer mode** (toggle, top right).
3. Click **Load unpacked** and select this folder
   (`/Users/jazahn/workshop/bionic-reader`).
4. The extension appears as a card. Pin it to the toolbar via the puzzle-piece
   icon so you can reach the popup.

Requires Chrome 105 or newer. There is no icon file, so Chrome shows a generic
placeholder — that is expected and harmless.

### Try it on the test bench

Open [test-page.html](test-page.html) in Chrome (drag it into a tab, or use
`file://` — you must first tick **Allow access to file URLs** on the
extension's card in `chrome://extensions`).

Every block on that page is labeled with what *should* happen. Work down it:

| Check | What you should see |
|---|---|
| Ordinary paragraphs | Leading characters of each word look bolder |
| Inline `<code>` | Untouched — select and copy it, characters are exact |
| `<pre>` block | Completely untouched |
| Text input / textarea | No highlighting; caret and selection behave normally |
| `contenteditable` box | No highlighting; click-to-position-caret is exact |
| Nav bar, footer | Skipped as navigation landmarks |
| Link-only list | Skipped — too link-dense to be prose |
| Long list item | Highlighted — length beats the tag heuristic |
| "Too short." | Skipped — under the paragraph-length floor |
| Greek paragraph | Highlighted correctly across a non-Latin script |
| **Append a paragraph** button | New text gets highlighted within ~250 ms |
| Deferred-render pair | Both highlight ~1.5 s in, after replacing "Loading…" |
| `pre-wrap` paragraph | Highlighted — it reflows, so it is prose |
| Monospace JSON block | Skipped on font, despite having no `pre`/`code` tag |
| Bare `pre` table | Skipped — column alignment carries meaning |

Then confirm the non-destructive claims, which are the whole point of the design:

- **Ctrl-F / Cmd-F** for a word in a highlighted paragraph — find-in-page still
  matches, because no text nodes were split.
- **Select and copy** a highlighted sentence, paste it into a plain text editor
  — you get clean text with no stray markup or spacing.
- **Open DevTools → Elements** and inspect a highlighted paragraph — the DOM is
  byte-identical to the original. Nothing was wrapped.

### Try it on real sites

Good stress tests, in rough order of difficulty: a Wikipedia article, a news
site, a documentation page with lots of code samples, GitHub (heavy UI chrome
plus code), Gmail (an app, not an article), and any React-heavy SPA where you
navigate between pages without a reload.

### Controls

- **Toolbar icon** — popup with the global toggle, a per-site override, and
  three sliders (fixation length, boldness, minimum paragraph length).
- **Alt+B** — toggle the current site on or off. Rebind at
  `chrome://extensions/shortcuts`.

### Making changes

Edit any file, then go back to `chrome://extensions` and click the **reload**
(circular arrow) icon on the extension's card. Then reload the web page you are
testing. Both steps are needed: the first re-reads your code, the second
re-injects it.

### When something breaks

Errors surface in two different places, and this trips up everyone at first:

- **Content script errors** → the DevTools console of the *page* you are on.
- **Service worker errors** → click the **service worker** link on the
  extension's card in `chrome://extensions`, which opens a dedicated DevTools
  window.
- **Popup errors** → right-click the toolbar icon → **Inspect popup**.

A red error banner on the extension card usually means malformed
`manifest.json`.

### When a page just isn't highlighted

Open the DevTools console on that page and paste the contents of
[diagnose.js](diagnose.js). It re-runs the extension's decision gates in
isolation and changes nothing, reporting:

- whether the content script is present at all on this URL,
- how many ranges are currently painted,
- how much text is hiding in shadow roots (permanently out of reach),
- a **Verdicts by reason** table counting which gate rejected how many blocks,
- the 15 largest text blocks with the specific reason each was skipped, plus
  live element references you can click to inspect.

Chrome blocks console paste until you type `allow pasting` once.

The reason table tells you which knob to turn. `too short` means lower
**Min. paragraph length** in the popup. `link-dense` means raise
`maxLinkDensity` in [content.js](content.js). Anything naming a landmark
(`nav`, `header`, `aside`) means that site wraps real content in that element
and you should drop the entry from `SKIP_ANCESTORS`. If blocks are accepted but
nothing is painted, the problem is scheduling rather than scoring.

---

## Part 3 — How this implementation works

### The central trick: no DOM mutation

Most bionic-reading code wraps the first half of every word in `<b>` tags. That
is what forces the reader-view approach, because rewriting text nodes breaks
three things badly:

- **Framework reconcilers.** React, Vue, and Angular hold references to the
  exact text nodes they created. Replace one with a wrapper and the next
  re-render either throws or silently reverts your work.
- **Editing surfaces.** Selection and caret positions are expressed as
  `(node, characterOffset)` pairs. Splitting a text node invalidates them.
- **Copy, paste, and find-in-page.** Split nodes leak markup into the clipboard
  and can defeat text matching.

This extension instead uses the **CSS Custom Highlight API** (Chrome 105+). You
build `Range` objects describing character spans, register them under a name,
and style that name from CSS:

```js
const highlight = new Highlight();
highlight.add(range);
CSS.highlights.set('bionic-fixation', highlight);
```

```css
::highlight(bionic-fixation) { /* styles */ }
```

The page's DOM is never touched. Reverting is one `CSS.highlights.delete()`
call, with nothing to unwrap.

**The one real constraint:** `::highlight()` accepts only a short list of
properties, and `font-weight` is not among them. Weight is therefore faked by
stacking two `text-shadow`s in `currentColor`, which smears each glyph just
enough to read as bolder while automatically staying correct on dark
backgrounds and inside colored links. On very thin fonts this reads weaker than
true bold; the **Boldness** slider compensates.

### Deciding what counts as prose

Instead of extracting an article into a reader view, the extension scores
blocks in place ([content.js](content.js), `isProse`):

1. **Hard skips by tag** — `pre`, `code`, `kbd`, `input`, `textarea`, `button`,
   `svg`, `canvas`, and friends.
2. **Hard skips by ancestor** — anything inside `[contenteditable]`, a known
   code editor (`.cm-editor`, `.monaco-editor`, `.ace_editor`,
   `.CodeMirror`), `[aria-hidden="true"]`, or a navigation landmark (`nav`,
   `header`, `footer`, `aside`, and the matching ARIA roles).
3. **Length floor** — blocks under `minBlockChars` are UI labels, not prose.
4. **Link density** — if more than half a block's characters sit inside anchor
   tags, it is a menu, not a paragraph.
5. **Computed style** — `display: none`, `visibility: hidden`, a monospace font
   stack, or `white-space: pre` exactly.

Gates 3 and 4 measure only the text the block would actually paint — its own
text nodes, skipping nested blocks and `<code>`/`<script>` subtrees. Reading
`textContent` instead would count script bodies and, on a container like
`<body>`, allocate the whole page as a string on every rescan.

Two details in gate 5 are worth calling out, because getting them wrong breaks
whole categories of site:

- **Only bare `pre` is rejected, not `pre-wrap`.** Every WYSIWYG editor
  (Confluence, Notion) sets `white-space: pre-wrap` on every paragraph it
  renders, to preserve authored spacing. Since `pre-wrap` still reflows, that
  text is ordinary prose; rejecting it discards the entire article.
- **A monospace font stack is the signal for code**, not whitespace handling.
  Syntax highlighters emit styled `<div>`s carrying no `<pre>` or `<code>` tag,
  so tag-based skipping misses them entirely.

This is a cheaper cousin of what Readability does, and it is why the extension
does not need to replace the page to get reader-view-like precision.

### Staying fast

A naive implementation walks the whole document on load and stalls long pages.
This one splits the work by cost:

- A **`TreeWalker`** pass collects candidate blocks. It is cheap because it
  deliberately avoids `getComputedStyle`.
- An **`IntersectionObserver`** (with 400 px of margin) defers the expensive
  part — `Range` construction — until a block is near the viewport.
- **`requestIdleCallback`** drains that queue in slices, yielding whenever the
  frame budget runs low.
- A **`MutationObserver`** picks up content added later, debounced by 250 ms.
  There is no feedback loop to guard against, because the extension never
  mutates the DOM itself.

### Known limits

- **Canvas-rendered text** (Google Docs, Figma) is unreachable by any extension
  that is not doing OCR. Not fixable.
- **Shadow DOM is skipped.** `::highlight()` styles must live inside the same
  shadow root to apply, and component internals are unpredictable.
- **Cross-origin iframes are skipped** (`all_frames: false` in the manifest).
  Flip it to `true` if you want embedded articles covered, at the cost of
  running inside ad frames too.
- **`header` is skipped wholesale**, which also skips `<article><header><h1>`.
  Headings are usually bold already, so this is a deliberate trade; edit
  `SKIP_ANCESTORS` if you disagree.
- **Fake bold is weaker than real bold** on thin fonts. A `<span>`-wrapping
  fallback mode for static, non-framework pages would fix this, but it
  reintroduces every hazard listed above and is not implemented.

---

## Files

| File | Role |
|---|---|
| [manifest.json](manifest.json) | Declares permissions, scripts, and the hotkey |
| [content.js](content.js) | All the real logic: scanning, scoring, highlighting |
| [content.css](content.css) | The `::highlight()` rule that fakes bold |
| [background.js](background.js) | Service worker; handles Alt+B only |
| [popup.html](popup.html) / [popup.css](popup.css) / [popup.js](popup.js) | Toolbar UI |
| [test-page.html](test-page.html) | Self-labeling test bench |
