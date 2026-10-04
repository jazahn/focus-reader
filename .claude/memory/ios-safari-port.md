---
name: ios-safari-port
description: iOS Safari port planned 2026-10-04 — same-repo safari/ wrapper via converter; tracked in GitHub issue #7; Highlight API needs Safari 17.2+
metadata:
  type: project
---

An iOS Safari port was planned on 2026-10-04 and is tracked in
**GitHub issue #7** (https://github.com/jazahn/focus-reader/issues/7), which
holds the full task checklist. No code or Xcode project exists yet.

Decisions already made (don't re-litigate):

- **Same repo**, not a separate one: the wrapper is the same extension source,
  and a copied tree would drift silently (see the four silent-failure
  identifiers in CLAUDE.md). Generate with
  `xcrun safari-web-extension-converter . --no-copy-resources` so the Xcode
  project under `safari/` **references** the shared source in place.
- The Chrome store ZIP is already protected from `safari/` by the explicit
  allowlist in `tools/package.sh` — no packaging change needed.
- **First smoke test on device: CSS Custom Highlight API**, which Safari only
  supports from 17.2 (late 2023). Below that the extension renders nothing,
  silently — same failure mode as [[highlight-api-architecture]].
- App Store side: the extension ships *as an app* (converter's container app
  satisfies Apple guideline 4.2 as-is); privacy label is truthfully
  "Data Not Collected"; set `ITSAppUsesNonExemptEncryption = NO`; "Focus
  Reader" name availability on the App Store is unverified (cf.
  [[trademark-constraint]] — the name already changed once).
- Version coordination between `manifest.json` and the Xcode
  `MARKETING_VERSION` is an open task (relates to [[store-release-state]]).
