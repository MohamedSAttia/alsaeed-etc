# Cross-device progress

Authenticated progress GET and successful PUT now return the account's canonical assessment results, video summary, and server revision. The learner displays video completion percentage separately from assessment score. Supplementary reference activities do not inflate the core video/activity denominator.

A new device hydrates enrolled packages from the server. Login, network recovery, and focus refresh progress without replaying a stale boot cache. Pending local changes are owner-scoped and remain explicitly unsynced until a successful server response; clearing storage before an offline write succeeds still loses those unsent changes. No credentials are persisted in the queue.

Revision-aware snapshot merging preserves missing/newer records. A current revision permits explicit unchecking; an outdated unversioned boolean snapshot merges conservatively toward completion rather than erasing another device's work. Timestamped reference activities and notes use their newer value. Dedicated canonical simulation fields and graded essays retain their server authority. Late lower-revision GET responses cannot replace a newer accepted PUT.

Synthetic two-client tests cover fresh storage, stale cached bootstrap, stale zero writes, independent account isolation, pending offline retry, canonical attempt-only hydration, delayed responses, malformed legacy JSON, and separate 69 assessment score versus 50% video completion. This does not verify the reported real learner incident without their identity and originating exam URL. No browser history or live student records were imported or rewritten.
