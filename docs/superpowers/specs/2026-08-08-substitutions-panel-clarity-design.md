# Substitutions panel — clarity redesign

**Date:** 2026-08-08
**Status:** approved

## Problem

The Substitutions tab (`SubstitutionAttendancePanel.tsx`) is a flat list of cards
showing only the event title, group name, date and online/offline. It never says
**who is being substituted for** — the substitute (current user) can't tell whose
class this is or who they're covering. The list also mixes past (needs marking),
future (locked), and already-marked lessons with no structure. Cards lead with an
auto-generated title (e.g. "Шадеева - IELTS July 6 2026: Lesson 3") whose name
prefix differs from the real group name ("Said- IELTS July 6 2026"), adding
confusion.

## Data model

A substitution is an `Event` whose `teacher_id` differs from its first group's
`teacher_id` (`Event.is_substitution`). So for the current user's substitutions
(`teacher_id == current_user`), the **original teacher = the group's regular
teacher** (`first_group.teacher`).

## Solution

### Backend — `events/routes/events.py` + `events/schemas.py`

Add to `SubstitutionLessonSchema` and populate in `get_my_substitutions`:
- `original_teacher_name: Optional[str]` — `first_group.teacher.name` (who you cover for)
- `marked: bool` — whether any attendance record exists for the event (distinguishes
  "needs marking" from "done")

Load `EventGroup.group.teacher` via joinedload; batch one query for
`attendances.event_id IN (...)` to build the marked set. Both fields are additive.

### Frontend — `SubstitutionAttendancePanel.tsx` + `types`

Add `original_teacher_name?: string | null` and `marked?: boolean` to
`SubstitutionLesson`.

**Card** (English, to match the existing teacher-facing panel):
- Primary line: **group name** + lesson suffix parsed from the title (text after the
  last ":"), so it leads with whose class it is — plus a **"Substitution"** badge.
- Second line: **"Covering for {original_teacher_name}"**, date/time, online/offline.
- Right action by state: past & unmarked → **"Mark attendance"**; future →
  **"🔒 Upcoming"** (locked, non-clickable, existing); past & marked → **"✓ Marked"**.

**List organization — by status**, sections in this order (hide empty sections):
1. **"Needs marking"** — past, `marked === false` (actionable; the point of the tab)
2. **"Upcoming"** — future / locked
3. **"Marked"** — past, `marked === true` (muted)

Within each section, sort by date descending (as today). Clicking a card still
opens the roster dialog for markable lessons.

## Out of scope

- Substitution reason / date range (not stored per event here).
- Partial-marking nuance: `marked` = "at least one attendance row exists", not
  "all students recorded" (good enough to separate touched from untouched).

## Tests

Backend: `get_my_substitutions` returns `original_teacher_name` = the group's
regular teacher and `marked` reflecting whether an attendance row exists.
