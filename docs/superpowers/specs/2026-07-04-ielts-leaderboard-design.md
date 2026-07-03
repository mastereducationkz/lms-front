# IELTS Weekly Scores in the Leaderboard — Design

**Date:** 2026-07-04
**Repos:** `lms-backend` (branch `feat/ielts-leaderboard`), `lms-front` (branch `feat/ielts-leaderboard`)

## Goal

Show students' weekly IELTS test results (band scores + examiner feedback) in the
Лидерборд page (`/curator/leaderboard`, used by curators, head curators and admins),
the same way SAT weekly results are already integrated. Data comes from the IELTS
platform API (`ieltsapi.mastereducation.kz`).

## Decisions (confirmed with product owner)

1. **Scoring:** the overall band (0–9) is converted to 0–100 (`band / 9 × 100`) and fed
   into the `mock_exam` score, so IELTS groups rank in Итого/% the same way SAT groups
   do. The leaderboard cell displays the *band* (e.g. `7.5`), not the converted value.
2. **Columns:** a single **IELTS** column replaces «Пробный экзамен» for IELTS groups
   (where SAT groups show SAT Math / SAT Verbal). Clicking a cell with data opens a
   modal with all four section bands, the overall band, and the Writing (Task 1/2) +
   Speaking (4 criteria + overall) examiner feedback.
3. **Scope:** Лидерборд page only — same scope as the SAT integration.

## Backend (`lms-backend`)

- **`src/services/ielts_service.py`** (new) — mirrors `sat_service.py`:
  - `POST {IELTS_API_BASE_URL}/students/batch-scores-by-date` with `X-API-Key` from
    env var **`IELTS_API_KEY`** (server-side only, never shipped to the browser).
  - Emails chunked at 500 per call (API limit). Dates sent as ISO `YYYY-MM-DD` so the
    year is never inferred wrong for historical weeks.
  - `404` = "no weekly set covers that date" → legitimate empty answer; other errors
    are logged and treated as no data.
  - Responses cached in Redis for 30 min (`ielts:batch-scores:{date}:{hash(emails)}`),
    per the IELTS platform's request to avoid frequent polling. Failures are never
    cached.
- **`src/gamification/routes/leaderboard.py`**, `get_weekly_lessons_with_hw_status`
  (the endpoint the page calls):
  - Group is IELTS when `program_type == "ielts"` or the group name contains "ielts"
    (same heuristic as the SAT branch and the frontend).
  - Candidate dates: configured `curator_hour_date` first, then each day of the viewed
    week (descending). Responses with an already-seen `weeklySetId` are skipped; the
    loop stops early once every student email is resolved.
  - Students with all-null bands are skipped so a later date can still fill them.
  - Adds per-student fields: `ielts_{listening,reading,writing,speaking,overall}_band`,
    `ielts_{listening,reading,writing}_test_name`, `ielts_writing_feedback`
    (`{task1, task2}`), `ielts_speaking_feedback` (`{fluencyCoherence, lexicalResource,
    grammaticalRange, pronunciation, overall}`), `ielts_weekly_set_title`.
  - `mock_exam` for IELTS groups = converted overall band when present, else the
    manual entry (same precedence as SAT).
- **`docker-compose.yml` / `.env.example`** — `IELTS_API_KEY` added.

## Frontend (`lms-front`)

`src/pages/CuratorLeaderboardPage.tsx`:
- `StudentRow` extended with the `ielts_*` fields.
- `isIeltsGroup` via the existing `getGroupProgramType`.
- Header/body: three-way branch — SAT columns / single `IELTS` column / «Пробный
  экзамен». The IELTS cell shows the overall band (`7.5` format), `—` when sections
  exist but overall is pending, «Не сдано» when nothing exists. Cells with any data
  are clickable.
- New IELTS modal: emerald-badged header with the weekly set title, a band strip
  (L/R/W/S + Overall), Writing feedback (Task 1/Task 2) and Speaking feedback
  (labeled criteria), rendered as plain text with `whitespace-pre-wrap`.
- Totals need no frontend change: the backend already folds the converted band into
  `mock_exam`, which `calculateTotal` sums.

## Error handling

- IELTS API down / wrong key → backend logs, returns rows without `ielts_*` data;
  the page renders «Не сдано» and the manual mock-exam entry still counts.
- No weekly set for the viewed week (404) → same as above, cached so the API is not
  re-polled on every page load.

## Deployment

1. Add `IELTS_API_KEY=<key>` to `lms-backend/.env` on the production host.
2. `docker-compose up -d --build backend` (compose now passes the var through).
3. Frontend deploys from `master` via Azure Static Web Apps as usual.
