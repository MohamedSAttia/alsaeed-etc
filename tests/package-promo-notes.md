# Package promo and visual refresh — 2026-10-09

Original baseline: `7551e43aac0ece5ce977ae7c524f989be65e3a9d`. Reconciled with concurrent production commit `0bc9f78d4375ac530b3224ec09d5bdff2977bd5f` (tree `db2fc726a40d7a5fc8f3490cad71300cb76f3e58`). All incoming lesson, question-reference, exam, server and test files remain byte-identical; the three overlapping UI files retain both changes.

## Changes
- A distinct, original SVG illustration for each of nine courses, reused consistently across its package formats, catalog cards, course covers and responsive package detail headers. No new certification or success claims.
- The user-supplied 90-second PMP video is mapped to `pmp-full` by `public/package-promos.js`. A 1280×720 web copy and real-frame poster retain the creator credit. The user-requested PMP hero placement replaces the illustrated hero card, using the supplied PMP logo byte-for-byte and a single player area rather than a duplicate lower section. The MP4 is not requested until the user selects the player; it has controls, no autoplay, and is paused/unloaded on dismissal or navigation.
- Optional CMS fields `promoVideo` and `promoUseCoursePreview` apply only to full packages. An explicit empty `promoVideo` overrides and hides the supplied default. Other packages show no empty placeholder.
- Strictly accepted sources: a Vimeo numeric ID, HTTPS Vimeo/player URL (including unlisted hash), or a same-site `/assets/promos/ASCII-file-name.mp4`. Course preview fallback requires explicit opt-in and is labelled a program introduction. Lesson videos are never reused automatically.
- Admin fields validate before saving, await the existing catalog save, preserve non-full promo fields, and restore previous data on save failure. No database schema, payment, exam, attempt, enrollment or learner progression code changes.

## Verification
- `node tests/package-promo-dom.mjs`
- `CATALOG_FIXTURE=/tmp/alsaeed-live-content.json node tests/package-promo-dom.mjs` uses a read-only snapshot of the 36 live records (9 full packages). This optional path is local to the review environment; the test otherwise uses the repository catalog.
- `node tests/public-experience-dom.mjs`
- `node tests/package-experience-dom.mjs` checks 33 detail and 33 learner screens in both languages.
- Ten existing focused suites: rmp-review-snapshot, inline-assessment, assessment-loading, assessment-open, assessment-report-open, learning-language, course-roadmap, native-package, pmp-topic-flow and course-assessments; plus the incoming lesson-video, vimeo-reference and pmp-reference-english suites. For lesson-video, set `JSDOM_MODULE` to an available jsdom module path.
- JS/CSS syntax, whitespace, all SVG XML, video decode and poster dimensions checked. The nine SVGs were rendered and visually reviewed.

Synthetic Vimeo IDs in the tests are isolated DOM fixtures and never loaded or published as catalog data. No production API mutation is used by the tests.

## Limits and release checks
Local Chromium cannot launch because the environment rejects its socket creation. Preview/browser QA is required before production, followed by exact-commit production checks.

The video has no subtitle stream or visible Arabic captions. Its spoken language/claims were not reliably reviewed. The UI therefore calls it a PMP introduction and makes no Arabic-narration claim. Do not describe this as nine completed promotional videos: only the supplied PMP asset exists. Future videos should have reviewed Arabic narration/captions and verified playback/embedding permissions before configuration.
