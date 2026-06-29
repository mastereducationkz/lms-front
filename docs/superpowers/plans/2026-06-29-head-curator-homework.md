# Head-Curator Homework view + searchable group picker — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the head curator a read-only, teacher-style Homework page (searchable group cards → per-group homework table with due date / lesson / points / submission progress) and make the leaderboard group picker searchable.

**Architecture:** Reuse the existing teacher Homework page (`AssignmentsPage.tsx`) for the `head_curator` role by splitting the single `isTeacherView` flag into `isManagerView` (layout) and `canEdit` (write actions). Route `/curator/homeworks` to that page for head curators. Fix the one backend endpoint that 403s for head curators. Swap the leaderboard's plain `<Select>` for a Popover + filter combobox.

**Tech Stack:** React + TypeScript + Vite (lms/frontend), FastAPI + SQLAlchemy + pytest (lms/backend). Two separate git repos: `lms/frontend` and `lms/backend`.

## Global Constraints

- Two separate git repos: frontend changes commit in `lms/frontend`, backend changes commit in `lms/backend`. Run git/build commands from the matching repo root.
- Commit messages: **no `Co-Authored-By` trailer.** Direct-to-`master` commits are acceptable.
- Roles in this system: `student`, `teacher`, `head_teacher`, `curator`, `head_curator`, `admin`.
- Frontend has no unit-test harness; the verification gate for frontend tasks is `npx tsc --noEmit` (zero new errors) plus the manual QA checklist in each task.
- Head-curator homework page is **read-only**: no Create / Edit / Archive / Copy. Grading stays with teachers/curators.
- Group names already embed the teacher (e.g. "Azamat - June 19 SAT"); do NOT add a separate teacher column/join.

---

### Task 1: Backend — allow head curator to read assignment student-progress

**Files:**
- Modify: `lms/backend/src/assignments/routes/assignments.py` (function `get_assignment_student_progress`, starts line 1694; access block lines 1708–1746)
- Test: `lms/backend/tests/test_head_curator_progress_access.py` (create)

**Interfaces:**
- Consumes: existing `GET /assignments/{assignment_id}/student-progress` endpoint (this is the mounted router — `src.assignments.routes.assignments_router`; the copy in `src/routes/assignments.py` is legacy and NOT mounted — do not edit it).
- Produces: head curator receives `200` with the progress payload instead of `403`. No signature change.

Context — the current access block grants `has_access` only for admin/teacher/curator, so a head curator (allowed past the role check at line 1700) falls through to `403 Access denied to this assignment`:

```python
    has_access = False

    # Check course access if assignment is linked to lesson
    if assignment.lesson_id:
        lesson = db.query(Lesson).filter(Lesson.id == assignment.lesson_id).first()
        if lesson:
            module = db.query(Module).filter(Module.id == lesson.module_id).first()
            if module:
                 # Teacher/Admin course access check
                if current_user.role in ["teacher", "admin"]:
                    ...
```

- [ ] **Step 1: Write the failing test**

Create `lms/backend/tests/test_head_curator_progress_access.py`:

```python
"""Head curators may read assignment student-progress (read-only monitoring)."""
import inspect

from src.assignments.routes import assignments as assignments_routes


def test_head_curator_granted_access_in_student_progress_source():
    """The access-control block of get_assignment_student_progress must grant
    head_curator access (like admin). Guards against a regression where the
    role passes the initial check but is never granted has_access -> 403."""
    src = inspect.getsource(assignments_routes.get_assignment_student_progress)
    # The role gate already lists head_curator; ensure access is actually granted.
    assert "head_curator" in src
    # An explicit early grant for head_curator/admin must exist before the
    # `raise HTTPException(... Access denied to this assignment ...)` line.
    grant_idx = src.find('current_user.role in ["admin", "head_curator"]')
    deny_idx = src.find("Access denied to this assignment")
    assert grant_idx != -1, "head_curator is not granted has_access"
    assert grant_idx < deny_idx, "grant must precede the access-denied raise"
```

