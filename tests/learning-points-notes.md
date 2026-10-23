# Learning participation points

The authenticated package home uses POST `/api/learning-points/:pkg/sync` on load and after a confirmed learning save, then renders its returned snapshot. GET at the same base path is read-only. Requests never accept a user ID, a points amount or arbitrary event content. Current enrollment, package availability and current active/non-deleted account are checked on every request.

## Rules and evidence

One lifetime award per user, package, published item: video 10; recorded known assessment 20; reading 2; activity 5; complete simulation 10; complete practice tool 5; package game 5. Custom assessment filter permutations share one award. Retrying, reloading or unchecking/rechecking cannot award again. Existing saved evidence is reconciled once; summary-only legacy exam scores do not become point events. This is participation accounting, not anti-cheat verification: video/read/activity completion can be learner-declared and existing exam APIs report submitted results. Arabic and English rules are returned in every response.

The immutable, additive `learning_point_events` ledger records origin timestamp and award timestamp. Current completion can decrease when content changes, while lifetime participation points remain. Exam scores are not course completion percentages. Video and activity denominators are separate; zero available curriculum produces null percentage rather than a fabricated percentage. No videos, attempts, students, cohorts or enrollments are created by points reconciliation.

## Ranking and privacy

Ranks are package-scoped and include only currently active, non-deleted, unexpired enrolled students. Each existing active cohort is a separate view; learners in several cohorts appear once in the package total. Learners with no active cohort membership use a virtual General group. This does not enroll anyone. Equal points have equal competition rank (1, 1, 3); name and an unexposed internal ID order ties consistently. Top 20 rows plus the requesting learner's own row are returned. Public rows contain only bounded name, points, rank and isMe. Email-like or phone-only names use a neutral label; profile/contact/avatar fields are never queried. Replies are private/no-store.

## Rollback and tests

Migration is CREATE TABLE/INDEX IF NOT EXISTS only. Rolling back module mount/import and runtime copy lines leaves existing app records untouched. Keep the additive ledger during rollback to preserve earned points if re-enabled; never automatically purge it. No existing score, progress, enrollment or cohort records are rewritten.

Run `node --test tests/learning-points.mjs` and `node tests/runtime-packaging.mjs`. The suite includes real Express HTTP authentication/entitlement checks, parallel retries, denied forged body fields, replay idempotence, current cohort changes, no contact leakage and a fresh-client snapshot. Production writes use one SQLite transaction and a compound primary key, with no client-calculated points.

## Canonical post-save reconciliation

`afterSave(userId, packageId)` reconciles only that student's saved evidence synchronously before the success response. It is wired to the main progress PUT, workspace/classroom attempt POST (exam/game), and the gateway's tool and simulation writers. Failed/stale validation requests never invoke it. Exceptions do not change a successful canonical save into a failure: they leave a terse operational warning and mount/refresh reconciliation can recover. Both gateway and inner server use the same persistent SQLite ledger and uniqueness constraint. A dedicated HTTP integration case uses the real tool, simulation and workspace attempt handlers and proves immediate awards without calling the sync endpoint, including a rejected stale tool save and a repeated exam.

Standalone PMP engine sessions are included only when status is finished, owner/package match, exam_code is the fixed `pmp-2026-full-180`, and the persisted result contains valid numeric correct/total/score values. Every repeat of that exam shares one award. Finish and idempotent repeated finish both reconcile before response without modifying scoring. Session identifiers/answers never enter ranking payloads. Main-server account SQL tolerates the legacy schema before gateway adds deleted_at and enforces deletion whenever that column exists. The real spawned-server cross-device test verifies progress PUT awards before response and GET on another device returns persisted points without explicit sync.
