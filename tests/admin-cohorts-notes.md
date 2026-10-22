# Private administrative trainee cohorts

Base: production branch 1ae538ebfbc30ffecbd7144b0da4c719e1960045.

## Architecture
- Main SPA administration gains private named cohorts and rosters. These are deliberately separate from package-scoped classroom groups, whose memberships also determine trainer visibility and assignment/challenge audiences.
- Membership alone does not write users, enrollments, orders, progress, certificates or classroom tables. Removing membership soft-disables its row; adding again restores it. Archival preserves all memberships.
- Existing activation/edit/grant/bulk routes accept an optional cohortId in the same SQLite transaction. Invalid/missing/archived groups or non-student members abort the entire operation. Omitting cohortId leaves memberships unchanged.
- APIs require the current database user to remain an active administrator, not merely an old JWT claiming admin. No learner or instructor roster endpoint is added.
- Summary uses existing enrolled-course progress records and current non-deleted video lesson denominators. Unknown/invalid/no-video progress is excluded, not zero. Exam averages use valid stored exam score counts/totals, not averages of averages. This is saved progress, not proof of attendance, viewing time or complete classroom activity history.
- Main SPA `/admin` workflow only. Separate legacy management panels and classroom interfaces are unchanged.
- Additive tables only. Docker COPY and context allowlist include new backend module.

## Verification
Synthetic records only, no production users or messages.

JSDOM_MODULE=/workspace/shared/alsaeed-test-tools/node_modules/jsdom/lib/api.js NODE_PATH=/workspace/shared/alsaeed-test-tools/node_modules node --test tests/admin-cohorts*.mjs tests/trainee-tracking.mjs tests/admin-enrollment-extension-ui.mjs tests/manual-invoice-ui.mjs tests/manual-invoices.mjs tests/course-reviews.mjs tests/course-reviews-dom.mjs

43 passing focused tests. Post-auth-change synthetic server/unit rerun passes; independent review reruns also pass. Syntax, diff check and runtime Docker packaging check pass.

Covers admin/learner/instructor boundary, disabled/deleted/demoted token handling, real server activation and enrollment transactions, preserved payment/access/progress, archive/restore, reversible membership, numeric group selector, weighted aggregates, unenrolled/unknown learners, escaping, individual drilldown hooks, actual syncAdminData active-state preservation, duplicate-click/error/offline/new-dialog races.

Existing broader tests have baseline failures unrelated to this patch: two enrollment-extension fixtures lack lessons.deleted_at; cached lesson equality tests in admin-loading and catalog-refresh expect no deleted:false. Independent review reproduced against clean base. No production rollout or live-account verification performed. DOM checks cover mobile-friendly inherited grids and wrapping; no new browser screenshot verification claimed.
