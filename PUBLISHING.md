# Publishing to the Chrome Web Store

Store policies and dashboard fields change; treat the specifics here as a map
rather than a transcript, and read what the dashboard actually asks you.

---

## 0. Deal with the name first

**"Bionic Reading" is a registered trademark**, held by Bionic Reading AG (the
Swiss company behind the original technique). The rights holder has a history of
contacting people who ship implementations under that name, including free and
open-source ones, and asking them to stop. Chrome Web Store policy separately
prohibits listings that infringe someone else's trademark.

This matters more than it sounds. A takedown does not arrive when you upload; it
arrives once you have users, reviews, and an install base to lose.

Verify the current trademark status yourself before you commit, but the low-risk
shape is:

- **Do not use the phrase in the extension name.** Name it for what it does:
  `Fixation Reader`, `Lead-In`, `Prefix Reader`, `Fast Fixation`.
- **Describe the technique functionally in the listing** — "emphasizes the first
  few letters of each word to give your eye fixation points" — rather than
  claiming to be, or to implement, the branded product.
- **Do not imply affiliation** or use the rights holder's branding or wordmark.

**This is already done.** The extension ships as **Focus Reader**, and the rename
went all the way through: the highlight registry name, the CSS custom property,
and the internal message type were renamed too, so the packaged bundle contains
zero instances of the trademarked phrase. That matters because reviewers read the
source, and a listing that avoids the term while the code is full of it reads
worse than either alternative.

The listing copy describes the technique functionally rather than by brand name.
Keep it that way.

## 1. One-time account setup

1. Decide which Google account owns this. **The publisher name is public**, and
   the account cannot be transferred easily later, so if you would rather not
   attach your personal address to it, make a dedicated one now.
2. Enable **2-Step Verification** on that account. The store requires it of
   publishers, and finding out mid-submission is annoying.
3. Go to the **Chrome Web Store Developer Dashboard**
   (<https://chrome.google.com/webstore/devconsole>) and register.
4. Pay the **one-time $5 USD registration fee**. It covers the account, not
   per-extension, and is non-refundable.
5. Set your publisher display name and verify your contact email. An unverified
   email blocks publishing.

## 2. Assets to prepare

The icons are generated — run `python3 tools/make-icons.py` if you change the
design in [tools/make-icons.py](tools/make-icons.py). What you still need:

| Asset | Spec | Notes |
|---|---|---|
| Store icon | 128×128 PNG | Already built at `icons/icon128.png` |
| Screenshots | 1280×800 or 640×400, PNG or JPEG | **At least one required**, up to five |
| Small promo tile | 440×280 PNG | Optional, but needed for any store featuring |
| Short description | ≤ 132 characters | Reused from `manifest.json` `description` |
| Detailed description | Plain text | What it does, how to use it, what it cannot do |

For screenshots, the honest and effective approach is a real before/after: the
same article with the extension off and on. Size the browser window so the
capture lands at 1280×800, or capture larger and downscale — the store rejects
off-spec dimensions rather than resizing for you.

Do not put a screenshot of the [test-page.html](test-page.html) bench in the
listing. It reads as a developer artifact.

## 3. Build the upload

```sh
./tools/package.sh
```

This validates the manifest, syntax-checks the JavaScript, and writes
`dist/focus-reader-<version>.zip` containing only the eleven files that should
ship — deliberately not `README.md`, `test-page.html`, `diagnose.js`, or
`tools/`. Reviewers do read the bundle, and unexplained dev files invite
questions.

**Every upload needs a higher `version` in `manifest.json` than the last one you
published.** Re-uploading the same version is rejected.

Worth tagging each published version in git (`git tag v0.1.0`) so you can always
reproduce exactly what a given store listing contains — the store keeps your
uploaded ZIP but gives you no diff against your working tree. `dist/` is
gitignored; the ZIP is a build artifact, rebuildable from any tagged commit.

## 4. Filling in the listing

Most of the form is self-explanatory. Four parts are where submissions get
stuck.

### Single purpose

Chrome requires one narrow, stated purpose. Yours is genuinely narrow, so say it
plainly:

> Improves reading speed by emphasizing the leading characters of words in
> article text on web pages.

### Permission justifications

You must justify each permission in a text box. Vague answers get bounced. Yours:

- **`storage`** — "Stores the user's own settings (on/off state, per-site
  overrides, and three appearance sliders). No browsing data is stored."
- **`host_permissions: <all_urls>`** — "r"

Be ready for extra scrutiny on that second one. `<all_urls>` is the single
biggest driver of review time. It is genuinely required here — a reading aid the
user must authorize per site is a different, worse product — but expect
questions, and see §6 if you would rather trade UX for a faster review.

### Data usage disclosure

You will be asked to declare what you collect and to certify three things. For
this extension the truthful answers are that it collects **no** user data, does
not sell or transfer data, and does not use data for unrelated purposes or
creditworthiness. Answer honestly; a false certification is the fastest route
to a permanent ban.

A privacy policy URL is required only if you handle user data. Since this
collects none, you can generally leave it blank — but if the dashboard demands
one, a single page saying "this extension collects, stores, and transmits no
user data; settings are stored locally in your browser" is sufficient and true.

### Visibility

**Publish as `Unlisted` first.** It goes through the same review, gets you a
real store URL you can install from and share, but does not appear in search or
category browsing. You get to verify the packaged build behaves like your
unpacked one — which is where surprises live — before anyone can find it. Switch
to `Public` when you are satisfied.

## 5. Review

Submit, then wait. Simple extensions can clear in hours; anything requesting
broad host permissions commonly takes several days, occasionally a couple of
weeks. You get an email either way.

If it is rejected, the notice names a specific policy. The likely ones here:

- **Broad permissions insufficiently justified** — tighten the text in §4.
- **Undisclosed functionality** — make sure the description mentions everything
  the code does, including that it stores settings.
- **Trademark** — see §0.
- **Low-quality listing** — a single blurry screenshot and a one-line
  description will get you here.

## 6. Optional: trading UX for a faster review

If review friction becomes the blocker, you can drop `<all_urls>` and switch to
on-demand injection: replace the declarative `content_scripts` block with
`optional_host_permissions`, add the `scripting` permission, and inject via
`chrome.scripting.executeScript` when the user clicks the toolbar icon or grants
a site.

The cost is real: the extension stops working automatically, and the user has to
authorize every site. For a reading aid whose whole value is that you forget it
is there, that is a significant downgrade. Reach for it only if you must.

## 7. After it is live

- Bump `version`, re-run `./tools/package.sh`, upload. Updates go through review
  again, usually faster than the first submission.
- Updates roll out to existing users automatically over a few hours.
- Watch the dashboard for user-reported breakage on specific sites. That is what
  [diagnose.js](diagnose.js) is for — walk reporters through pasting it and have
  them send you the "Verdicts by reason" table, which usually identifies the
  offending gate immediately.
