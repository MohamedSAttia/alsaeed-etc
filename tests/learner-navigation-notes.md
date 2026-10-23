# Learner navigation refinement — 2026-10-23

## Scope
- PMP assessment centre now leads with exactly three category links: chapter tests, domain tests, full tests.
- Chapter cards are ordered framework, agile, predictive, hybrid. Framework uses explicit topic metadata; approach chapters use explicit approach classification. The original detailed course-axis, phase, approach and custom tools remain in a collapsed advanced section, preserving legacy IDs and launch routes.
- Five full-test cards use the existing shared-case builder. Cards are unavailable when the real classified bank cannot supply 180 unique questions. Language is selected before starting, with existing 10-question shared case, 10-minute break, result saving and resume behavior unchanged.
- Published video chapter groups, including nested original chapters, use native details/summary. Counts include only published videos; completed counts use saved lesson progress. State is owner/package scoped in memory across navigation; continuation opens matching ancestors without expanding unrelated chapters. No student progress is written by the accordion.
- Private self identity on enrolled package/dashboard uses the existing authenticated profile/photo API. Initials are used when no photo exists. Blob URLs are revoked on invalidation/removal; stale owner, token and request results cannot paint the current identity. No photo/contact data is added to rankings.
- Course review and inquiry buttons, lesson feedback buttons and admin inbox entry integrate the separate feedback module. Rating does not award points. Public course reviews still require explicit publication consent; lesson/exam comments remain private to author/admin.
- Historical-points reconciliation and item-feedback backend commits are integrated separately. Administrator self points are labeled as personal, excluded from trainee rankings.

## Verification
- DOM regression: assessment category navigation, four ordered chapter cards, five mock cards, real counts/timing, disabled missing classifications, custom filters, Arabic/English labels and retry.
- Independent identity race and accordion state tests.
- Existing course-axis mapping, mock builder, bank request isolation, opening/report, shared-case translation/break/resume, lesson language and private profile tests.
- Real HTTP learning points (13 checks) and private feedback tests.
- Existing all-33-package public/enrolled rendering and route/keyboard/legacy enhancer tests.
- Docker runtime import/context packaging check.

## Limitations
No live student record, photo, attempt, rating or chat message was created/changed for verification. No push or deployment. Real authenticated browser screenshots and mobile pixel QA remain unverified in this environment. Twelve original 16:9 course covers are integrated locally (812KB total); unknown courses retain their custom/default fallback. Package tiers share their course subject artwork.

## Reference-led follow-up
The reviewed pre-reference baseline remains on `reviewed-course-navigation-20261023` at `4d95a5f`. A separate follow-up adds original inline-SVG section icons, a selected navigation rail, a course-home/title strip and responsive 3/2/1-column lesson cards inside the same expandable chapters. The supplied PMI screenshots inspired only the functional hierarchy; no brand, wording, media or design asset was copied. Existing play, file, summary, feedback, sorting and progress handlers remain unchanged.
