# Coherent learning visual iteration

Base: f7840f6. Preparation only, not published. Official logo assets unchanged.

## Decisions
- Shared Alsaeed colors, type, surface and control tokens in the already-loaded learning-design.css. Navy #0E2444, original orange #F0741A; dark orange #B84900 for readable white-label primary actions.
- auth-entry.css now owns one desktop layout and one mobile layout, rather than successive competing banner overrides. Mobile shows the account form without a decorative banner. Scroll, safe-area inset, 16px fields, 44px controls, reduced motion and existing focus handling remain.
- Learning home presents the actual next lesson title (escaped) and continuation action. On mobile, the cover moves below that task rather than consuming the first screen. The four requested destinations and review/help controls remain accessible.
- Practice categories share one neutral visual grammar and a navy selected state, rather than unrelated category colors. Required chapters, domains, full exams, and targeted-practice data/structure are untouched.
- Question list inherits the same brand/type; its keyboard behavior and logic are unchanged.

## Evidence
Actual supplied desktop catalog, SOMU question list and mobile sign-in images were inspected. Public official pages consulted for information hierarchy, not claimed pixel comparisons:
- https://www.coursera.org/courses?query=project%20management
- https://www.linkedin.com/learning/
- https://alison.com/

## Verification
Passed: coherent-learning-design, visual-learning-home-dom, signin-reference-dom, assessment-catalog-polish, exam-reference-dom (now includes forward/backward Tab wrap), practice-hub-dom, learner-navigation-accordion, learner-navigation-identity. CSS parsed and literal property values validated with css-tree; runtime var/env expressions explicitly excluded from value-grammar validation. Selected text/action pairs tested at >=4.5:1. JavaScript syntax and git diff whitespace checks passed.

Not performed: real-browser screenshots at 390px and desktop, actual keyboard-tab traversal, browser zoom/keyboard viewport, or comprehensive computed contrast across the app. Current browser permission restrictions were respected, not bypassed. DOM/source tests do not establish visual acceptance. Publication should wait for actual pixel review using an approved browser route.

## Integration
No index.html or OAuth-provider files changed. Existing stylesheet URLs will need a cache-version bump at integration: learning-design.css, auth-entry.css, visual-learning-home.css/js, exam-reference.css and practice-hub.css. Preserve dormant provider rules if cherry-picking alongside the separate OAuth work.
