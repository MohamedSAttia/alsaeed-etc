# Public course reviews

A new opt-in SQLite table stores one editable review per user/course. Active enrollment in any catalog package for that course is checked server-side; zero/null expiry follows existing unlimited access semantics. Publication requires an explicit boolean consent on each save. A chosen alias defaults to “Learner / متدرب”; no account name, email, phone or user identifier is returned publicly. Ordinary email/telephone patterns are rejected in public text. This is a basic contact-data guard, not a comprehensive personal-information detector; the form warns against personal data. Rendering uses textContent only.

All published ratings, including negative ratings, count equally. The public summary includes every published rating, while the visible list contains the newest 50 (disclosed in the UI). Reads use no-store. Public figures refresh on course navigation, window focus, save and unpublish. Learners can unpublish after access expires; the stored record is recoverable. No private legacy coursework/feedback is migrated. No new admin moderation feature is introduced because there was no existing public-review moderation pipeline.

## Verification
- API integration on real SQLite: enrollment, consent, numeric/text bounds, account isolation, contact data including Arabic digits, update cooldown, upsert, negative ratings, withdrawal, zero/null expiry, total aggregation beyond list cap.
- Bilingual DOM: XSS-safe text, edit, consent reset, duplicate clicks, unpublish, repeated navigation.
- Runtime packaging and existing billing/exam-language regression checks.
- Actual server startup and GET endpoint on temporary empty SQLite.
- Browser test added but could not launch in this runtime: Chromium process socket denied; escalation fails during bwrap setup. No visual/browser pass claimed.
- Existing `course-experience-dom.mjs` fails its old nested topic count assertion (25 vs 11) both on this feature and untouched a47acf6 base.

No production test reviews were created. Release owner should verify the deployed public endpoint and assets before reporting publication. Fresh installation starts with no reviews or invented average.
