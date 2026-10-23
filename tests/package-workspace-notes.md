# Compact package workspace — 2026-10-23

## Scope
- Single compact learner header and primary navigation: Videos, Files, Tests, Practical activities.
- Study plan, readiness, review cards, challenges, workspace and certificate retained as secondary tools.
- Video lesson controls reduced to compact actions; topic summaries collapsed by default.
- Files grouped using the same authored course outline as lessons, preserving nested chapter headings and protected file actions.
- Assessment axes use current authored titles, hierarchy and order. Known axis keys use explicit question metadata; unknown custom headings require exact labels/indices and remain unavailable otherwise. No unrelated fallback questions.
- Only course-axis catalogue expanded initially; other modes remain available through category links/disclosures.
- Fixed language prestart buttons that inherited color without button dimensions. Added 44px minimum touch targets, separate language options, current-selection semantics, visible focus and a compact single-language prompt.
- Simplified video/exam frame styling; preserved official logo, language rules, shared case, breaks, answer logic, report and protected downloads.

## Verification
Passed targeted actual-DOM/local tests:
- package-workspace-ui.mjs
- package-experience-dom.mjs (33 public + learner packages, both languages)
- learning-polish.mjs
- assessment-catalog-polish.mjs
- assessment-course-axes.mjs
- exam-selected-language-dom.mjs
- exam-language-selection.mjs
- pmp-shared-case-dom.mjs
- lesson-exam-language-dom.mjs
- pmp-shared-case-selection.mjs
- exam-selected-language-ui.mjs
- inline-assessment.mjs
- lesson-display-order-ui.mjs (6 cases)
- lesson-display-order.mjs

The legacy learning-language-dom.mjs test fails because its test injection references a removed `entries` symbol in the unchanged learning-language.js. This is unrelated to the edited UI; selected-language DOM tests above pass. No production learners, attempts, files or settings were changed.

Visual verification remains limited: Chromium launch was blocked by sandbox socket restrictions, and cloud browser data URLs were rejected. DOM/CSS checks are not a pixel screenshot or live authenticated acceptance test. No deployment performed.

Only public/index.html is used by the Docker deployment. The obsolete root index.html UI was left unchanged to avoid introducing dependencies missing from that legacy source.

## Integrated progress baseline
Combined with the canonical-attempt reconciliation and owner-scoped progress retry patch. Passed nine reconciliation cases, exam-progress-save-dom, trainee-tracking (seven cases), admin-cohorts-server/UI, learning-workspaces, runtime-packaging (22 import edges) and production-image checks on the combined worktree. Only merge conflict was stylesheet cache version beside the new progress-sync script; both changes are retained. No deployment or historical record rewrite.
