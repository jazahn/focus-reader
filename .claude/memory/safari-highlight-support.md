---
name: safari-highlight-support
description: What Safari applies inside ::highlight() — text-shadow is ignored (reported through 26.2), -webkit-text-stroke is disallowed since Safari 27.0, so the only bold-fake left is a background-color tint; verify with tools/highlight-probe.html, nothing is feature-detectable
metadata:
  type: project
---

The whole Chrome visual effect is `text-shadow` inside `::highlight()`. Safari
does not have that option, which is why `content.css` carries a second,
Safari-only declaration (`background-color: var(--focus-tint, transparent)`).

What is known, and from where (as of 2026-10-31):

| Property in `::highlight()` | Chrome | Safari | Source |
|---|---|---|---|
| `text-shadow` | yes (the shipped effect) | **ignored** through Safari 26.2 | MDN browser-compat-data issue #28852 (reporter's test, Jan 2026); no release note since says otherwise |
| `-webkit-text-stroke-*` | no | **disallowed** from Safari 27.0 ("Fixed highlight pseudo-elements such as ::selection and ::highlight to disallow vendor-prefixed properties", radar 174590593) | WebKit Features for Safari 27.0, 2026-09-17 |
| `background-color`, `color`, `text-decoration` | yes | yes (core spec set) | spec / MDN |
| `font-weight` | no | no | spec: not an allowed highlight property |

The Safari Technology Preview 251 note "Fixed `-webkit-text-stroke` not
applying to highlighted text" (Aug 2026) is about an element's own stroke
surviving selection painting, not about stroke declared *inside* the highlight;
do not read it as a way back to stroke.

**Nothing here is detectable at runtime.** `getComputedStyle` cannot see
highlight pseudo styles and `CSS.supports` answers for the property, not for
its use in a highlight. Hence `content.js` switches on `navigator.vendor`, and
the only test is visual: `tools/highlight-probe.html` paints one highlight per
candidate property, light and dark, next to a real `<b>` reference.

**Probe results recorded so far:** none yet on a device. Run it on the iPhone
(iOS 26.x) and on Mac Safari 26.6.1 and fill this in: which rows render, and
whether the `var()` row renders (custom properties resolving inside the
highlight is what lets the Boldness slider work on Safari). If `text-shadow`
ever renders on Safari, drop the tint there rather than showing both.

Related: [[highlight-api-architecture]] (why highlights at all),
[[ios-safari-port]] (the port this unblocks).
