# Applied practice tools consolidation

Source: MohamedSAttia/PMP-N cd59db17d10e013490d22808c4eb83f00647b577, public index.html authored data. Extracted declarative LIFE(11), PROC(40), TT, OTPL, CHARTER, SREG columns/strategy texts, BOARD prompts, PANEL roles and CHAIN indicative relations. Source scripts are not served or executed in the learner page.

Implemented inside Activities:
- Eleven editable lifecycle workbooks, including 10-section project charter, stakeholder row editor with source strategy suggestions, fictional board-role prompts, business-case ROI/simple payback and EVM calculations.
- Forty process-output workbooks with bilingual inputs/tools/outputs, clickable indicative previous/next process relations, and source example templates where published. Relationships are heuristic text matches, explicitly not a mandatory official sequence.
- Editable output drafts, explicit save, learner-declared completion, text export, server-hydrated same-account continuation on a fresh device.
- Dedicated owner/package/tool rows, optimistic revision conflict protects newer device changes. No exam scores, pass/fail grants, or certificate grants. Active exact-package enrollment required to save; current deleted/inactive account rejected. No admin writes without enrollment.
- Source board keyword-based fake approval verdict, animations/voices, standalone auth, AI/external service credentials and automatic third-party sending are not copied. Board is honest self-review, not an official or AI approval.
- Use fictional practice data notice. Output remains private account data, aggregate admin summary exposes counts only.

Integration:
import createPmpPracticeTools factory in gateway; initialize with db,definitions,getPackages,userFromToken,sendJson,readJson; route /api/pmp-practice-tools/; add pmp-practice-tools.js to Docker explicit COPY. Definitions data file already in copied data tree.
Front-end script/CSS hooks and Activities mount are coordinated by library UI worker.
Export toolSummary(db,userId,packageId) returns total,started,completed,latestAt for optional admin counts without exposing draft content. New schema initialized by API factory.

Tests: node tests/pmp-practice-tools-api.mjs; node tests/pmp-practice-tools-dom.mjs. Local isolated SQLite/DOM synthetic fixtures only. Real browser screenshots and live learner records not exercised.

## Agile/hybrid workbook addition (2026-10-23)

The authenticated catalog now contains 55 tools: the original 51 plus agile:approach, agile:scrum, agile:kanban and agile:hybrid. Their declarative definitions are under AGILE.workbooks. All four share the existing pmp_practice_drafts owner/package/tool persistence and optimistic revision protection. No second persistence system or browser storage was added.

Source provenance: MohamedSAttia/PMP-N main a7715afcdf9a7ed323ce8d6cc9b34b78a682547d, 07b-agile-hybrid.js (APPROACH, SCRUM, KANBAN, SCRUMX, HYBRID). The added LIFE.appr guidance in 10-lifecycle-data.js is incorporated into the approach workbook rather than duplicated as a twelfth lifecycle form.

- Approach: eight bounded integer factor ratings; source thresholds require at least four ratings, use a three-point range for mixed signals, then averages 2.4/3.6 for the illustrative suggestion. These are not exam scores or official decision rules.
- Scrum: source roles/events/artifacts, optional readiness agreement, Definition of Done, fictional team capacity, editable backlog/acceptance criteria, sprint IDs/status/goals, current-sprint diagnostics, closed-sprint velocity and a cautious range forecast. Source example names are replaced with role labels; no real-person details are seeded. Zero observed velocity does not manufacture a finite forecast. Missing estimates suppress forecasts. Capacity points are educational and are not hours or individual performance measures.
- Kanban: editable cards/columns and bounded WIP limits, visible board snapshot, limit breaches and possible testing constraint. Feedback deliberately does not call the overall process healthy merely because limits are met. An explicitly entered zero limit permits zero work in that column.
- Hybrid: five source scope areas, editable approach choices and rationale, authored suggestions with contextual hints, and up to four candidate predictive/adaptive delivery interfaces. Alignment is self-reflection, never grading or official approval.
- The original source omitted English text for the regulatory-burden factor. Neutral English labels were supplied for this workbook, explicitly recorded in AGILE.source.adaptations. All other available bilingual source guidance is preserved. These adaptations are not represented as official source text.

Load public/pmp-practice-model.js before public/pmp-practice-tools.js. The same pure calculation implementation is imported by the backend; it executes no user-provided code and makes no network calls. API validation applies bounded row arrays, known fields, finite numeric ranges, integer factors/limits, unique IDs and at most one active sprint. Existing accounts without a deleted_at column are supported; inactive/deleted accounts and hidden/deleted packages are rejected without expanding access.

Report integration: window.PmpPracticeTools.reportSnapshot(packageId) returns a deep copy of {packageId,definitions,catalog,states,unsavedDrafts,language} only for a connected mount owned by the current authenticated user in the exact package. states is saved data only; unsavedDrafts is separate, contains changed {inputs,completed}, and is not automatically saved or included in a saved-state report. The toolbar invokes window.PmpPracticeReport.open(packageId). practiceFields(id,definitions) exposes top-level fields; repeatable row schemas are in the workbook's groups array.

Verification passed: existing pmp-practice-tools-api.mjs and pmp-practice-tools-dom.mjs, plus pmp-agile-practice-tools-api.mjs and pmp-agile-practice-tools-dom.mjs. Coverage includes all four workbook types, bilingual labels and source provenance, invalid/oversized/duplicate input, zero/missing estimates, shared browser/server result parity, saved draft continuation across factory restart, CAS conflicts, owner/package separation, blank-completion rejection, account/package gates, unsafe-string rendering, report boundaries, repeated saves, edits during save/load, source-template cancellation and Arabic fresh hydration.

A local Chromium regression fixture is provided as pmp-agile-practice-tools-browser.mjs. Browser verification has NOT passed in this executor: Chromium launch fails because its local singleton socket is prohibited (EPERM); the permitted escalation attempt fails during sandbox setup with a read-only filesystem error. No production state was read or changed. Run this fixture in an approved browser-capable executor before claiming visual QA.
