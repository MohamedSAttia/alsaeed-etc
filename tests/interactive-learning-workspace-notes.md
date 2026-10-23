# Interactive learning workspace

Original Al Saeed presentation based on the requested layout pattern, not Alison assets or copy. The existing canonical video engine remains authoritative. New module hooks only decorate its DOM and read existing saved progress/points.

## Scope
- Desktop logical-side module outline and mobile toggle/Escape, native expandable groups, active/completed states.
- Authored summary, protected lesson attachments and existing lesson assessment retained. Existing library/application route is linked without duplicate engines or invented per-lesson activities.
- Bottom current-module completed count/progress, server points and pending/error/retry status. Navigation itself awards nothing and saves nothing.
- Manual Next/Previous never autoplay; autoplay is off unless explicitly opted in. Published canonical order retained.
- Auth owner/token guards on stale player actions, discussions, downloads, points responses; back/close restores outline and focus without clearing the durable pending queue.

## Continuity boundary
Cross-device completion is supplied by the existing server hydration/owner-scoped durable progress queue. Continue uses the existing first-incomplete lesson calculation. This change does not invent a backend bookmark contract or claim to resume an exact second of playback.

## Local verification
Passed interactive-learning-workspace.mjs, learner-video-playlist.mjs, lesson-exam-language-dom.mjs and cross-device-progress-dom.mjs. Tests use synthetic state only. Mobile CSS and DOM/keyboard behavior were tested; actual browser pixel rendering is not verified in this environment. No deployment, live learner write, enrollment or OAuth/security changes.

Integration: load public/learning-workspace.css after existing learning CSS, and public/learning-workspace.js before v17-interactive.js. No index.html changes included in this commit.
