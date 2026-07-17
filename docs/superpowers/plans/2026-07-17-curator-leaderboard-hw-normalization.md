# Curator Leaderboard HW Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize every homework to a 10-point weight in leaderboard totals and replace the ambiguous «-» HW cell with explicit «Не задано» / «Не выполнено» statuses.

**Architecture:** One additive backend change (include `max_score` in lesson homework metadata of the weekly-lessons endpoint) plus frontend-only changes in `CuratorLeaderboardPage.tsx`: three-state HW cell rendering and normalized contributions in `calculateTotal` / `calculatePercent`.

**Tech Stack:** FastAPI + SQLAlchemy (backend, pytest), React + TypeScript (frontend, no test runner — verify with `npx tsc --noEmit`).

## Global Constraints

- Live backend route file is `src/gamification/routes/leaderboard.py`; `src/routes/leaderboard.py` is DEAD — do not touch it.
- Commits: no `Co-Authored-By` trailer; commit directly to the current branch (`master` on frontend).
- Backend repo: `/Users/bebdyshev/Documents/Github/master/lms/backend`; frontend repo: `/Users/bebdyshev/Documents/Github/master/lms/frontend`.
- Status strings shown to curators are exactly «Не задано» and «Не выполнено».
- HW weight constant is 10 points per assigned homework.

---

### Task 1: Backend — expose `max_score` in lesson homework metadata

**Files:**
- Modify: `src/gamification/routes/leaderboard.py:777-781` (lessons_meta homework dict)
- Test: `tests/test_leaderboard_hw_meta.py` (new)

**Interfaces:**
- Produces: weekly-lessons endpoint response `lessons[].homework` now `{"id": int, "title": str, "max_score": int}`. Frontend Task 2 consumes `max_score`.

- [ ] **Step 1: Write the failing test**

Create `tests/test_leaderboard_hw_meta.py` (fixture pattern copied from `tests/test_group_week_offset.py`):

```python
"""
The weekly-lessons leaderboard endpoint must include each assignment's
max_score in lessons[].homework so the frontend can normalize HW scores
and show a denominator for unsubmitted homework.

Savepoint-isolated (the endpoint commits nothing here); skips without Postgres.
"""
import asyncio
from datetime import datetime, timedelta

import pytest

from src.schemas.models import Group, GroupStudent, UserInDB, Event, EventGroup
from src.assignments.models import Assignment
from src.gamification.routes.leaderboard import router as leaderboard_router


def _weekly_lessons_endpoint():
    for r in leaderboard_router.routes:
        if getattr(r, "path", None) == "/curator/weekly-lessons/{group_id}":
            return r.endpoint
    raise RuntimeError("weekly-lessons route not found")


@pytest.fixture
def db():
    from sqlalchemy import event
    from sqlalchemy.exc import OperationalError
    from sqlalchemy.orm import Session as SASession
    from src.config import engine

    try:
        connection = engine.connect()
    except OperationalError:
        pytest.skip("No database available (requires Postgres); skipping")

    trans = connection.begin()
    session = SASession(bind=connection)
    session.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def _restart_savepoint(sess, transaction):
        if transaction.nested and not transaction._parent.nested:
            sess.begin_nested()

    try:
        yield session
    finally:
        event.remove(session, "after_transaction_end", _restart_savepoint)
        session.close()
        trans.rollback()
        connection.close()


def _user(db, email, role):
    u = UserInDB(email=email, name=email.split("@")[0], hashed_password="x",
                 role=role, is_active=True)
    db.add(u)
    db.flush()
    return u


def _maybe_run(result):
    return asyncio.run(result) if asyncio.iscoroutine(result) else result


def test_lessons_meta_includes_hw_max_score(db):
    admin = _user(db, "hwmeta_admin@test.local", "admin")
    teacher = _user(db, "hwmeta_teacher@test.local", "teacher")
    group = Group(name="GE HW Meta", program_type="general_english",
                  teacher_id=teacher.id)
    db.add(group)
    db.flush()

    student = _user(db, "hwmeta_student@test.local", "student")
    db.add(GroupStudent(group_id=group.id, student_id=student.id))
    db.flush()

    # One class event in week 1 (2026-06-01 is a Monday).
    start = datetime(2026, 6, 1, 10, 0, 0)
    ev = Event(title="c1", event_type="class", start_datetime=start,
               end_datetime=start + timedelta(hours=1), created_by=teacher.id,
               is_active=True, is_recurring=False)
    db.add(ev)
    db.flush()
    db.add(EventGroup(event_id=ev.id, group_id=group.id))

    # Assignment tied to lesson 1 with a non-default max score.
    a = Assignment(title="HW1", group_id=group.id, lesson_number=1,
                   max_score=30, is_active=True, created_by=teacher.id)
    db.add(a)
    db.flush()

    res = _maybe_run(_weekly_lessons_endpoint()(
        group.id, week_number=1, current_user=admin, db=db))

    hw = res["lessons"][0]["homework"]
    assert hw is not None
    assert hw["max_score"] == 30
```

