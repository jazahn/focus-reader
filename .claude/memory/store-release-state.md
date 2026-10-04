---
name: store-release-state
description: v0.2.0 is live and Public on the Chrome Web Store (id nkjiekhhenickfmfphkncpofpcchbdpc), so the next upload needs version ≥ 0.2.1; 0.2.1 (issue #4 fix) is in-tree and unreleased as of 2026-10-04
metadata:
  type: project
---

Focus Reader is on the Chrome Web Store as
**`nkjiekhhenickfmfphkncpofpcchbdpc`**
(https://chromewebstore.google.com/detail/nkjiekhhenickfmfphkncpofpcchbdpc).

- **v0.1.0** was submitted and flipped to Public on 2026-08-20 (GitHub issue
  #1, closed).
- **v0.2.0** (master switch + faded icon, commit `004561d`, 2026-08-29) **is
  the version the store serves** — confirmed 2026-10-04 both from the listing
  page and from the store-installed copy in this machine's Chrome profile
  (`Default/Extensions/nkji…/0.2.0_0`, location = web store). An earlier
  version of this note said 0.2.0 was unreleased; that was stale.
- **v0.2.1** bumps `manifest.json` for the issue #4 fix
  ([[sync-storage-write-quota]]) and is in-tree, **not yet uploaded**.

**Why this matters:** the store rejects re-uploading a version it already has,
so anything shipped after a release needs the `version` field raised first.
No git tags exist for any release despite issue #1 listing tagging as done.

**How to apply:** before any upload — confirm `manifest.json` `version` is
higher than the store's, run `./tools/package.sh`, and tag the commit
(`git tag v0.2.1`) so each store listing maps to a reproducible commit. The
store keeps the uploaded ZIP but gives no diff against the working tree.
Updates go through review again, usually faster than a first submission, and
roll out to existing users over a few hours. Testing the store-installed copy
is not the same as testing the unpacked tree: the installed copy is whatever
was last uploaded.

`PUBLISHING.md` holds the full walkthrough, including the pre-written
single-purpose statement, permission justifications, and data-usage answers
(the extension collects nothing). `<all_urls>` remains the single biggest driver
of review time; §6 documents the `optional_host_permissions` +
`chrome.scripting` fallback, which is a real UX downgrade and a last resort.

Known open follow-ups: no privacy policy page (only needed if the dashboard
insists); issue #5 asks for a CI build of the store artifact.

See [[trademark-constraint]] for the naming rules that govern listing copy.
