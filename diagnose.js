/*
 * Paste this whole file into the DevTools console on a page where the
 * extension is not doing what you expect.
 *
 * It re-runs the extension's decision gates in isolation and reports which one
 * rejected each of the page's largest text blocks. It changes nothing.
 *
 * Chrome blocks console paste by default the first time: if prompted, type
 * "allow pasting" and press Enter, then paste this.
 */

(() => {
  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'IFRAME', 'OBJECT', 'EMBED',
    'CANVAS', 'SVG', 'MATH', 'VIDEO', 'AUDIO',
    'CODE', 'PRE', 'KBD', 'SAMP', 'VAR',
    'INPUT', 'TEXTAREA', 'SELECT', 'OPTION', 'BUTTON'
  ]);

  const SKIP_ANCESTORS = {
    'contenteditable': '[contenteditable]:not([contenteditable="false"])',
    'aria-hidden': '[aria-hidden="true"]',
    'code editor': '.CodeMirror, .cm-editor, .monaco-editor, .ace_editor, [role="textbox"], [role="code"], [role="log"]',
    'landmark: nav': 'nav, [role="navigation"]',
    'landmark: header': 'header, [role="banner"]',
    'landmark: footer': 'footer, [role="contentinfo"]',
    'landmark: aside': 'aside, [role="complementary"]',
    'landmark: menu/toolbar': 'menu, [role="menu"], [role="menubar"], [role="tablist"], [role="toolbar"], [role="listbox"]'
  };

  const BLOCK_TAGS = new Set([
    'P', 'LI', 'DD', 'DT', 'BLOCKQUOTE', 'FIGCAPTION', 'CAPTION',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'TD', 'TH', 'ARTICLE', 'SECTION', 'MAIN', 'DIV', 'BODY', 'SUMMARY'
  ]);

  const MIN_BLOCK_CHARS = 40;
  const MAX_LINK_DENSITY = 0.5;

  /* ---------------- environment ---------------- */

  const supported =
    typeof CSS !== 'undefined' && typeof CSS.highlights !== 'undefined' &&
    typeof Highlight === 'function' && typeof Intl.Segmenter === 'function';

  const registered = supported ? CSS.highlights.get('focus-fixation') : null;

  console.group('%cFocus Reader diagnostics', 'font-weight:bold;font-size:13px');
  console.log('URL                :', location.href);
  console.log('APIs supported     :', supported);
  console.log('Extension running  :', registered ? 'yes' : 'NO — content script absent or disabled here');
  console.log('Ranges painted     :', registered ? registered.size : 0);

  /* ---------------- shadow DOM ---------------- */

  let shadowHosts = 0;
  let shadowText = 0;
  for (const el of document.querySelectorAll('*')) {
    if (!el.shadowRoot) continue;
    shadowHosts += 1;
    shadowText += (el.shadowRoot.textContent || '').trim().length;
  }
  console.log('Open shadow roots  :', shadowHosts, `(holding ~${shadowText.toLocaleString()} chars — never highlighted)`);

  /* ---------------- gather blocks ---------------- */

  function nearestBlock(element) {
    for (let el = element; el && el !== document.documentElement; el = el.parentElement) {
      if (BLOCK_TAGS.has(el.tagName.toUpperCase())) return el;
    }
    return null;
  }

  const blocks = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
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

  /* ---------------- score them ---------------- */

  const MONOSPACE = /\bmonospace\b|courier|consolas|menlo|monaco|cascadia|source[\s-]?code|fira[\s-]?(code|mono)|jetbrains[\s-]?mono|roboto[\s-]?mono|plex[\s-]?mono|sf[\s-]?mono/i;

  // The text this block would actually paint: its own text nodes, excluding
  // nested blocks and skipped subtrees such as <code> and <script>.
  function measure(block) {
    let chars = 0;
    let linkChars = 0;

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
    while ((node = walker.nextNode())) {
      const length = node.data.trim().length;
      chars += length;
      if (node.parentElement && node.parentElement.closest('a')) linkChars += length;
    }

    return { chars, linkChars };
  }

  function reject(block) {
    for (const [label, selector] of Object.entries(SKIP_ANCESTORS)) {
      if (block.closest(selector)) return label;
    }

    const { chars, linkChars } = measure(block);
    if (chars < MIN_BLOCK_CHARS) return `too short (${chars} < ${MIN_BLOCK_CHARS})`;

    const density = linkChars / chars;
    if (density > MAX_LINK_DENSITY) return `link-dense (${Math.round(density * 100)}%)`;

    const style = getComputedStyle(block);
    if (style.display === 'none') return 'display: none';
    if (style.visibility === 'hidden') return 'visibility: hidden';
    if (style.whiteSpace === 'pre') return 'white-space: pre';
    if (MONOSPACE.test(style.fontFamily)) return `monospace font (${style.fontFamily.slice(0, 30)})`;

    return null;
  }

  const reasons = new Map();
  const rows = [];

  for (const block of blocks) {
    const why = reject(block);
    const key = why || '(accepted)';
    reasons.set(key, (reasons.get(key) || 0) + 1);
    rows.push({ block, why, chars: measure(block).chars });
  }

  console.log('Text blocks found  :', blocks.size);

  console.groupCollapsed('Verdicts by reason');
  console.table(
    [...reasons.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([reason, count]) => ({ reason, blocks: count }))
  );
  console.groupEnd();

  const biggest = rows.sort((a, b) => b.chars - a.chars).slice(0, 15);

  console.groupCollapsed('15 largest text blocks (expand rows to inspect the element)');
  console.table(
    biggest.map((row) => ({
      chars: row.chars,
      verdict: row.why ? `SKIPPED — ${row.why}` : 'accepted',
      tag: row.block.tagName.toLowerCase(),
      preview: (row.block.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60)
    }))
  );
  console.log('Elements, in the same order:', biggest.map((row) => row.block));
  console.groupEnd();

  const accepted = rows.filter((row) => !row.why).length;
  if (!accepted) {
    console.warn(
      'No block on this page passed the filters. The "Verdicts by reason" table ' +
      'above names the gate to loosen in content.js.'
    );
  } else if (registered && registered.size === 0) {
    console.warn(
      `${accepted} blocks should qualify but nothing is painted. This points at ` +
      'scheduling rather than scoring — likely a stale verdict cache or content ' +
      'that arrived after the last scan.'
    );
  }

  console.groupEnd();
})();