Note: if `Assignment` requires other non-null fields (check `src/assignments/models.py` when running), add them minimally.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/bebdyshev/Documents/Github/master/lms/backend && python -m pytest tests/test_leaderboard_hw_meta.py -v`
Expected: FAIL with `KeyError: 'max_score'`

- [ ] **Step 3: Write minimal implementation**

In `src/gamification/routes/leaderboard.py`, in the lessons_meta loop (~line 777), change:

```python
            "homework": {
                "id": hw.id,
                "title": hw.title
            } if hw else None
```

to:

```python
            "homework": {
                "id": hw.id,
                "title": hw.title,
                "max_score": hw.max_score
            } if hw else None
```

- [ ] **Step 4: Run test to verify it passes**

Run: `python -m pytest tests/test_leaderboard_hw_meta.py -v`
Expected: PASS

- [ ] **Step 5: Commit (backend repo)**

```bash
git add src/gamification/routes/leaderboard.py tests/test_leaderboard_hw_meta.py
git commit -m "feat(leaderboard): include assignment max_score in weekly lessons meta"
```

---

### Task 2: Frontend — three-state HW cell («Не задано» / «Не выполнено» / score+%)

**Files:**
- Modify: `src/pages/CuratorLeaderboardPage.tsx:28-37` (LessonMeta type), `:1354-1381` (HW cell)

**Interfaces:**
- Consumes: `lessons[].homework.max_score` from Task 1.
- Produces: nothing new for other tasks; Task 3 uses the same `max_score` fields.

- [ ] **Step 1: Extend `LessonMeta` type**

```tsx
interface LessonMeta {
    lesson_number: number;
    event_id: number;
    title: string;
    start_datetime: string;
    homework?: {
        id: number;
        title: string;
        max_score?: number | null;
    };
}
```

- [ ] **Step 2: Replace the HW cell rendering**

In the lesson-cell map (currently lines ~1354-1381), replace the inner HW `<div>` with:

```tsx
                                        <div className="w-1/2 bg-gray-50 dark:bg-secondary flex items-center justify-center p-0">
                                            {(() => {
                                                const hwMax = hwStatus?.max_score ?? lessonInfo.homework?.max_score ?? null;
                                                return (
                                            <div
                                                className={cn(
                                                    "w-full text-center text-[11px] h-full flex items-center justify-center",
                                                    hwStatus?.submitted ? "text-green-700 dark:text-green-400 font-bold" : "text-gray-400",
                                                    hwStatus?.submitted && "cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                                                )}
                                                onClick={() => {
                                                    if (!hwStatus?.submitted) return
                                                    setHwModal({
                                                        open: true,
                                                        studentName: student.student_name,
                                                        lessonTitle: lessonInfo.title || `Lesson ${lessonInfo.lesson_number}`,
                                                        score: hwStatus.score,
                                                        maxScore: hwStatus.max_score ?? lessonInfo.homework?.max_score ?? undefined,
                                                        feedback: hwStatus.feedback ?? null,
                                                        submittedAt: hwStatus.submitted_at ?? null,
                                                        gradedAt: hwStatus.graded_at ?? null,
                                                    })
                                                }}
                                                title={hwStatus?.submitted ? 'Нажмите, чтобы увидеть фидбэк' : (lessonInfo.homework?.title || undefined)}
                                            >
                                                {hwStatus?.submitted ? (
                                                    hwStatus.score !== null ? (
                                                        <span className="flex flex-col items-center leading-none">
                                                            <span>{hwStatus.score}{hwMax ? `/${hwMax}` : ''}</span>
                                                            {hwMax && hwMax > 0 ? (
                                                                <span className="text-[10px] font-normal text-gray-400 mt-0.5">
                                                                    {Math.round((hwStatus.score / hwMax) * 100)}%
                                                                </span>
                                                            ) : null}
                                                        </span>
                                                    ) : 'Сдано'
                                                ) : lessonInfo.homework ? (
                                                    <span className="text-rose-500 dark:text-rose-400 font-medium leading-tight">Не<br/>выполнено</span>
                                                ) : (
                                                    <span className="text-gray-300 dark:text-gray-600 italic leading-tight">Не<br/>задано</span>
                                                )}
                                            </div>
                                                );
                                            })()}
                                        </div>
```

Notes: the old `(hwStatus?.score != null)` orange branch is unreachable (score only comes from submissions) and is dropped; unsubmitted cells are no longer clickable, same as before.

- [ ] **Step 3: Type-check**

Run: `cd /Users/bebdyshev/Documents/Github/master/lms/frontend && npx tsc --noEmit`
Expected: no NEW errors vs. `git stash && npx tsc --noEmit` baseline (project may have pre-existing errors; compare).

- [ ] **Step 4: Commit (frontend repo)**

```bash
git add src/pages/CuratorLeaderboardPage.tsx
git commit -m "feat(leaderboard): show Не задано/Не выполнено HW statuses and score percent"
```

---

### Task 3: Frontend — normalize HW to 10 points in «Итого» and «%»

**Files:**
- Modify: `src/pages/CuratorLeaderboardPage.tsx:136-144` (MAX_SCORES), `:588-613` (calculateTotal), `:615-652` (calculatePercent)

**Interfaces:**
- Consumes: `homework_status.max_score` (submission) and `lessons[].homework.max_score` (Task 1 meta).
- Produces: `calculateTotal` now returns a number rounded to 1 decimal.

- [ ] **Step 1: Add HW weight constant**

In `MAX_SCORES` add:

```tsx
const MAX_SCORES = {
    attendance: 10,
    homework: 10, // each assigned HW is normalized to this weight
    curator_hour: 20,
    mock_exam: 100,
    study_buddy: 15, // 0 (no) or 15 (yes)
    self_reflection_journal: 14,
    weekly_evaluation: 10,
    extra_points: 0,
};
```

- [ ] **Step 2: Rewrite `calculateTotal` with normalized HW contributions**

```tsx
  // Normalized HW contribution: score/max × 10 so a 30-point HW weighs the
  // same as a 10-point one. Max comes from the submission, falling back to
  // the assignment meta; a missing/zero max contributes nothing.
  const hwContribution = (lessonKey: string, hw: StudentLessonStatus['homework_status']) => {
    if (!hw || hw.score === null || hw.score === undefined) return 0;
    const metaMax = data?.lessons.find(l => l.lesson_number.toString() === lessonKey)?.homework?.max_score;
    const max = hw.max_score ?? metaMax ?? 0;
    if (max <= 0) return 0;
    return (hw.score / max) * MAX_SCORES.homework;
  };

  const calculateTotal = (student: StudentRow) => {
    if (!data) return 0;

    // Sum HW and Attendance from dynamic lessons
    let lessonsTotal = 0;
    Object.entries(student.lessons).forEach(([lessonKey, lesson]) => {
        // Attendance
        if (lesson.attendance_status === 'attended') {
            lessonsTotal += MAX_SCORES.attendance;
        }
        // Homework — normalized to MAX_SCORES.homework
        lessonsTotal += hwContribution(lessonKey, lesson.homework_status);
    });

    // Manual Columns
    const curatorHour = enabledCols.curator_hour ? student.curator_hour : 0;
    const mockExam = student.mock_exam; // Always enabled logic-wise
    const studyBuddy = enabledCols.study_buddy ? student.study_buddy : 0;
    const journal = enabledCols.self_reflection_journal ? student.self_reflection_journal : 0;
    const weeklyEval = enabledCols.weekly_evaluation ? student.weekly_evaluation : 0;
    const extraPoints = enabledCols.extra_points ? student.extra_points : 0;

    const total = lessonsTotal + curatorHour + mockExam + studyBuddy + journal + weeklyEval + extraPoints;
    return Math.round(total * 10) / 10;
  };
```

- [ ] **Step 3: Fix `calculatePercent` denominator**

Replace the maxLessons block (drop the stale "assume 15" comments):

```tsx
      // Each assigned HW is worth MAX_SCORES.homework in the denominator;
      // unsubmitted HW stays in the denominator (it was assigned).
      let maxLessons = 0;
      data.lessons.forEach(meta => {
          maxLessons += MAX_SCORES.attendance; // 10
          if (meta.homework) {
              maxLessons += MAX_SCORES.homework; // 10, normalized
          }
      });
```

Rest of `calculatePercent` (manual columns, cancelled-lesson exclusion) unchanged.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit (frontend repo)**

```bash
git add src/pages/CuratorLeaderboardPage.tsx
git commit -m "feat(leaderboard): normalize each HW to 10 pts in totals and percent"
```

---

### Task 4: End-to-end sanity check

- [ ] **Step 1: Backend test suite for the touched module**

Run: `cd /Users/bebdyshev/Documents/Github/master/lms/backend && python -m pytest tests/test_leaderboard_hw_meta.py tests/test_group_week_offset.py -v`
Expected: PASS (or SKIP without Postgres).

- [ ] **Step 2: Frontend build**

Run: `cd /Users/bebdyshev/Documents/Github/master/lms/frontend && npm run build`
Expected: build succeeds.

- [ ] **Step 3: Commit plan checkboxes / any fixups**

```bash
git add -A docs/superpowers
git commit -m "docs: curator leaderboard HW normalization plan"
```
