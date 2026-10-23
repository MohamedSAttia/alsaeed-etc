# Exam progress reconciliation

The exact learner report is still unverified pending the learner identity and originating exam URL. External PMP sites use separate storage and are not silently imported.

## Changes
- Administration now reads existing course-scoped server attempts as well as legacy saved learning snapshots, selecting the newest recorded result per assessment. Overview, cohorts, and individual reports share that calculation. A 69% exam result is not turned into 69% video completion.
- No historical attempts, enrollments, course access, grades, or learner data are rewritten. Reporting queries do not create workspace tables.
- Exam completion immediately flushes progress. Owner-scoped queued snapshots survive ordinary reload/offline failures and retry on reconnection or a new save. Credentials are not stored in the queue. Requests already sent retain their original owner token; pending writes do not follow a different logged-in account.
- A stale snapshot cannot erase a newer completed exam. Report errors remain visible, and a retry saves progress without duplicating attempt details.
- Learner result and pass/fail now consistently use the persisted one-decimal percentage with a 70% training target. For example 87/125 is 69.6%, not a rounded-up 70% pass. Historical scores are not rewritten.
- Docker's explicit copy/context allowlists include the new backend helper.

## Verification
Synthetic fixtures only, no live learners or real attempts. Focused unit/DOM/server cases cover 69% results with zero video progress; missing/corrupt snapshots; package/user isolation; deduplication; genuine zero; timestamp ties/newer results; stale-cache recovery; owner switch/logout; offline/reload retry; selected-language result/error/retry; and 69.6% pass boundary. Existing trainee/cohort and workspace workflow tests pass. The workspace fixture was updated to include the existing deleted_at schema expected by authentication and lesson queries. Runtime packaging and production-image checks pass. No deployment performed by this task.
