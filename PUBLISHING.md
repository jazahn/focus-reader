# Publishing Focus Reader

Part 1 covers the Chrome Web Store; Part 2 covers the App Store for iOS Safari.
Store policies and dashboard fields change; treat the specifics here as a map
rather than a transcript, and read what the dashboard actually asks you.

---

# Part 1 — Publishing to the Chrome Web Store

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
| App Store icon (iOS build) | 1024×1024 opaque PNG, no alpha | Already built at `icons/icon1024.png`; see Part 2 below |
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
`dist/focus-reader-<version>.zip` containing only the files on the allowlist in
`tools/package.sh` (sixteen, as of 0.2.2) — deliberately not `README.md`,
`test-page.html`, `diagnose.js`, or `tools/`. Reviewers do read the bundle, and
unexplained dev files invite questions. The same ZIP is the iOS upload (Part 2).

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

---

# Part 2 — Publishing to the App Store (iOS Safari)

Safari extensions ship inside a native container app. Since WWDC26 you no
longer build that app yourself: App Store Connect has a **Safari Web Extension
Packager** that takes the extension ZIP, builds the container app on Apple's
side, and hands it to TestFlight. There is no Xcode project in this repo, on
purpose — the only thing Apple still needs Xcode for is native messaging, which
Focus Reader does not use. (The older `xcrun safari-web-extension-converter`
route still works for a local macOS test build; see §5.)

## 1. Prerequisites

- An **Apple Developer Program** membership ($99/yr). Required for the
  packager, TestFlight, and the App Store. Packaging time is deducted from the
  25 Xcode Cloud hours included in the membership; a build takes minutes.
- `manifest.json` `version` higher than the last upload **to either store**;
  the two stores share one manifest.
- An iPhone running iOS 17.2 or newer for TestFlight. Below 17.2 Safari has no
  Custom Highlight API and the popup shows the "not supported" message.

## 2. What Safari users get, and why it differs from Chrome

Decide the listing copy with these in mind; none of them are bugs.

- **Emphasis is a faint tint, not thicker letters.** Safari ignores
  `text-shadow` inside `::highlight()` and, since Safari 27.0, disallows the
  vendor-prefixed stroke properties there, so there is no way to thicken glyphs.
  `content.js` detects Safari and sets `--focus-tint`, which `content.css`
  paints as a `background-color` behind the fixation letters. The Boldness
  slider scales the tint's opacity. Verify on a device with
  `tools/highlight-probe.html` before each release; if a future Safari starts
  honoring `text-shadow`, the tint should be dropped there.
- **Permission is granted per site, on first use.** `<all_urls>` in the manifest
  does not grant anything on iOS. The first time the user opens the extension
  on a site, Safari asks for one day or always; "all websites" lives under
  Settings → Apps → Safari → Extensions → Focus Reader. Until granted, no content
  script runs, and the popup says so (the `hasSiteAccess()` branch in
  `popup.js`).
- **Settings do not sync.** `storage.sync` on Safari behaves as per-device
  storage. Do not promise cross-device settings in the description.
- **No keyboard shortcut.** The `commands` key is ignored on iOS; the packager
  lists it as an exception, which is expected. `background.js` guards the
  listener so its absence cannot crash the worker.
- **The toolbar icon is a template image** (alpha only, tinted by the system),
  so the active/muted difference is an opacity difference, not a colour one.
- The popup opens as a full-width sheet on iPhone; `popup.css` switches to
  `width: auto` under `(pointer: coarse)` and `popup.html` carries a viewport
  meta tag for that reason.

## 3. App Store Connect

1. **App record.** My Apps → New App → platform iOS, name "Focus Reader" (check
   availability the moment you create it; the name already changed once for
   trademark reasons, see Part 1 §0, so have a fallback such as "Focus Reader:
   Fixation Points" ready). Choose a **bundle ID** you control; it cannot be
   changed after the first upload. Primary language, SKU, user access as you
   like. In the record, untick **iPad** if you want to skip the iPad screenshot
   set; the extension works on iPad either way.
2. **Build the ZIP**: `./tools/package.sh`.
3. **Upload.** Users and Access → **Xcode Cloud** tab → **Safari Web Extension
   Packager** → Upload → pick `dist/focus-reader-<version>.zip` and the app
   record. Review the reported *exceptions*; `commands` is expected, anything
   else is new information — fix or document it.
4. **TestFlight.** The build appears under the app's TestFlight tab within
   minutes. Install on your iPhone, then Settings → Apps → Safari → Extensions
   → Focus Reader → on, and allow all websites. Walk the checks in §4.
5. **Listing.** Description: reuse the Chrome text with the browser name
   removed and a sentence about the tint. Screenshots: iPhone only (6.9" and
   6.5" sizes as the form demands) — a real article, before and after, exactly
   as for Chrome. Privacy policy URL: required by Apple for every app; use the
   GitHub page for [PRIVACY.md](PRIVACY.md). App Privacy: **Data Not
   Collected** (true: the only storage is the user's own settings). Export
   compliance: **No**, the app uses no encryption beyond HTTPS. Age rating: 4+.
6. **Submit for review.** Apple reviews the container app and the extension
   together. Expect a question about `<all_urls>` phrased as "why does this
   extension need access to every website"; the Chrome justification in Part 1
   §4 answers it.

Record the App Store id, the first build number, and whether the packager took
the version from `manifest.json` in `.claude/memory/store-release-state.md`
after the first upload — the build-number rules for re-uploads are not
documented and have to be observed.

## 4. Device checklist (TestFlight)

- Open a long article. Fixation letters carry a faint tint on both a light and
  a dark page.
- Move **Boldness**: the tint gets stronger or weaker.
- Move **Fixation length**: the tinted prefix gets longer or shorter.
- Turn the site off: tint disappears; master off: same, everywhere.
- Drag a slider, swipe the sheet away, reopen: the value stuck.
- Open a site you have not allowed yet: the popup says permission is needed,
  not "cannot be modified".
- Open `test-page.html` served from your Mac (`python3 -m http.server`) and walk
  the SHOULD / should NOT labels as for Chrome.

## 5. Local macOS test build (optional)

The Mac can still host a throwaway build for exercising the popup and
permission flows in Safari on macOS, with no account and nothing committed:

```sh
unzip -q dist/focus-reader-<version>.zip -d /tmp/fr-ext
xcrun safari-web-extension-converter /tmp/fr-ext --macos-only --copy-resources \
  --no-open --no-prompt --swift --project-location /tmp/fr-mac \
  --app-name "Focus Reader" --bundle-identifier <your bundle id>
xcodebuild -project "/tmp/fr-mac/Focus Reader/Focus Reader.xcodeproj" \
  -scheme "Focus Reader" -configuration Debug -derivedDataPath /tmp/fr-dd \
  CODE_SIGN_IDENTITY="-" build
open "/tmp/fr-dd/Build/Products/Debug/Focus Reader.app"
```

Then in Safari: Settings → Advanced → Show features for web developers;
Develop → Allow Unsigned Extensions; Settings → Extensions → turn Focus Reader
on and allow it on every website. Note the converter copies the extension
folder you point it at, which is why the command unzips the package first
rather than pointing at the repo root. (`--copy-resources` is the opt-in;
referencing in place is the default. There is no `--no-copy-resources` flag,
despite what older notes say.)
