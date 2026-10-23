# Internal member conversations

- General discussion is authenticated-only, available to current active accounts. It is not published to the internet.
- Direct conversations require explicit recipient selection. Both accounts must remain active and not deleted. Only the two participants can read or write, including when an administrator is not a participant.
- Existing package/cohort chat records are untouched and retain enrollment/cohort gates.
- Member discovery returns only account ID and a bounded safe display name, never profile photos, email, phone or private profile fields. ASCII, Arabic and Persian phone-like names are masked.
- Messages use server-authored identity, plain text <=2,000 characters, scoped replies, persisted unread cursors, 10 sends/minute, idempotent nonces and bounded message pagination. Direct conversation creation is limited to20/hour per member.
- Edits/hides preserve prior versions internally. General-message restoration is administrator-only; direct-message restoration is author-only. The application exposes no revision-history endpoint.
- No attachments, voice notes, calls, WhatsApp integration, encryption claims, automated messages or external notifications are included.
- Unsent drafts exist only in the current browser page memory, not synced or stored locally. Saved messages and unread state are server-side.

Synthetic validation: community-chat.mjs (store/privacy), community-chat-http.mjs (mounted Express routes), community-chat-server.mjs (actual application startup and canonical route mount), course-chat.mjs and course-chat-dom.mjs (existing scope/session regression), runtime-packaging.mjs (Docker/context coverage). No live messages or accounts were used.