- [ ] **Step 2: Run test to verify it fails**

Run from `lms/backend`:
```bash
python -m pytest tests/test_head_curator_progress_access.py -v
```
Expected: FAIL on `assert grant_idx != -1` (no head_curator grant yet).

Note: if collection fails with a `ModuleNotFoundError: email_validator` (known venv gap, see project memory), install it first: `python -m pip install email-validator`. If pip is unavailable in the venv, fall back to verifying the change by reading the diff and running the manual curl check in Step 4.

- [ ] **Step 3: Add the head_curator grant**

In `get_assignment_student_progress`, immediately after `has_access = False` (line 1708) and before the `if assignment.lesson_id:` block, insert an explicit early grant:

```python
    has_access = False

    # Head curators have read-only oversight over all groups' homework.
    if current_user.role in ["admin", "head_curator"]:
        has_access = True

    # Check course access if assignment is linked to lesson
    if assignment.lesson_id:
```

(Leaving the later `current_user.role == "admin"` branches in place is harmless — `has_access` is already `True`.)

- [ ] **Step 4: Run test to verify it passes**

Run from `lms/backend`:
```bash
python -m pytest tests/test_head_curator_progress_access.py -v
```
Expected: PASS.

Manual fallback (if pytest can't collect): start the backend, log in as a head curator, and confirm:
```bash
curl -s -H "Authorization: Bearer <HEAD_CURATOR_TOKEN>" \
  http://localhost:8000/assignments/<ANY_ASSIGNMENT_ID>/student-progress | head
```
Expected: a JSON body with `summary`/`student_progress`, not `{"detail":"Access denied to this assignment"}`.

- [ ] **Step 5: Commit**

Run from `lms/backend`:
```bash
git add src/assignments/routes/assignments.py tests/test_head_curator_progress_access.py
git commit -m "feat(assignments): allow head curator to read student-progress"
```

---

### Task 2: Frontend — make AssignmentsPage support the head_curator manager view (read-only)

**Files:**
- Modify: `lms/frontend/src/pages/assingments/AssignmentsPage.tsx`

**Interfaces:**
- Consumes: existing `apiClient.getGroups()`, `apiClient.getAssignments(params)`, `apiClient.getAssignmentStudentProgress(id)`, `apiClient.getPendingSubmissions()` — all already permit `head_curator` after Task 1.
- Produces: when `user.role === 'head_curator'`, the page renders the manager layout (group cards + search + per-group table + submission stats) with **no** write actions. Consumed by Task 3 (routing).

- [ ] **Step 1: Replace the single view flag with two flags**

At line 91, replace:

```typescript
  const isTeacherView = user?.role === 'teacher' || user?.role === 'admin';
```

with:

```typescript
  // Manager layout (group cards, per-group table, submission stats) is shared by
  // teachers, admins, and head curators. Head curators are read-only.
  const isManagerView = user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'head_curator';
  // Write actions (create/edit/archive/copy) are teacher/admin only.
  const canEdit = user?.role === 'teacher' || user?.role === 'admin';
```

- [ ] **Step 2: Point every layout/effect usage at `isManagerView`**

Replace `isTeacherView` with `isManagerView` at these locations (layout + effects + table columns + overview cards): lines 138, 144, 148, 175, 179, 204, 581, 732, 739, 793, 816, 859. The simplest correct edit is a global rename of `isTeacherView` → `isManagerView` in this file, then re-introduce `canEdit` only at the action sites in Steps 3–4. (After the rename there should be zero remaining `isTeacherView` identifiers.)

- [ ] **Step 3: Gate the row write-actions with `canEdit`, keep View for managers**

Replace the actions block at lines 653–690:

```jsx
            {isManagerView ? (
              <>
                <Button onClick={() => navigate(`/homework/${assignment.id}/progress`)} variant="ghost" size="icon" title="View Progress" className="h-8 w-8 text-slate-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400">
                                      <Eye className="w-4 h-4" />
                                    </Button>
                <Button onClick={() => navigate(`/homework/new?copyFrom=${assignment.id}`)} variant="ghost" size="icon" title="Copy Assignment" className="h-8 w-8 text-slate-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400">
                                      <Copy className="w-4 h-4" />
                                    </Button>
                <Button onClick={() => navigate(`/homework/${assignment.id}/edit`)} variant="ghost" size="icon" title="Edit Assignment" className="h-8 w-8 text-slate-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400">
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      onClick={async () => {
                                        try {
                                          await apiClient.toggleAssignmentVisibility(String(assignment.id));
                                          loadAssignments();
                                        } catch (err) {
                                          console.error('Failed to toggle visibility:', err);
                                        }
                                      }}
                                      variant="ghost"
                                      size="icon"
                                      title={assignment.is_hidden ? "Restore" : "Archive"}
                                      className={`h-8 w-8 ${assignment.is_hidden ? "text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-400" : "text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-400"}`}
                                    >
                                      {assignment.is_hidden ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                                    </Button>
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => navigate(`/homework/${assignment.id}`)}
                                    variant="ghost"
                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-bold uppercase tracking-widest text-[10px]"
                                  >
                                    {assignment.status === 'graded' || assignment.status === 'submitted' ? 'View' : 'Submit'}
                                  </Button>
                                )}
```

with (View always shown for managers; the three write actions only when `canEdit`):

```jsx
            {isManagerView ? (
              <>
                <Button onClick={() => navigate(`/homework/${assignment.id}/progress`)} variant="ghost" size="icon" title="View Progress" className="h-8 w-8 text-slate-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400">
                                      <Eye className="w-4 h-4" />
                                    </Button>
                {canEdit && (
                  <>
                    <Button onClick={() => navigate(`/homework/new?copyFrom=${assignment.id}`)} variant="ghost" size="icon" title="Copy Assignment" className="h-8 w-8 text-slate-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400">
                                      <Copy className="w-4 h-4" />
                                    </Button>
                    <Button onClick={() => navigate(`/homework/${assignment.id}/edit`)} variant="ghost" size="icon" title="Edit Assignment" className="h-8 w-8 text-slate-400 dark:text-gray-500 hover:text-blue-600 dark:hover:text-blue-400">
                                      <Edit className="w-4 h-4" />
                                    </Button>
                                    <Button
                                      onClick={async () => {
                                        try {
                                          await apiClient.toggleAssignmentVisibility(String(assignment.id));
                                          loadAssignments();
                                        } catch (err) {
                                          console.error('Failed to toggle visibility:', err);
                                        }
                                      }}
                                      variant="ghost"
                                      size="icon"
                                      title={assignment.is_hidden ? "Restore" : "Archive"}
                                      className={`h-8 w-8 ${assignment.is_hidden ? "text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-400" : "text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-400"}`}
                                    >
                                      {assignment.is_hidden ? <ArchiveRestore className="w-4 h-4" /> : <Archive className="w-4 h-4" />}
                                    </Button>
                  </>
                )}
                                  </>
                                ) : (
                                  <Button
                                    size="sm"
                                    onClick={() => navigate(`/homework/${assignment.id}`)}
                                    variant="ghost"
                                    className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 font-bold uppercase tracking-widest text-[10px]"
                                  >
                                    {assignment.status === 'graded' || assignment.status === 'submitted' ? 'View' : 'Submit'}
                                  </Button>
                                )}
```

- [ ] **Step 4: Gate the "Create Homework" button with `canEdit`**

At lines 703–707, replace:

```jsx
        {isManagerView ? (
          <Button onClick={() => navigate('/homework/new')} variant="default" size="sm">
            Create Homework
          </Button>
        ) : null}
```

with:

```jsx
        {canEdit ? (
          <Button onClick={() => navigate('/homework/new')} variant="default" size="sm">
            Create Homework
          </Button>
        ) : null}
```

- [ ] **Step 5: Load groups for head curators**

In `loadGroups` (line 207), add `head_curator` to the role check:

```typescript
  const loadGroups = async () => {
    if (
      user?.role === 'teacher' ||
      user?.role === 'admin' ||
      user?.role === 'curator' ||
      user?.role === 'head_curator'
    ) {
      try {
        const groupsData = await apiClient.getGroups();
        // Keep full list so teachers can toggle completed groups; filter only in UI
        setGroups(groupsData || []);
      } catch (err) {
        console.warn('Failed to load groups:', err);
      }
    }
  };
```

- [ ] **Step 6: Load assignments for head curators**

In `loadAssignments`, update the param block at lines 224–238 so head curators get the manager limits (and `include_hidden` so the archived toggle works, matching teacher/admin):

```typescript
      const params: Record<string, unknown> = {}
      if (user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'head_curator') {
        params.include_hidden = true
      }
      const numericGroupId =
        /^\d+$/.test(selectedGroupId) ? parseInt(selectedGroupId, 10) : null
      if (
        numericGroupId !== null &&
        (user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'curator' || user?.role === 'head_curator')
      ) {
        params.group_id = numericGroupId
        params.limit = 500
      } else if (user?.role === 'teacher' || user?.role === 'curator' || user?.role === 'admin' || user?.role === 'head_curator') {
        params.limit = 1000
      }
      const assignmentData = await apiClient.getAssignments(params)
```

- [ ] **Step 7: Include head curators in the homework group scope**

In `groupsInHomeworkScope` (lines 326–335), give head curators the same "respect the completed-groups toggle" behaviour as teacher/admin so completed cohorts are hidden by default and toggleable:

```typescript
  const groupsInHomeworkScope = useMemo(() => {
    if (user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'head_curator') {
      const scoped = showCompletedGroups ? groups : filterNonCompletedGroups(groups);
      return sortGroupsByLessonTime(scoped);
    }
    if (user?.role === 'curator') {
      return sortGroupsByLessonTime(groups);
    }
    return sortGroupsByLessonTime(groups);
  }, [groups, showCompletedGroups, user?.role]);
```

- [ ] **Step 8: Typecheck**

Run from `lms/frontend`:
```bash
npx tsc --noEmit
```
Expected: no new errors in `AssignmentsPage.tsx` (in particular, no "Cannot find name 'isTeacherView'").

- [ ] **Step 9: Commit**

Run from `lms/frontend`:
```bash
git add src/pages/assingments/AssignmentsPage.tsx
git commit -m "feat(homework): support read-only head curator manager view"
```

---

### Task 3: Frontend — route head curator's Homework section to AssignmentsPage

**Files:**
- Modify: `lms/frontend/src/routes/Router.tsx` (`/curator/homeworks` at lines 466–472; `/homework/:id/progress` at lines 181–187)

**Interfaces:**
- Consumes: `AssignmentsPage` (now head-curator aware from Task 2), `CuratorHomeworksPage` (unchanged), `useAuth`.
- Produces: head curators landing on `/curator/homeworks` (the existing sidebar "Домашние задания" link) see the teacher-style page; their 👁 View Progress link works.

- [ ] **Step 1: Add a role-aware wrapper component**

`AssignmentsPage` is already imported at `Router.tsx:16`. **Do NOT call `useAuth()` inside `Router()`** — in this file `AuthProvider` is rendered *inside* the `Router()` component (it wraps `<Routes>`), so the router body is outside the auth context and `useAuth()` would throw. Instead, define a tiny wrapper component that runs inside the route element (and therefore inside `AuthProvider`).

Add the `useAuth` import at the top with the other imports:
```typescript
import { useAuth } from '../contexts/AuthContext';
```

Then, immediately **before** `export default function Router() {` (line 64), add:
```tsx
function CuratorHomeworksRoute() {
  const { user } = useAuth();
  return user?.role === 'head_curator' ? <AssignmentsPage /> : <CuratorHomeworksPage />;
}
```

- [ ] **Step 2: Render the wrapper on /curator/homeworks**

Replace lines 466–472:

```jsx
          <Route path="/curator/homeworks" element={
            <ProtectedRoute allowedRoles={['curator', 'admin', 'head_curator']}>
              <AppLayout>
                <CuratorHomeworksPage />
              </AppLayout>
            </ProtectedRoute>
          } />
```

with:

```jsx
          <Route path="/curator/homeworks" element={
            <ProtectedRoute allowedRoles={['curator', 'admin', 'head_curator']}>
              <AppLayout>
                <CuratorHomeworksRoute />
              </AppLayout>
            </ProtectedRoute>
          } />
```

- [ ] **Step 3: Allow head curators to open the View Progress page**

Replace lines 181–187:

```jsx
          <Route path="/homework/:id/progress" element={
            <ProtectedRoute allowedRoles={['student', 'teacher', 'admin']}>
              <AppLayout>
                <AssignmentStudentProgressPage />
              </AppLayout>
            </ProtectedRoute>
          } />
```

with:

```jsx
          <Route path="/homework/:id/progress" element={
            <ProtectedRoute allowedRoles={['student', 'teacher', 'admin', 'head_curator']}>
              <AppLayout>
                <AssignmentStudentProgressPage />
              </AppLayout>
            </ProtectedRoute>
          } />
```

- [ ] **Step 4: Typecheck**

Run from `lms/frontend`:
```bash
npx tsc --noEmit
```
Expected: no new errors in `Router.tsx`.

- [ ] **Step 5: Manual QA**

Log in as a head curator:
- Sidebar → "Домашние задания" opens the teacher-style page: group cards with "Search groups…" box, assignment counts.
- Typing in "Search groups…" filters the cards.
- Click a card → per-group table with Homework / Due Date / Lesson / Points / Submissions and the "5/9 · N graded" bars; "Back to groups" returns.
- No "Create Homework", Edit, Copy, or Archive controls anywhere; the 👁 opens the progress page without a 403.
- Log in as a (non-head) curator → `/curator/homeworks` still shows the original `CuratorHomeworksPage` unchanged.

- [ ] **Step 6: Commit**

Run from `lms/frontend`:
```bash
git add src/routes/Router.tsx
git commit -m "feat(routing): head curator homework uses teacher-style page + progress access"
```

---

### Task 4: Frontend — searchable group combobox on the leaderboard page

**Files:**
- Modify: `lms/frontend/src/pages/CuratorLeaderboardPage.tsx` (imports at top; group `<Select>` at lines 809–845)

**Interfaces:**
- Consumes: existing `filteredGroups: Group[]`, `selectedGroupId`, `setSelectedGroupId`, `setCurrentWeek`, `calculateCurrentWeekNumber`, and the `Popover`/`Input` UI primitives.
- Produces: a searchable group picker with identical selection behaviour (sets `selectedGroupId`, recalculates `currentWeek`). No data-flow changes.

There is no `command` primitive in `components/ui`; build the combobox from `Popover` + `Input` + a filtered button list.

- [ ] **Step 1: Add Popover + state imports**

At the top of `CuratorLeaderboardPage.tsx`, add the Popover import (next to the other `../components/ui` imports) and the `Check`/`ChevronsUpDown` icons (extend the existing `lucide-react` import at line 11):

```typescript
import { Popover, PopoverContent, PopoverTrigger } from '../components/ui/popover';
```

Change line 11 from:
```typescript
import { ChevronLeft, ChevronRight, Loader2, Save, Eye, EyeOff } from 'lucide-react';
```
to:
```typescript
import { ChevronLeft, ChevronRight, Loader2, Save, Eye, EyeOff, Check, ChevronsUpDown } from 'lucide-react';
```

- [ ] **Step 2: Add local search state**

Inside the component, next to the other `useState` hooks (near line 309 where `selectedGroupId` is declared), add:

```typescript
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [groupQuery, setGroupQuery] = useState('');
```

- [ ] **Step 3: Replace the group `<Select>` with a combobox**

Replace the group selector block at lines 809–845 (the `<div className="w-[240px]"> ... </div>` containing the group `<Select>`) with:

```jsx
                <div className="w-[240px]">
                    <Popover open={groupPickerOpen} onOpenChange={(open) => { setGroupPickerOpen(open); if (!open) setGroupQuery(''); }}>
                        <PopoverTrigger asChild>
                            <button
                                type="button"
                                className="flex h-8 w-full items-center justify-between rounded-md border border-gray-300 dark:border-border bg-transparent px-3 text-xs"
                            >
                                <span className="truncate">
                                    {filteredGroups.find((g) => g.id === selectedGroupId)?.name || 'Выберите группу'}
                                </span>
                                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[240px] p-0" align="start">
                            <div className="p-2 border-b border-gray-200 dark:border-border">
                                <Input
                                    autoFocus
                                    value={groupQuery}
                                    onChange={(e) => setGroupQuery(e.target.value)}
                                    placeholder="Поиск группы..."
                                    className="h-8 text-xs"
                                />
                            </div>
                            <div className="max-h-72 overflow-y-auto py-1">
                                {(() => {
                                    const q = groupQuery.trim().toLowerCase();
                                    const matches = q
                                        ? filteredGroups.filter((g) => g.name.toLowerCase().includes(q))
                                        : filteredGroups;
                                    if (matches.length === 0) {
                                        return (
                                            <div className="px-3 py-2 text-xs text-muted-foreground">
                                                Ничего не найдено
                                            </div>
                                        );
                                    }
                                    return matches.map((g) => (
                                        <button
                                            key={g.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedGroupId(g.id);
                                                setCurrentWeek(
                                                    g.current_week ?? calculateCurrentWeekNumber(g.created_at)
                                                );
                                                setGroupPickerOpen(false);
                                                setGroupQuery('');
                                            }}
                                            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-gray-100 dark:hover:bg-secondary"
                                        >
                                            <Check className={cn('h-3.5 w-3.5 shrink-0', selectedGroupId === g.id ? 'opacity-100' : 'opacity-0')} />
                                            <span className="truncate">{g.name}</span>
                                            {g.is_over && (
                                                <span className="ml-auto text-[10px] text-muted-foreground">(завершена)</span>
                                            )}
                                        </button>
                                    ));
                                })()}
                            </div>
                        </PopoverContent>
                    </Popover>
                </div>
```

- [ ] **Step 4: Typecheck**

Run from `lms/frontend`:
```bash
npx tsc --noEmit
```
Expected: no new errors in `CuratorLeaderboardPage.tsx`.

- [ ] **Step 5: Manual QA**

On the leaderboard/journal page (`/curator/leaderboard`):
- The group control shows the current group name; clicking opens a popover with a search box.
- Typing "Madina" filters to matching groups instantly; clicking one selects it, the table reloads for that group, and the week resets correctly.
- The subject filter ("Все предметы") and "Скрыть завершённые" checkbox still work and still constrain the list (`filteredGroups`).
- Empty search shows the full filtered list; a no-match query shows "Ничего не найдено".

- [ ] **Step 6: Commit**

Run from `lms/frontend`:
```bash
git add src/pages/CuratorLeaderboardPage.tsx
git commit -m "feat(leaderboard): searchable group combobox"
```

---

## Self-Review notes

- **Spec coverage:** Backend access fix → Task 1. Head-curator read-only teacher-style homework (cards/search/table/stats, no writes) → Tasks 2 + 3. View Progress route access → Task 3. Searchable leaderboard group picker → Task 4. Curator (non-head) page unchanged → Task 3 Step 2 (conditional render) + Step 5 QA. No teacher join (group name carries teacher) → respected (no such task).
- **Type consistency:** `isManagerView` / `canEdit` introduced in Task 2 Step 1 and used consistently; after the rename there are no `isTeacherView` references left. `groupPickerOpen` / `groupQuery` defined and used only in Task 4. `Group.name`, `Group.is_over`, `Group.current_week`, `Group.created_at` are existing fields used by the current `<Select>` block being replaced.
- **Mounted-file check:** Task 1 edits `src/assignments/routes/assignments.py` (mounted), not the legacy `src/routes/assignments.py`.
