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
