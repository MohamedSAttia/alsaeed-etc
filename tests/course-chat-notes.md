# Private course conversations

## Behavior
- Course channel: active enrolled learners in that package, plus active administrators.
- Cohort channels: only the learner's current active administrative cohorts, scoped to the same package. Multiple active cohorts remain separate; cohort membership never grants an enrollment.
- General channel: only enrolled learners with no active assigned cohort, plus administrators. Archived cohort memberships do not prevent general access.
- Channel audience is displayed before composing. Chat is text-only, not an email/SMS notification service.
- Only the server-authenticated account authors a message. Public payload contains display name, message text, time, scoped message ID and owner/moderation booleans; no contact fields, profile biography or avatars.
- Name values resembling contact details are replaced with a generic participant label. Message text is escaped and remains plain text. Users are warned not to share private information.
- Membership, current account active/deleted status, package availability and enrollment expiry are rechecked on every request. Membership changes revoke prior cohort/general access immediately at the API boundary.
- Reads use bounded, channel-scoped cursors. Messages persist server-side and are readable from another authenticated device.
- Ten messages per account per minute, persisted in SQLite. Nonce-based retries are idempotent across devices; a nonce with a different payload/channel fails rather than silently duplicating.
- Authors can hide their own messages; administrators can hide or restore. Hiding is reversible and never physically deletes stored content. Hidden text is not sent in message listings.
- Failed sends preserve the draft in the current page and allow an explicit idempotent retry. Unsent drafts are not claimed to be synced to another device.

## Integration
`mountCourseChat` is mounted on the existing main Express server. The catalog callback reads the canonical `content_packages` setting. Docker COPY and context allowlist include the new module.

Load `course-chat.css` and `course-chat.js` after APP is initialized. Add a `[data-course-chat][data-package]` host within the authenticated package community UI. This module does not replace existing per-lesson discussions or trainer classroom features.

## Verification
- `node tests/course-chat.mjs`
- `node tests/course-chat-server.mjs`
- `node tests/course-chat-dom.mjs`
- `node tests/runtime-packaging.mjs`

All passed independently before integration. Tests use isolated synthetic accounts and databases; no production messages, learner records or external notifications were created. Final integrated host/navigation and Docker checks still required. Pixel-rendered visual acceptance is not claimed.
