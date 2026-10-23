# Source integration gap closure: exam setup, 2026-10-23

The three supplied images show PMP-N/SOMU's staged language, location and proctoring setup. Before this change AL-LTC had a real selected-language readiness gate and optional local camera preview, but not the connected environment wizard or persisted setup context. Existing migrated content (73 readings,22 workshops,26 task cards,4 simulations,51 editable workbooks and reviewed bank enrichments) is not reimported.

Implemented for full mocks: existing language-readiness gate → simulated center/online-practice cards → optional local-preview cards online → instructions and deliberate final Start. Center does not request camera. The camera is default-off. Selecting a camera card is not consent: an unchecked explicit local-preview checkbox and final Start are both required. Permission denial leaves no timer or attempt, with Start without camera or Cancel actions. No microphone, recording, upload, facial analysis, remote monitor, venue booking or official-proctor claim.

Canonical setup stores version/language/mode/camera/monitoring:none in per-owner local resumable full-mock snapshot, account progress assessment record and attempt detail. The report shows the chosen environment. Existing resume preserves language/mode, never reacquires camera automatically and discloses camera-off status. Existing resume mechanism is device-local; completed results use existing cross-device account save. This change does not claim cross-device unfinished-exam resume.

Repeated Start and stale permission resolutions are guarded by state+start-ticket+owner/token. Cancel, Back, route change, page exit, account change, completion and rendering failure release tracks. Render-start failure clears its started snapshot. No attempt record is sent until existing Finish flow.

Intentionally not copied: source's purported full proctor/face/multiple-person violation detection, artificial voice warnings, claims a real exam may be invalidated, fabricated credentials or third-party keys. Existing question-language gates, held content, coherent first-ten case, ten-minute break, scoring and auth boundaries remain authoritative.

Tests: exam-setup-dom.mjs covers actual combined JS in AR/EN with center and online paths, Back/Cancel, explicit consent, denial/no-camera continuation, double Start, deferred permission after Back/pagehide/beforeunload/token/account changes, route cleanup, forced-render failure, local snapshot resume and completion metadata. Existing selected-language and shared-case/break regression suites retained.

Integrator must load public/exam-setup.js before public/unified-exam.js and public/exam-setup.css in both served entrypoints. No publication by this worktree.
