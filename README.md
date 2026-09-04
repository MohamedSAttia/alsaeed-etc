# Al-Saeed Platform V15

Interactive e-learning platform for seven professional certification programs.

## Catalog

- Bilingual: PMP, PMI-RMP, PMI-ACP, GRCP
- English: P3O, PMI-PBA, Lean Six Sigma
- Four consistent package types: Complete, Simulation Exams, Final Review, Self-Paced Study

## Included capabilities

- Express + SQLite backend
- Student and admin accounts
- Package CRUD and independent systems/tools CRUD
- Vimeo lessons, short knowledge checks, mixed question types and full exam banks
- Downloadable guides, study plans and flash cards
- Activities and management decision games
- Server-validated promo codes and payment creation
- Complete-package-only attendance certificates with public verification

## Run

```bash
cp .env.example .env
npm install
npm start
```

Open `http://localhost:3000`. Configure the first admin through `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`.
