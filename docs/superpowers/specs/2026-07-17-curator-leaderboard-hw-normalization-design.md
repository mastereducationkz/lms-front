# Curator Leaderboard: HW Normalization + Explicit Statuses

**Date:** 2026-07-17
**Status:** Approved

## Problem

1. Homework assignments have different max scores (10, 30, …). The leaderboard's
   «Итого» sums raw HW scores, so a 30-point HW weighs 3× a 10-point one, and the
   «%» column hardcodes 15 as every HW's max — percentages are wrong.
2. The HW cell shows «-» both when no homework was assigned to the lesson and
   when it was assigned but the student didn't submit. Curators can't tell the
   two apart.

## Design

### Backend — `lms/backend/src/gamification/routes/leaderboard.py`

In the weekly-lessons-with-hw-status endpoint, include the assignment's
`max_score` in lesson metadata:

```json
"homework": { "id": 1, "title": "…", "max_score": 30 }
```

Additive change; no other consumers affected.

### Frontend — `src/pages/CuratorLeaderboardPage.tsx`

**HW cell — three states instead of «-»:**

| Condition | Display |
|---|---|
| `lesson.homework == null` | grey italic «Не задано» |
| assigned, not submitted | red «Не выполнено» |
| submitted, graded | `24/30` with `80%` subtext |
| submitted, not graded | «Сдано» (unchanged) |

**«Итого»** — each HW contributes `score / max_score × 10` (normalized to a
10-point weight, same scale as attendance). `max_score` from the submission,
fallback to assignment meta. If max is 0/null, contribution is 0 (no division
by zero). Total displayed rounded to 1 decimal.

**«%»** — denominator counts 10 points per *assigned* HW (replacing the
hardcoded 15). Unsubmitted HW = 0 in numerator, still in denominator.

### Explicitly out of scope

- Cancelled lessons: only the attendance points (10) are dropped from the
  denominator, as today. HW attached to a cancelled lesson still counts.
- Manual columns, attendance, SAT/IELTS/NUET blocks unchanged.
- Mobile app and student-facing leaderboards unchanged.
