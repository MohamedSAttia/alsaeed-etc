# Full PMP shared-case release

## Behavior
- First ten questions in a new full PMP mock share one original, substantial municipal-services case and unchanged localized title. Questions address ten separate case facts.
- Separate reading and question panes; Arabic case remains Arabic with optional English question/choice aid. English attempts have no Arabic toggle.
- First break is ten minutes with exam time paused. Unified later break remains after95, legacy/API after94. Section navigation cannot skip a pending break.
- Reload preserves exact question IDs, shuffled choices, answers, selected language, position and deadlines. Unified snapshots are local to the signed-in learner/device; legacy snapshots are same-tab; API stores session state on server.
- Running time outside the break continues across reload or suspended tabs. Explicit early resume supported. Account changes cannot save an old attempt under a new learner.
- New case IDs are versioned; previous API session IDs/content remain unchanged. Chapter/domain practice content is untouched. Full mocks retain180 unique questions and59/74/47 domains and existing scored/pretest policies.

## Verified
Focused suites: pmp-shared-case-content, pmp-shared-case-selection, pmp-shared-case-dom, pmp-shared-case-api, pmp-shared-case-legacy-dom, course-assessments, pmp-source-import, pmp-published-chapters, exam-translation-audit, exam-language-selection, exam-selected-language-ui, exam-selected-language-dom, exam-option-shuffle, exam-patterns-report, exam-content-protection, exam-drag-transfer, assessment-open, assessment-loading, legacy-exam-language-dom, runtime-packaging.
Run each with `node tests/<name>.mjs` at repository root. Tests use isolated fixtures and temporary SQLite databases, not live student data. Independent review additionally ran billing/reviews regressions.

## Limits
- Actual Chromium visual tests could not launch in this executor: sandbox socket failure, then escalated runner mount failure. JSDOM behavioral checks passed; do not claim pixel-level browser QA.
- The old standalone legacy Arabic full exam bank still lacks translations outside this new case, so its existing preflight gate remains. The main unified full mock has sufficient ready items for both Arabic and English and passes full-model tests.
- This is the user's requested training format, not a representation of official certification exam rules.
- Publication/deployment is coordinated separately. This workspace itself does not push or deploy.
