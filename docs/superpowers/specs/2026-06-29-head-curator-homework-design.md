# Head-Curator Homework view + searchable group picker

Date: 2026-06-29
Status: Approved design (pending spec review)

## Problem

1. In the **head-curator** account the "Домашние задания" (`/curator/homeworks`)
   section is effectively useless for monitoring teachers. The head curator wants
   to see **which teachers assign homework**, for **what date**, for **what
   lesson** — across all groups.
2. The group picker on the leaderboard/journal page
   (`CuratorLeaderboardPage`) is a long plain `<Select>`. Scrolling it to find a
   specific group/teacher is painful.

The user explicitly asked for the head-curator homework view to look and behave
**like the teacher's Homework page** (`AssignmentsPage`): searchable group cards
→ drill into a group → table with Homework / Due Date / Lesson / Points /
Submissions. Group names already embed the teacher name (e.g.
"Azamat - June 19 SAT"), so "which teacher" reads directly off each card/row.

## Decisions (confirmed with user)

- Head-curator homework page is **read-only**: view all groups, homework, due
  dates, lessons, and submission progress; open a submission via the 👁 (View
  Progress) action. **No** Create / Edit / Archive / Copy. Grading stays with
  teachers/curators.
- **Yes**, also convert the `CuratorLeaderboardPage` group dropdown into a
  searchable combobox in this change.

## Approach

Reuse the existing teacher Homework page (`AssignmentsPage.tsx`) for the head
curator rather than building a new page. The backend already serves a head
curator all the data it needs; the work is mostly wiring + gating + one backend
access fix.

### Backend (lms/backend)

Already works for `head_curator`:
- `GET /admin/groups` (`getGroups`) returns **all groups with teacher names**.
- `GET /assignments` (`getAssignments`) returns **all assignments globally**
  (no role filter matches `head_curator`, so it is unfiltered); `group_id`
  filter works with no access block for `head_curator`.

One gap to fix:
- `GET /assignments/{assignment_id}/student-progress`
  (`get_assignment_student_progress`, `src/assignments/routes/assignments.py`)
  allows the `head_curator` role past the initial role check but the
  `has_access` logic never grants access to `head_curator`, so it returns 403.
  **Fix:** treat `head_curator` like `admin` (grant `has_access = True`) in that
  endpoint's access-control block. This unblocks the submission-progress stats
  (the "5/9, 3 graded" bars) and the View Progress page.

No new endpoints, no schema/migration changes.

### Frontend (lms/frontend)

**`pages/assingments/AssignmentsPage.tsx`**
- Introduce two flags instead of the single `isTeacherView`:
  - `isManagerView = role ∈ {teacher, admin, head_curator}` — controls the
    manager **layout**: group overview cards, "Search groups…", group drill-in
    + "Back to groups", the Due Date / Lesson / Points / Submissions table,
    submission-stat loading, and the "need grading" counters.
  - `canEdit = role ∈ {teacher, admin}` — controls **write actions**:
    "Create Homework", Edit, Copy, Archive/Restore.
  - Replace existing `isTeacherView` usages with `isManagerView` for layout, and
    gate the four write actions + "Create Homework" with `canEdit`.
- The 👁 View Progress action (`/homework/{id}/progress`) stays available to all
  manager views (including head curator).
- `loadGroups`: include `head_curator` so groups load (calls `getGroups()` →
  `/admin/groups`, which returns all groups for head curator).
- `loadAssignments`: include `head_curator` in the param logic — `limit: 1000`
  for the overview, and `group_id` + `limit: 500` when a group is selected
  (same as teacher/curator branch).
- `groupsInHomeworkScope`: head curator uses the same all-groups path as curator
  (respect the existing "show completed groups" toggle the same way as
  teacher/admin, so completed cohorts are hidden by default and toggleable).

**`routes/Router.tsx`**
- `/curator/homeworks`: render `AssignmentsPage` for `head_curator`, keep
  `CuratorHomeworksPage` for `curator`. (Curator's existing page is unchanged.)
- `/homework/:id/progress`: add `head_curator` to `allowedRoles` so the head
  curator's View Progress action works.

**`pages/CuratorLeaderboardPage.tsx`**
- Replace the plain group `<Select>` (the ~240px dropdown) with a searchable
  combobox: a popover containing a text input that filters `filteredGroups` by
  name (case-insensitive), preserving current behaviour (selecting a group sets
  `selectedGroupId` and resets `currentWeek`). Keep the subject filter and the
  "Скрыть завершённые" checkbox beside it. Reuse an existing combobox/command
  primitive if one is present under `components/ui`; otherwise a minimal
  popover + filtered list.

## Components / boundaries

- `AssignmentsPage` stays the single source of truth for the teacher-style
  homework UI; head curator is just another role that maps to the manager
  layout with writes disabled. No duplicated UI.
- The leaderboard combobox is a self-contained swap of one control; no change to
  the leaderboard's data flow.

## Data flow (head curator)

1. Page mounts → `loadGroups()` → `/admin/groups` → all groups (+ teacher names).
2. Overview mode → `loadAssignments({ limit: 1000 })` → all assignments;
   grouped into cards by `group_id`; "need grading" counts via
   `getPendingSubmissions()`.
3. Select a group → `loadAssignments({ group_id, limit: 500 })`; per-assignment
   stats via `getAssignmentStudentProgress(id)` (now permitted for head curator).
4. 👁 → `/homework/{id}/progress` (`AssignmentStudentProgressPage`).

## Error handling

- Existing `try/catch` + toast paths in `AssignmentsPage` cover load failures;
  no new surfaces. The backend access fix removes the 403 that would otherwise
  break stat loading for head curator.

## Out of scope

- Any teacher-attribution beyond what group names already convey (no new
  teacher join/column).
- Changes to the curator (non-head) homework page.
- Grading/editing for head curator (read-only by decision).

## Testing

- Manual: log in as head curator → `/curator/homeworks` shows all group cards,
  search filters them, drilling in shows the homework table with due date /
  lesson / points / submission bars; no write buttons present; 👁 opens progress.
- Manual: leaderboard page → group combobox filters as you type and selects
  correctly; subject + "скрыть завершённые" still work.
- Verify curator (non-head) `/curator/homeworks` is unchanged.
- Backend: head curator can call `student-progress` (200, not 403); curator
  access unchanged.
