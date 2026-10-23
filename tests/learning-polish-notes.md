# Learning interface polish review

Base: GitHub v13-production a5a4c4ee210576439bdf96cd711c8345ef57278e, verified 2026-10-23. Local reviewed commit 641b1f8363b4703b9a0c6ba93f337407a0214d5f has identical tree edb383061c4c72fd34fb526cceda7972a1de4184.

## Changes
- Reuses verified public/img/logo.png (official orange/blue SA and AL SAEED wordmark) in unified, standalone PMP/RMP/PBA/GRCP and authored lesson-question interfaces. Replaces generic book icon and old third-party image URL without modifying other organisation marks.
- Three native, keyboard-operable lesson actions in course outline and video player: watch video, download lesson file(s), read summary. Existing authored notes supply summary; missing media/files/notes show unavailable rather than fabricated content. Summary availability is consistent between lesson outline and player: English requires authored English notes; Arabic retains its existing notes fallback. Notes remain escaped text, attachments use the existing bearer-authenticated download endpoints.
- Distinct assessment-centre view inside authenticated learner route, with short header, clear returns to plan/lessons, no dashboard pushing catalogue off screen. Six categorized PMP sections, category navigation, real bank counts and configured timings, empty/unavailable states, custom-count validation and retry. No new engine or exam-content changes.
- Responsive shared surfaces, official logo, question-map jump/current status, answer/flag legend and section-range labels. No changes to answer keys, scoring, case split, timers, breaks or locking. Existing full-attempt persistence remains intact.

## Verification
Passed local-only tests: learning-polish; assessment-catalog-polish; learner-video-playlist; lesson-display-order-ui (all six original cases and updated first case); exam-selected-language-dom; exam-selected-language-ui; lesson-exam-language-dom; legacy-exam-language-dom; pmp-shared-case-dom; pmp-shared-case-selection; exam-content-protection; exam-option-shuffle; exam-drag-transfer; exam-coach-loop; assessment-open; assessment-loading; course-assessments; inline-assessment; pmp-topic-flow; package-experience-dom. JavaScript syntax and git diff whitespace checks pass.

The actual SPA test opens the dedicated assessment view, returns to lessons, and verifies stable order/progress. Real DOM tests cover both languages, original multi-file attachments and downloads, native disclosure, availability/locking, player resume, quiz/scoring, existing shared case and two breaks, explicit language gate, retry, classified bank matching and account-switch isolation.

## Limits and release
Chromium screenshot test could not launch: socket() Operation not permitted in process_singleton_posix.cc. No screenshots or real-browser layout validation claimed. No production learner writes, payments, enrolments, database changes, push or deployment performed. CSS visual review at desktop/mobile remains recommended before or immediately after authorized publication. Tests and notes need not be served. Docker copies public plus root legacy exam HTML; all changed runtime assets are included by its existing build.
