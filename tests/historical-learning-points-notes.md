# Historical points reconciliation

## Verified code findings
- Historical main progress records used `lessons[index] = true`, the same exact numeric index keys as the current server lesson table. Do not reinterpret truthy strings, timestamps, arbitrary keys or missing video flags as completed videos.
- The old main/lesson/unified assessment runners saved completed results into `progress.exams`. Old `full`, `practice`, `chN` and `lessonN` reference keys were excluded by the previous points allowlist. Some runners saved snapshots before the scoped attempt tables existed.
- Admin could access learner view but all point reconciliation excluded admin role, yielding misleading personal zero. The affected production account has not been verified; this is a confirmed code path, not an account diagnosis.

## Change
- First authenticated points read reconciles the owner's existing saved evidence before returning. Repeated reads/save hooks/syncs use the same unique `(user, package, event)` key.
- Accept recognized saved completed assessment results with finite 0–100 score, positive non-future completion timestamp, and either positive integer question count or the original boolean pass flag. Ignore missing/invalid counts, pending manual review and unknown references. A zero grade is valid completed participation, never a fabricated pass.
- Exact old `chN` aliases share `chapter_N` award identity; existing published lesson and chapter IDs validate legacy references. Fixed full/practice buckets receive at most one award each. No guessed cross-format title matching.
- Active administrator own saved work earns private personal points. Administrators remain absent from all trainee leaderboard participant lists and have `self.eligible=false`, no public self rank.
- Malformed saved progress returns an error instead of a successful zero. Existing frontend error state already says points unavailable and offers retry.
- This is lifetime participation accounting, not a certification, anti-cheat assessment, arbitrary credit or production bulk migration. No production DB modified and no external browser history imported.

## Checks
Run `node --test tests/learning-points.mjs`. Includes first-read backfill, source result/attempt duplicate deduplication, old lesson/chapter refs, missing/fake refs, invalid/missing/future result shapes, failed zero-score results, repeat/fresh-instance idempotency, cross-account isolation, admin own totals with student-only public ranks, and HTTP unavailable on corrupt records.

## UI integration contract
Display `self.points` only after successful API response. `self.eligible=false` means personal points exist but the administrator does not compete in trainee rankings. Do not show rank zero or imply points are ineligible. Keep last known data or visible unavailable state on network/database errors. No need to change or add credentials/roles/enrollments.

## Corrupt peer isolation
A malformed unrelated participant snapshot does not block a healthy owner's sync. Bulk reconciliation skips only the specifically typed unreadable-progress condition; database/query/other errors still fail normally. The unreadable participant is omitted from both cohort and package rankings, rather than represented as zero or a complete old balance. The API exposes only `rankingStatus: partial` (no private identity/error details), and existing ledger points are retained. Once the progress record is repaired, the participant returns idempotently. The affected owner's own read/sync remains an unavailable error. The 13th suite verifies this through real HTTP with two saved learners and recovery.
