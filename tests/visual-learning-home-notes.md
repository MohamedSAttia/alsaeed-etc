# Learner home integration, 23 October 2026

## Scope
- New course overview and dashboard cards with original generated artwork, optimized local WebP (about 88 KB), course name, actual published rating, actual video completion and an ordered Continue action.
- Four illustrated entry points: videos, simulation tests, lesson attachments, digital library. Lesson attachments keep their existing course-axis/video order; PMP readings and applications live in the digital library. Existing protected players, file routes, language selection, exams and practical tools remain in use.
- Six compact primary navigation items, inline language/profile controls, horizontally scrollable mobile section navigation, responsive cards, reduced floating launcher overlap, keyboard focus and reduced-motion support.
- Community view uses canonical points/ranking API and scoped text-chat module. Profile editing remains private to the owner/admin, with canonical name changes reflected in the greeting.
- Unknown completion denominators are shown as a dash. Ratings are never synthesized. Points do not imply exam scores or official pass predictions; canonical rules and tie behavior are explained.

## Validation
New visual-learning-home-dom checks AR/EN content, four illustrated choices, actual rating data, ordered lesson continuation, saved progress repaint, unknown denominator, escaped ranking names, stale-owner protection, no client-supplied points and responsive CSS contracts.
Package workspace and full SPA package-experience tests were updated for the intentional six-section navigation; they preserve all previous protected resource, ordering, capability, focus and scoring invariants. Full SPA tests cover all 33 current packages in Arabic and English.
Integrated points, profile, chat, runtime packaging, cross-device progress, selected-language exams, shared case/break, save retry, protected library and practical tools suites passed during integration.

## Limits
Generated cover was visually inspected as an image. A real-browser rendered layout screenshot was not obtained: earlier browser execution/local page routes were denied or unreachable, and those restrictions were not bypassed. DOM/source checks are not pixel-level browser QA. The pre-existing learning-language-dom fixture error (`entries is not defined`) reproduces on the unchanged base and is not introduced by this patch.
No production changes, learner test attempts, source push or deployment were performed in this worktree.

## Local runtime caveat
Repeated main-server chat integration launches intermittently abort before readiness in the workspace's Node 24.19.0 / better-sqlite3 native Statement destructor. The improved test harness now surfaces the crash rather than hanging during cleanup. Three of five author reruns and several integrator runs passed; this is not a consistently green startup result. The unchanged production Dockerfile uses Node 20 bookworm, so this observation is not proof of a production failure. Actual deployment health must be checked on that runtime.
