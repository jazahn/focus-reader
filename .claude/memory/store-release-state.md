---
name: store-release-state
description: Chrome Web Store (id nkjiekhhenickfmfphkncpofpcchbdpc) serves v0.2.1 since 2026-10-04; next upload needs version ≥ 0.2.2; release flow is dev → PR to main → GitHub release; git tags are unreliable (v1.0.0 is stray, v0.2.0 points at a 0.1.0 manifest)
metadata:
  type: project
---

Focus Reader is on the Chrome Web Store as
**`nkjiekhhenickfmfphkncpofpcchbdpc`**
(https://chromewebstore.google.com/detail/nkjiekhhenickfmfphkncpofpcchbdpc).

Release history (store side is the source of truth; verified from the
listing page):

- **v0.1.0** — submitted and flipped to Public 2026-08-20 (GitHub issue #1).
- **v0.2.0** — master switch + faded icon, commit `004561d`, live on the store
  by 2026-10-04 (an earlier version of this note wrongly said unreleased).
- **v0.2.1** — issue #4 fix ([[sync-storage-write-quota]]), commit `c2ccfc4`,
  merged dev → main via PR #8 and **uploaded to the store the same day,
  2026-10-04** ("Updated October 4, 2026" on the listing). GitHub release
  `v0.2.1` exists with no attached asset.
- **v0.2.2** — Safari/iOS compatibility ([[ios-safari-port]]): tint fallback,
  permission-aware popup, viewport meta, `commands` guard, opaque 1024 icon.
  In-tree on `dev` since 2026-10-31, **not uploaded anywhere yet**. It is the
  first version meant for both stores; the App Store side has no record yet.

**Release flow that was actually used for 0.2.1:** bump `manifest.json` →
`./tools/package.sh` → commit on `dev` → PR to `main` → GitHub release with
auto-generated notes → upload `dist/focus-reader-<version>.zip` in the
developer dashboard. Issue #5 asks for CI to build the ZIP.

**Gotcha: git tags do not map to shipped code.** `v0.2.0` and a stray
`v1.0.0` both point at `cd27899` (merge of PR #3), whose `manifest.json`
reads `0.1.0`. Only `v0.2.1` points at the commit that carries its version.
Do not infer what the store serves from tags; read the listing or
`Default/Extensions/nkji…/<version>_0` in the Chrome profile.

**Why this matters:** the store rejects re-uploading a version it already has,
so anything shipped after a release needs `version` raised first (next is
≥ 0.2.2). Testing the store-installed copy is not the same as testing the
unpacked tree.

`PUBLISHING.md` holds the full walkthrough, including the pre-written
single-purpose statement, permission justifications, and data-usage answers
(the extension collects nothing). `<all_urls>` remains the single biggest driver
of review time; §6 documents the `optional_host_permissions` +
`chrome.scripting` fallback, which is a real UX downgrade and a last resort.

**App Store (iOS):** no app record, bundle ID, or upload yet as of
2026-10-31. The upload path is the Safari Web Extension Packager in App Store
Connect, fed the same ZIP (`PUBLISHING.md` Part 2). After the first upload,
record here: the App Store id, the bundle ID, whether the packager took
`version` from the manifest, and how build numbers behave on re-upload.

Known open follow-ups: `PRIVACY.md` exists in-tree but needs a public URL for
the App Store listing (the GitHub blob page is enough); issue #5 (CI build
artifact); the stray `v1.0.0` tag.

See [[trademark-constraint]] for the naming rules that govern listing copy.
