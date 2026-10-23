# Private learner profiles

Extends existing users and admin history without duplicating authentication or enrollment. Owner and currently active administrators only can read profile contact/professional information and photos. No community avatar/public profile is introduced. Email remains read-only; changing verified authentication identity is outside this form.

Optional private fields: phone, biography, professional title, organization, goals and self-reported achievements. Existing name editable. Server CAS revisions reject stale device edits; failed UI saves retain draft text. Fresh GET restores server data. Course subscription expiry does not erase access to a user's own personal profile/history. Disabled, deleted and unauthenticated actors are rejected; admin permissions rechecked from current database state.

Photo UI accepts PNG/JPEG up to 5MB, rescales to768pixels and reencodes JPEG in canvas, stripping source metadata. Server accepts only bounded PNG/JPEG up to1MB/2048pixels, checks magic, structure, PNG CRC/zlib and JPEG scan; not a full image decoder. Server MIME/nosniff and private authenticated binary endpoint prevent SVG/HTML or public photo exposure. No external avatar URLs. Remove is explicit and revision-guarded.

Main successful password sign-in now updates existing users.last_login; failed login and profile viewing never touch it. Existing admin-panel sign-in already records this. No synthetic timestamp backfill or changes to learner history. Main authentication rejects soft-deleted users as well as disabled users.

Tests: learner-profiles-api.mjs, learner-profiles-login.mjs, learner-profiles-ui.mjs and runtime-packaging.mjs pass with direct node invocation. Node24 `--test` subprocess runner hit native better-sqlite3 cleanup crash; direct tests pass. No real accounts, images or database records used. No pixel-rendered visual acceptance claimed.
