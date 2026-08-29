---
name: store-release-state
description: v0.1.0 is already live and public on the Chrome Web Store as of 2026-08-20, so any further upload requires a version bump first
metadata:
  type: project
---

Focus Reader **v0.1.0 was submitted and flipped to Public on the Chrome Web
Store on 2026-08-20** (GitHub issue #1, closed, every box checked — developer
account registered, $5 fee paid, screenshots and description done, published
Unlisted first and then made Public).

**Why this matters:** the store rejects re-uploading a version it already has.
`manifest.json` still reads `0.1.0`, so the current working tree **cannot be
uploaded as-is**. Anything shipped after 2026-08-20 needs the `version` field
raised first. As of 2026-08-23 the master on/off switch and faded-icon work is
in the tree but unreleased, and no git tag exists yet despite issue #1 listing
tagging as done.

**How to apply:** before any upload — bump `manifest.json` `version`, re-run
`./tools/package.sh`, and tag the commit (`git tag v0.2.0`) so each store
listing maps to a reproducible commit. The store keeps the uploaded ZIP but
gives no diff against the working tree. Updates go through review again, usually
faster than a first submission, and roll out to existing users over a few hours.

`PUBLISHING.md` holds the full walkthrough, including the pre-written
single-purpose statement, permission justifications, and data-usage answers
(the extension collects nothing). `<all_urls>` remains the single biggest driver
of review time; §6 documents the `optional_host_permissions` +
`chrome.scripting` fallback, which is a real UX downgrade and a last resort.

Known open follow-ups: no privacy policy page (only needed if the dashboard
insists), and the local working directory is still named `bionic-reader` while
the repo is `focus-reader`.

See [[trademark-constraint]] for the naming rules that govern listing copy.
