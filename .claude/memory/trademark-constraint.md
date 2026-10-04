---
name: trademark-constraint
description: "Bionic Reading" is a broadly registered trademark with an enforcement history; why this project is named Focus Reader and keeps the term out of the shipped bundle
metadata:
  type: project
---

"Bionic Reading" is a registered trademark, held by BRCG Casutt GmbH (Chur,
Switzerland) and commercialized by Bionic Reading AG. Registered in the **US
(5557651)**, EU (015969488), UK, Canada, Japan, Australia, New Zealand,
Switzerland and Liechtenstein. They also run IP/API/volume licensing programs.
The only patent they claim is a French publication (FR1755215) — patents are
territorial, so the *implementation* is not the exposure; only naming is.

They have an enforcement history. A June 2022 notice against another open-source
reading extension stated they had decided to "crack down on any open source
projects that involves Bionic Reading®"; that project is now called
Read-Enhancer.

**Why:** the project was originally named "Bionic Reader". A takedown does not
arrive at upload — it arrives once there are users and reviews to lose. Separately,
Google acts on trademark complaints administratively and does **not** adjudicate
nominative fair use, so a store listing can be suspended regardless of legal
merit. Store policy independently forbids keyword-stuffing competitor brands.

**How to apply:** the rename to **Focus Reader** went all the way through — the
highlight registry name, CSS custom property, and internal message type included
— so the packaged bundle contains **zero** instances of the phrase. Keep it that
way; reviewers read source, and a listing that avoids the term while the code is
full of it is worse than either alternative. `PUBLISHING.md` §0 deliberately
retains the term because it explains this, and that file does not ship.

Agreed strategy if referential use is ever wanted: keep the **store listing
clean** and put a single attributed, non-affiliated sentence in the **GitHub
README** instead — lower-risk venue, and web search indexes it. Never in the
name, a heading, the domain, or the extension ID; never their logo or wordmark;
never call the output "Bionic Reading format" (genericization is what rights
holders fight hardest). Note the discoverability upside is near zero anyway,
since store ranking is driven by installs and ratings, not keywords.

Not legal advice — an hour with a trademark attorney settles it if certainty is
ever needed.
