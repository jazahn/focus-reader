/*
 * Focus Reader -- in-place content script.
 *
 * Rather than rewriting the page into a reader view, this paints fixation
 * points directly onto the live page using the CSS Custom Highlight API. No
 * nodes are created, moved, or wrapped, so framework reconcilers, text
 * selection, copy/paste, and find-in-page all keep working.
 *
 * Pipeline:
 *   1. Cheap TreeWalker collects the innermost block element around every
 *      text node worth reading.
 *   2. Each block is scored (link density, length, editability, whitespace
 *      mode) to separate prose from UI chrome.
 *   3. An IntersectionObserver defers the expensive part -- Range building --
 *      until a block is near the viewport, spread across idle callbacks.
 */

(() => {
  'use strict';

  const HIGHLIGHT_NAME = 'focus-fixation';

  const SUPPORTED =
    typeof CSS !== 'undefined' &&
    typeof CSS.highlights !== 'undefined' &&
    typeof Highlight === 'function' &&
    typeof Intl !== 'undefined' &&
    typeof Intl.Segmenter === 'function';

  const DEFAULTS = {
    enabled: true,
    intensity: 0.5,
    strength: 0.03,
    minBlockChars: 40,
    maxLinkDensity: 0.5,
    siteRules: {}
  };

  /* ------------------------------------------------------------------ *
   * What never gets touched
   * ------------------------------------------------------------------ */

  // Subtrees whose text is not prose, or where character offsets carry meaning.
  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED',
    'CANVAS', 'SVG', 'MATH', 'VIDEO', 'AUDIO',
    'CODE', 'PRE', 'KBD', 'SAMP', 'VAR',
    'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'BUTTON'
  ]);

  // Ancestors that disqualify a whole block. Editors are here because a
  // highlight over a caret position confuses selection UI; navigation
  // landmarks are here because their text is labels, not reading material.
  const SKIP_ANCESTORS = [
    '[contenteditable]:not([contenteditable="false"])',
    '[aria-hidden="true"]',
    '.CodeMirror', '.cm-editor', '.monaco-editor', '.ace_editor',
    '[role="textbox"]', '[role="code"]', '[role="log"]',
    'nav', 'header', 'footer', 'aside', 'menu',
    '[role="navigation"]', '[role="banner"]', '[role="contentinfo"]',
    '[role="complementary"]', '[role="menu"]', '[role="menubar"]',
    '[role="tablist"]', '[role="toolbar"]', '[role="listbox"]'
  ].join(',');

  // Elements treated as paragraph containers. The innermost match around a
  // text node becomes the unit of scheduling and scoring.
  const BLOCK_TAGS = new Set([
    'P', 'LI', 'DD', 'DT', 'BLOCKQUOTE', 'FIGCAPTION', 'CAPTION',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'TD', 'TH', 'ARTICLE', 'SECTION', 'MAIN', 'DIV', 'BODY', 'SUMMARY'
  ]);

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */

  let settings = { ...DEFAULTS };
  let active = false;

  const segmenter = SUPPORTED
    ? new Intl.Segmenter(undefined, { granularity: 'word' })
    : null;

  let highlight = null;
  let verdicts = new WeakMap();   // block -> boolean (prose or not)
  let painted = new WeakMap();    // block -> Range[] currently in the highlight
  let queue = [];
  let wordCount = 0;
  let idleScheduled = false;

  let viewportObserver = null;
  let mutationObserver = null;
  let rescanTimer = 0;

  const requestIdle =
    window.requestIdleCallback ||
    ((fn) => setTimeout(() => {
      const started = performance.now();
      fn({ timeRemaining: () => Math.max(0, 8 - (performance.now() - started)) });
    }, 16));

  /* ------------------------------------------------------------------ *
   * Word measurement
   * ------------------------------------------------------------------ */

  const HAS_LETTER = /\p{L}/u;

  // A monospace stack is the durable signal for code and terminal output. It
  // catches the styled <div> that syntax highlighters emit, which carries no
  // <pre> or <code> tag to match on.
  const MONOSPACE = /\bmonospace\b|courier|consolas|menlo|monaco|cascadia|source[\s-]?code|fira[\s-]?(code|mono)|jetbrains[\s-]?mono|roboto[\s-]?mono|plex[\s-]?mono|sf[\s-]?mono/i;

  // How many leading characters of a word to emphasize. Always leaves at least
  // one plain character on words of 2+ so the eye still has a boundary.
  function fixationLength(length, intensity) {
    if (length <= 1) return length;
    const n = Math.floor(length * intensity);
    return Math.min(Math.max(n, 1), length - 1);
  }

  function addRanges(textNode, ranges) {
    const text = textNode.data;

    for (const segment of segmenter.segment(text)) {
      if (!segment.isWordLike) continue;

      const word = segment.segment;
      if (!HAS_LETTER.test(word)) continue;

      let length = fixationLength(word.length, settings.intensity);

      // Range offsets are UTF-16 code units; never cut a surrogate pair in half.
      const lastUnit = word.charCodeAt(length - 1);
      if (lastUnit >= 0xd800 && lastUnit <= 0xdbff && length < word.length) {
        length += 1;
      }

      const range = new Range();
      range.setStart(textNode, segment.index);
      range.setEnd(textNode, segment.index + length);
      ranges.push(range);
    }
  }

  /* ------------------------------------------------------------------ *
   * Finding prose
   * ------------------------------------------------------------------ */

  function invalidateBlockAncestors(element) {
    for (let el = element; el && el !== document.documentElement; el = el.parentElement) {
      if (BLOCK_TAGS.has(el.tagName.toUpperCase())) verdicts.delete(el);
    }
  }

  function nearestBlock(element) {
    for (let el = element; el && el !== document.documentElement; el = el.parentElement) {
      if (BLOCK_TAGS.has(el.tagName.toUpperCase())) return el;
    }
    return null;
  }

  // Cheap first pass: which blocks contain text at all. Deliberately avoids
  // getComputedStyle, which is the expensive call, deferring it to scoring.
  function collectBlocks(root) {
    const blocks = new Set();
    if (!root || root.nodeType !== Node.ELEMENT_NODE) return blocks;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!node.data || node.data.trim().length < 2) return NodeFilter.FILTER_REJECT;
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        if (SKIP_TAGS.has(parent.tagName.toUpperCase())) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });

    let node;
    while ((node = walker.nextNode())) {
      const block = nearestBlock(node.parentElement);
      if (block) blocks.add(block);
    }
    return blocks;
  }

  // Measures precisely the text this block would paint, and how much of it sits
  // inside links. Reading block.textContent instead would count nested blocks
  // scored separately, <script> bodies, and -- on a container like <body> --
  // allocate the whole page as a string on every rescan.
  function measure(block) {
    let chars = 0;
    let linkChars = 0;

    for (const node of ownTextNodes(block)) {
      const length = node.data.trim().length;
      chars += length;
      if (node.parentElement && node.parentElement.closest('a')) linkChars += length;
    }

    return { chars, linkChars };
  }

  // The heuristic that stands in for a reader view: prose is long and has few
  // links relative to its length. Structure only -- no getComputedStyle, so
  // this stays cheap enough to run over every candidate block at load.
  function isProse(block) {
    if (verdicts.has(block)) return verdicts.get(block);

    let ok = true;

    if (block.closest(SKIP_ANCESTORS)) {
      ok = false;
    } else {
      const { chars, linkChars } = measure(block);
      if (chars < settings.minBlockChars) ok = false;
      else if (linkChars / chars > settings.maxLinkDensity) ok = false;
    }

    verdicts.set(block, ok);
    return ok;
  }

  // Resolving style is the expensive check, so it waits until a block is
  // actually about to be painted -- by which point it is near the viewport.
  function isRenderedProse(block) {
    const style = getComputedStyle(block);

    if (style.display === 'none' || style.visibility === 'hidden') return false;

    // Only bare `pre` resists wrapping, which is what makes column alignment
    // meaningful. `pre-wrap` and `pre-line` reflow like ordinary prose, and
    // WYSIWYG editors set `pre-wrap` on every paragraph they render in order to
    // preserve authored spacing -- so treating it as preformatted discards the
    // entire article on Confluence, Notion, and anything else built that way.
    if (style.whiteSpace === 'pre') return false;

    if (MONOSPACE.test(style.fontFamily)) return false;

    return true;
  }

  // Text belonging directly to this block -- nested blocks are rejected so
  // they can be scored and scheduled on their own.
  function ownTextNodes(block) {
    const nodes = [];
    const walker = document.createTreeWalker(
      block,
      NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.tagName.toUpperCase();
            if (SKIP_TAGS.has(tag) || BLOCK_TAGS.has(tag)) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_SKIP;
          }
          return node.data && node.data.trim().length >= 2
            ? NodeFilter.FILTER_ACCEPT
            : NodeFilter.FILTER_REJECT;
        }
      }
    );

    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    return nodes;
  }

  /* ------------------------------------------------------------------ *
   * Painting
   * ------------------------------------------------------------------ */

  function unpaint(block) {
    const existing = painted.get(block);
    if (!existing) return;
    for (const range of existing) {
      highlight.delete(range);
      wordCount -= 1;
    }
    painted.delete(block);
  }

  function paint(block) {
    if (!block.isConnected) return;
    unpaint(block);
    if (!isProse(block) || !isRenderedProse(block)) return;

    const ranges = [];
    for (const textNode of ownTextNodes(block)) {
      addRanges(textNode, ranges);
    }
    if (!ranges.length) return;

    for (const range of ranges) highlight.add(range);
    painted.set(block, ranges);
    wordCount += ranges.length;
  }

  function drainQueue() {
    if (idleScheduled || !queue.length) return;
    idleScheduled = true;

    requestIdle((deadline) => {
      idleScheduled = false;
      while (queue.length && deadline.timeRemaining() > 2) {
        paint(queue.pop());
      }
      if (queue.length) drainQueue();
    }, { timeout: 500 });
  }

  function observeBlocks(blocks) {
    for (const block of blocks) {
      // Reject obvious non-prose now so we do not pay for an observer entry.
      if (!isProse(block)) continue;
      viewportObserver.observe(block);
    }
  }

  /* ------------------------------------------------------------------ *
   * Lifecycle
   * ------------------------------------------------------------------ */

  // The master switch wins outright. A per-site rule can only narrow it, never
  // re-enable a globally disabled extension -- otherwise "off" would mean "off
  // unless you once said otherwise for this site", which is not what an on/off
  // switch should do.
  function effectiveState() {
    if (!settings.enabled) return false;
    return settings.siteRules[location.hostname] !== 'off';
  }

  // Tell the service worker whether this tab is being painted, so it can dim the
  // toolbar icon. Fire-and-forget: the worker may be asleep, and a dropped
  // report is corrected by the next one.
  function reportState(isActive) {
    try {
      const sent = chrome.runtime.sendMessage({
        type: 'focus:state',
        active: isActive
      });
      if (sent && typeof sent.catch === 'function') sent.catch(() => {});
    } catch {
      /* extension context torn down mid-navigation */
    }
  }

  function applyStrength() {
    document.documentElement.style.setProperty(
      '--focus-strength',
      `${settings.strength}em`
    );
  }

  function start() {
    if (active || !SUPPORTED) return;
    active = true;

    highlight = new Highlight();
    CSS.highlights.set(HIGHLIGHT_NAME, highlight);
    applyStrength();

    viewportObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          viewportObserver.unobserve(entry.target);
          queue.push(entry.target);
        }
        drainQueue();
      },
      { rootMargin: '400px 0px' }
    );

    observeBlocks(collectBlocks(document.body));

    mutationObserver = new MutationObserver((records) => {
      const roots = new Set();
      for (const record of records) {
        if (record.type === 'characterData') {
          const block = record.target.parentElement && nearestBlock(record.target.parentElement);
          if (block) {
            verdicts.delete(block);
            roots.add(block);
          }
          continue;
        }
        // A container that was scored before its content arrived -- the normal
        // case in a framework app that renders a shell and then fills it -- has
        // a stale "not prose" verdict cached against it. Every block ancestor
        // is invalidated because textContent length propagates upward.
        if (record.target.nodeType === Node.ELEMENT_NODE) {
          invalidateBlockAncestors(record.target);
          const block = nearestBlock(record.target);
          if (block) roots.add(block);
        }

        for (const node of record.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) roots.add(node);
          else if (node.nodeType === Node.TEXT_NODE && node.parentElement) {
            roots.add(node.parentElement);
          }
        }
        for (const node of record.removedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          // Drop ranges for the removed element and anything block-like inside
          // it. Live Ranges over detached nodes paint nothing, but on a
          // long-lived single-page app they would accumulate forever.
          if (BLOCK_TAGS.has(node.tagName.toUpperCase())) unpaint(node);
          for (const inner of node.querySelectorAll('*')) {
            if (BLOCK_TAGS.has(inner.tagName.toUpperCase())) unpaint(inner);
          }
        }
      }
      if (!roots.size) return;

      clearTimeout(rescanTimer);
      rescanTimer = setTimeout(() => {
        for (const root of roots) {
          if (!root.isConnected) continue;
          const blocks = collectBlocks(root);
          const own = nearestBlock(root);
          if (own) blocks.add(own);
          // Re-score from scratch: whatever verdict these blocks carry was
          // reached against their previous contents.
          for (const block of blocks) verdicts.delete(block);
          observeBlocks(blocks);
        }
      }, 250);
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function stop() {
    if (!active) return;
    active = false;

    clearTimeout(rescanTimer);
    if (mutationObserver) mutationObserver.disconnect();
    if (viewportObserver) viewportObserver.disconnect();
    mutationObserver = null;
    viewportObserver = null;

    // The entire visual effect lives in one registry entry, so a full revert
    // is a single call -- nothing to unwrap or restore.
    if (highlight) highlight.clear();
    CSS.highlights.delete(HIGHLIGHT_NAME);
    highlight = null;

    document.documentElement.style.removeProperty('--focus-strength');

    verdicts = new WeakMap();
    painted = new WeakMap();
    queue = [];
    wordCount = 0;
  }

  // Keys whose values are baked into the Ranges themselves. Anything else is
  // cosmetic and can be changed without rebuilding.
  const STRUCTURAL_KEYS = ['intensity', 'minBlockChars', 'maxLinkDensity'];

  let rebuildTimer = 0;

  function sync({ rebuild = true } = {}) {
    clearTimeout(rebuildTimer);

    const wanted = effectiveState() && SUPPORTED;
    reportState(wanted);

    if (!wanted) {
      stop();
      return;
    }
    if (!active) {
      start();
      return;
    }

    applyStrength();
    if (!rebuild) return;

    // Slider drags fire continuously; coalesce them into one repaint.
    rebuildTimer = setTimeout(() => {
      stop();
      start();
    }, 200);
  }

  /* ------------------------------------------------------------------ *
   * Wiring
   * ------------------------------------------------------------------ */

  chrome.storage.sync.get(DEFAULTS, (stored) => {
    settings = { ...DEFAULTS, ...stored };
    sync();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const [key, { newValue }] of Object.entries(changes)) {
      settings[key] = newValue;
    }
    const rebuild = STRUCTURAL_KEYS.some((key) => key in changes);
    sync({ rebuild });
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message && message.type === 'focus:getState') {
      sendResponse({
        supported: SUPPORTED,
        active,
        wordCount,
        host: location.hostname
      });
    }
    return false;
  });
})();
