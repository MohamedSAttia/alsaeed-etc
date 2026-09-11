# Al Saeed LMS — V18 Integration

Date: 2026-09-11
Base: V17 production (`5d16c35af4341775ceb8f6ebfdf2f82cfbce6b1a`)
Safety backup: `pre-v18-backup-20260911`

## Objective
V18 merges the strongest visual ideas from the Claude V14 package into the current V17 production architecture without rolling back later backend, admin, payment, Vimeo, exam, or content work.

## What V18 adds
- Premium UI layer for the public site, course catalogue, course detail pages, learning area, cards, navigation, forms, tables, footer, and mobile layouts.
- Premium admin UI layer on top of the existing unified V15/V17 admin application.
- Admin branding updated visually to V18 while preserving the existing APIs and behavior.
- Automatic, non-destructive catalog merge from `public/v15-catalog.json` into the production database when a package/course is missing.
- Automatic question-bank import from existing static exam sources into SQLite so the banks become visible/editable in Admin Question Bank.

## Question banks seeded from existing source files
The source files in the repository are English-only. V18 preserves the original English text and intentionally leaves Arabic fields blank, with `needs_ar_translation` metadata, rather than fabricating translations.

- PMI-RMP: 442 source questions
- GRCP: 119 source questions
- PMI-PBA: 569 source questions

The seed is applied to the relevant full/simulation/review package variants found in the catalog. It uses `INSERT OR IGNORE` plus source IDs, so existing/admin-edited questions are not overwritten on restart.

## Existing functionality preserved
- Railway / Docker deployment flow
- Express / SQLite architecture
- Gateway / proxy
- JWT authentication and admin sessions
- Vimeo lessons
- Kashier payment integration
- Existing PMP engine and official PMI question seed
- Unified Admin Course Builder / Packages / Question Bank / Students / Vimeo / Exams / Resources / Orders / Invoices / Settings
- V16/V17 interactive and bilingual frontend assets

## New files
- `v18-seed.js`
- `v18-build.js`
- `public/v18-interface.css`
- `public/v18-interface.js`
- `public/admin-v18.css`
- `public/admin-v18.js`
- `CHANGELOG-V18.md`

## Deployment behavior
- `v18-build.js` runs at Docker image build time and injects V18 CSS/JS references once into public/index and admin wrappers.
- `v18-seed.js` runs at container startup before the gateway, against the mounted production database.
- The seed is idempotent and can safely run on every Railway restart.

## Important content note
The current repository does not contain verified Arabic translations for the full RMP/GRCP/PBA banks. Admin will therefore show these imported questions as needing Arabic translation. Verified bilingual banks can later be imported without changing the V18 architecture.
