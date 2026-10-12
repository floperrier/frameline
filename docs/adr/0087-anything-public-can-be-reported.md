---
status: accepted
---

# Anything public can be reported

Decided on 2026-10-11, in a design session held before any issue. Amends
`docs/adr/0027-a-comment-is-said-of-the-whole-story.md`.

0027 left the report queue out: *there is nobody to report yet. The day it is
needed, a `mailto:` link is five lines.* The decisions taken the same day bring in
much more public text written by Authors: public Lists and their reasons,
conversations under a Story, Stories copied from other Authors, and Stories For
Adults. Our understanding, still to be confirmed, is that the European Digital
Services Act asks every host of what other people publish, however small, for a
way to say that something is unlawful. That day has come.

**A Story, a Comment, a public List and a Profile each carry a control to report
them.** A report says what is reported and why. It is kept, and it is sent by
email to whoever runs Frameline, who acts by hand: unlisting, unpublishing,
taking a Comment away, or doing nothing. Nothing acts on its own. The product has
no moderation queue and keeps no count of reports. A number of reports that hid a
Story would be a score to farm against somebody
(`docs/adr/0084-the-catalogue-is-ordered-by-nothing-counted.md`).

**What the law asks is settled by a research note before this ships**, in
`docs/research/`, together with the questions
`docs/adr/0091-a-story-for-adults-is-read-behind-an-account.md` leaves to it. That
note also says whether reporting needs an account. As we read the regulation,
anybody must be able to report, which would make a report the one thing a Reader
without an account can write.

## Consequences

**It ships before what it answers for.** It is delivered after Share and before
public Lists, answers to Comments, copies between Authors and Stories For Adults.
No new public text then exists without a way to report it.
