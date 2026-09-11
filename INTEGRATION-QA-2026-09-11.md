# Al Saeed LMS — Safe Integration QA Notes

Date: 2026-09-11

## Base and branch
- Production base: `v13-production`
- Verified base HEAD: `0a96940f7ad03d8ba6dfabe77839711f224cbdda`
- Integration branch: `v14-integration-20260911`
- Production/Railway has NOT been changed by this integration work.

## Claude V14 review
The attached Claude V14 bundle was inspected. It remains a useful visual/UX benchmark (logo, unified package presentation, interactive learning components, systems presentation), but its packaged backend is older than the current production branch. Therefore no V14 backend file is copied over wholesale. Current production architecture remains the source of truth.

## Implemented on integration branch
1. Unified package editor overlay with required Course linkage and AR/EN package metadata.
2. Safe package Archive/Restore instead of destructive deletion.
3. Generic JSON Question Bank import; English content is never silently copied into Arabic fields.
4. Separate Question `Task` and `Review Status` metadata with persistent DB columns and admin save endpoint.
5. Question filter/export updated for Task and Review Status.
6. PMP 2026 full simulator moved to the server session engine from random client-side sampling.
7. PMP full simulator targets exactly 180 questions / 240 minutes / People 59 / Process 74 / Business 47.
8. PMP sections aligned to Q1–10, Q11–96, Q97–180; breaks are 5 minutes after Q10 and 10 minutes after Q96.
9. Timer pauses during breaks and previous sections are locked after resuming.
10. Full PMP answers and review flags are persisted server-side; final domain report comes from the server.
11. Legacy PMP import no longer writes English question/options/explanation into Arabic fields when no Arabic translation exists.

## Source/build checks completed
- Integration branch is based directly on the latest production HEAD; no production commits are missing.
- Changed JavaScript was syntax-checked during implementation.
- Vercel preview builds for the integration commits completed successfully with no build errors.
- `proxy.js`, Vimeo referrer handling, Kashier verification logic, Railway DB path/volume handling, and secrets were not changed.

## Runtime acceptance checks still required before Production
- Admin login and unified menu on desktop/mobile.
- Create/Edit/Archive/Restore Package; reload and confirm persistence.
- Create/Edit Question; save Task/Review Status; reload and confirm persistence.
- Generic JSON import on a non-production test package and language-review behavior.
- PMP full session starts with 180 questions and exact 59/74/47 distribution.
- Break after Q10 = 5 min; break after Q96 = 10 min; timer pauses and previous section locks.
- Answer/flag persistence across reload/session continuation.
- Vimeo playback with production referrer restrictions.
- Kashier Test payment: server-side order/amount/currency/status/signature validation and enrollment only after verified payment.
- SQLite persistence after Railway redeploy.
- Certificate verification and responsive QA.

## Production gate
Do not merge/deploy this branch to `v13-production` until the runtime acceptance checks above pass. Do not add secrets to GitHub or delivery files.
