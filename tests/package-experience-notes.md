# Package interface review

## Scope

Presentation-only additions for the existing package details and learner shell. The original course-specific chapters, objectives, languages, assessments, resources, score calculations, enrollment gates and stored progress remain owned by the original platform code.

New files:
- `public/package-experience.js`
- `public/package-experience.css`
- `tests/package-experience-dom.mjs`
- `tests/package-experience.mjs`

The main review integrates the stylesheet after existing styles and the script once at the end of `public/index.html`. The script does not call APIs, persist data, create accounts, purchase packages or replace exam handlers.

## Changes

- One ordered learner navigation across packages: plan, content/videos, assessments, files, flash cards, activities, games, practical application and certificate. Each section remains conditional on the original package renderer; no new learning content is implied or copied across subjects.
- Existing button nodes are moved rather than cloned, retaining their handlers and recorded completion counts. The plan's shortcuts follow the same order.
- The current section labels its content region. Keyboard focus returns to the selected control after a full application rerender.
- Desktop navigation has a bounded sticky panel. Tablet and mobile navigation stacks above the content, with wrapping layouts and 44px-or-larger touch controls specified in CSS.
- A progress shortcut focuses the existing recorded-progress summary. It does not recalculate progress.
- Package detail pages gain section-jump buttons that preserve the application's hash route. Related-package rows respond to Enter; coupon labels are associated with their input; comparison tables are keyboard-focusable scroll regions.
- Added interface copy is Arabic/English. Course material and translation completeness are not changed.

## Verified

`node tests/package-experience-dom.mjs` passes using jsdom. `JSDOM_MODULE` can point to an existing jsdom module when it is not installed in this project.

The integration harness evaluates the actual page and local application scripts, with a read-only unavailable-backend stub and an isolated in-memory learner fixture. It covers:

- All 33 active package detail renderers in Arabic and English
- All 33 active learner renderers in Arabic and English
- Exact preservation of each package's original navigation entry points
- Common order, including plan shortcuts, without adding unavailable sections
- Original package/course data unchanged after enhancement and navigation
- Recorded counts and an existing score retained
- Existing click handlers, current-section semantics and focus restoration
- In-page jumps without hash-route changes, related-package keyboard navigation and cleanup on leaving package routes
- Idempotent enhancement with no duplicated navigation or script errors

JavaScript syntax checks pass. These existing focused regression suites also pass:

- `tests/rmp-review-snapshot.mjs`
- `tests/learning-language.mjs`
- `tests/course-roadmap.mjs`
- `tests/native-package.mjs`
- `tests/assessment-loading.mjs`
- `tests/assessment-open.mjs`
- `tests/assessment-report-open.mjs`
- `tests/inline-assessment.mjs`
- `tests/pmp-topic-flow.mjs`
- `tests/course-assessments.mjs`

## Remaining verification

Real-browser testing was attempted but Chromium terminated before loading a page because this execution environment denies its process socket operation (`socket() failed: Operation not permitted`). No screenshots, actual viewport measurements or visual pass are claimed.

The prepared browser suite can be run in a browser-capable environment:

```sh
node tests/package-experience.mjs
```

It requires Playwright and Chromium; optional `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` select existing installations. Set `PACKAGE_SCREENSHOT_DIR` to save screenshots. It is designed to check 1440, 768, 390 and 320px layouts in Arabic/RTL and English/LTR using only a local static server and fixture data.

Live authentication, enrollment, real payment, production learner progress/attempts and an authenticated account session have not been exercised. This work does not publish, push, deploy or mutate a production database.
