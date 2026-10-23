# PMP reference-site consolidation, 2026-10-23

## Sources pinned

- MohamedSAttia/PMP-N, cd59db17d10e013490d22808c4eb83f00647b577; https://pmp-n.vercel.app/
- MohamedSAttia/PMP, 4147f550a61313addb747aa48d29a0638bfa137e; https://pmp-neon.vercel.app/exam
- MohamedSAttia/alsaeed-pmp2026, 4f6069093492bc0461c4b4892ed66a126c60f99b; https://alsaeed-pmp2026.vercel.app/

## Scope and migration decisions

| Source capability | AL-LTC integration |
|---|---|
| Neon 892 questions | Existing bank already contains all stems. 836 static rows gain missing source Arabic only after exact English option set and correct-answer-text match. Existing runtime editorial gates remain. No 892 duplicate questions. |
| Old Alsaeed 284 questions | Stems already present in uploaded v5 bank; source options and interactive source metadata retained, no duplicate batch. |
| SOMU 903 questions | 42 unmatched stems: 22 checked original practice candidates enabled, 12 additional candidates stored inactive for editorial review, 8 incomplete/incorrect-source items held out. |
| Mirrored missing translations | 2149 file targets reduce to 831 guarded option-order variants. Additive DB fill-missing-only seeding preserves trainer edits, active/disabled state and existing keys. Target count is not question count. |
| SOMU 24 study modules | Protected study resources, explicitly English-only where source contains no Arabic prose. |
| SOMU FRIGATE BRAVO | One complete programme narrative including its 28 text/table blocks; referenced by workshops, not 28 cases. |
| SOMU 24 activities | 22 workshops. Two detached diagnostic/full-mock workbook instructions use the existing unified assessment centre instead, avoiding nonexistent answer-key promises. |
| SOMU 24 template blocks | Separate template-guide text resources extracted from the accidental last-workshop spill. Not fabricated PDF/Word/Excel attachments. |
| Old bilingual study and summary | 24 preserved bilingual study/reference entries, grouped by source axis. Legacy exam-configuration section omitted. |
| Old ECO task cards | 26 bilingual task readings, grouped People/Process/Business. Source guidance, not asserted official exam validation. |
| Municipal simulation | Ten canonical decisions, original four indicator deltas. |
| SOMU simulations | Three canonical narrative simulations: S1 five, S2 four, S3 three decisions, original correct-choice keys/feedback. Count indicators, not invented percentages. |
| Editable lifecycle and process tools | 51 private workbooks: 11 lifecycle tools including charter/stakeholders/ROI/EVM/board self-review, 40 bilingual process-output workbooks with source templates and indicative process links. Dedicated revision-controlled drafts and explicit self-reported completion, fresh-device resume. No fake board approval/AI verdict. |
| Timers, navigation, language, calculator, flags, review, report | Existing unified AL-LTC engine remains authoritative. Current first-ten fixed case, ten-minute break and later section locks retained. No source two-five-case/five-minute-break regression. |
| Video files | Existing actual AL-LTC video catalogue is preserved. References supplied no new video binary or downloadable document links. |
| Login/payment/registration/admin | Existing AL-LTC ownership, enrollment and admin system retained. No parallel identity store or legacy fake credentials. |
| Historical browser results | Not imported. pmpHist, somu_attempts and guest local histories cannot be assumed to belong to an authenticated AL-LTC learner. |
| AI services or translation keys | No foreign API credentials or unconfigured third-party services copied. Existing AL-LTC supported functions retained. |
| Branding/testimonials/exam claims | No obsolete OCEG/GRCP branding, hardcoded ratings, or legacy test length/timing settings imported. Authored study claims remain attributed study content, not new official assertions. |

## Persistence and security

Library GET requires current active/nondeleted user and exact active PMP enrollment (admin preview allowed). POST simulation requires active enrollment even for admins. Every valid partial decision state is stored under authenticated user/package. Four simulation IDs have separate canonical state; repeated save is idempotent. Server computes indicators from trusted source choices; no exam scores or video completion are granted. Generic delayed progress snapshots cannot replace canonical simulation state. Existing exams, video flags and trainer edits are preserved.

All extracted bodies are plain text, never source scripts/event handlers/iframes. Source-language availability is explicit. Resource data is outside public assets and served private/no-store through enrolled API.

## Verification

- pmp-learning-library-api.mjs: account/package/expiry/soft-delete boundaries, invalid choices, malformed legacy snapshots, partial/full state, repeat save, four simulations, stale snapshot protection.
- pmp-reference-merge.mjs: exact option/key guards, safe missing-only translations, metadata normalization, trainer/disabled/other-package preservation, rerun idempotency, static bank count.
- pmp-quality-gate.mjs: existing current eligible cohort plus 22 checked imports, held/inactive/unrelated legacy excluded.
- pmp-practice-tools-api.mjs and pmp-practice-tools-dom.mjs: 51 editable tools, source-language rendering, safe text, active package/owner boundaries, two-device revision conflict, draft save failures and self-reported completion.
- runtime-packaging.mjs: all 24 local runtime import edges copied and allowlisted.
- Existing selected-language/shared-case/source-import/progress regressions retained.

Real browser rendering was unavailable in the current sandbox; no live student records or submissions were used. No deployment performed by this task. Legacy fake board verdict/voices/animations are not represented as a genuine automated approval; the source roles/prompts are retained as self-review tools.

## Release and rollback boundary

This task changes application code and additive startup seeds; it has not pushed or deployed, and all database tests use isolated fixtures, not the live learner database. Before a separately authorized release, retain an application rollback target and a consistent production database backup using the established deployment procedure. The migration adds source-tagged question rows, fills only missing guarded translations, and creates the private practice-draft table; it does not delete existing content, learners, enrollments or results. Rolling back only the application does not undo additive database rows or learner work created after release. Do not delete new learner drafts or restore an old database over later real activity as an automatic rollback. Any database rollback needs a separately reviewed, scoped plan with preservation of new real records.

Integrated cross-device regression coverage includes fresh login hydration, canonical score versus video completion, stale snapshot reconciliation, offline retry, owner changes, server revisions and simulation state. Both root and public entry inline scripts compile. The pre-existing catalog-refresh-sync deleted:false fixture failure reproduces on the pre-merge baseline and is not caused by this release.
