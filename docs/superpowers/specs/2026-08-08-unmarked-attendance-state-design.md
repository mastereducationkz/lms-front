# Unmarked-attendance state in the leaderboard grid

**Date:** 2026-08-08
**Status:** approved

## Problem

In the attendance leaderboard grid, a past lesson with **no attendance record**
renders as **ABSENT** (red), identical to a lesson the teacher deliberately
marked absent. Backend defaults a record-less lesson to `"missed"`
(`gamification/routes/leaderboard.py`, `status = att["status"] if att else "missed"`)
and the web toggle shows `missed` as red "Не был". So curators cannot tell
"student was absent" from "nobody marked this yet" — e.g. a substitution lesson
the substitute hasn't marked. Such unmarked lessons also silently score 0/10 and
drag the student's % down as if the student were absent.

Related prior fix: pre-enrollment lessons (`enrolled` flag) already render blank
and drop out of the %. This spec covers the remaining case: lessons **within**
the enrollment window that are simply unmarked.

## Solution

Distinguish "unmarked" from "absent", and treat unknown attendance as
"no data" rather than "absent" in the percentage (Option A).

### Backend — `gamification/routes/leaderboard.py`

Add `marked: bool` to each per-student lesson entry in
`get_weekly_lessons_with_hw_status`, where `marked = (att is not None)` — i.e. a
real attendance row of **any** status exists (the attendance map is not filtered
by status, so `cancelled` counts as marked). Backward-compatible: older/mobile
clients ignore the field and keep today's behaviour.

### Frontend — `CuratorLeaderboardPage.tsx`

Cell render precedence for the LESSON (attendance) half:

1. **Future** (`isAttendanceLockedLesson(start_datetime)`) → neutral "—", non-editable (existing)
2. **Pre-enrollment** (`enrolled === false`) → blank "—" (existing)
3. **Unmarked** (`marked === false`, past, enrolled) → **NEW**: dashed outline,
   light background, text "Не отмечено" / "Not marked", clickable
4. else → real status toggle (present / late / absent / cancelled)

`cancelled` implies a record → `marked === true` → falls to case 4 (never shown
as unmarked).

**Interaction:** clicking an unmarked cell marks it **Present** (first click);
the cell then renders as a normal marked cell and further clicks cycle as usual.
`MARK ALL` also covers unmarked cells. Any manual edit flips `marked` to `true`
locally so the dashed state clears immediately. Save persists as today.

**Percentage (`calculatePercent`, Option A):** for each **unmarked past**
lesson, subtract `MAX_SCORES.attendance` (10) from the denominator — "no data"
does not count as absent. The lesson's **homework stays** in the denominator
(HW submission is independent of attendance marking). Cancelled and
pre-enrollment subtractions are unchanged. Numerator is unaffected (an unmarked
lesson is not `attended`, so it already contributes 0).

## Out of scope

- The dashboard "Attendance Required" counter (`_missing_attendance_reminders`)
  is unchanged — it should keep surfacing unmarked lessons so they get marked.
- Future lessons still sit in the denominator as today (separate concern).
- Mobile grid (separate server-scored paths; deferred earlier).

## Tests

Backend: `marked` is `false` when no attendance record exists and `true` when a
record exists (including `cancelled`).
