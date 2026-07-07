# Design: audio homework (student records a voice submission)

**Date:** 2026-07-07
**Repos:** `lms/backend` (small) + `lms/frontend` (recording UI — the bulk).
**Status:** design (autonomous — user delegated decisions). Backend is safe/testable and will
deploy; the browser recording UX needs a hands-on test before it is announced to students.

## Problem

Add a homework type where the student **records a voice message** on the platform (in English
UI): from the assignment, a "Record audio" action opens a dedicated recording page where they
can record as many times as they want, listen to the result, and submit it. The teacher then
listens to the audio and grades the homework.

## What already exists (reused, not rebuilt)

- `Assignment.assignment_type` (string) + existing types incl. `file_upload`; `Assignment.file_url`,
  `allowed_file_types`, `max_file_size_mb`.
- `AssignmentSubmission.file_url` + `submitted_file_name` — a submission already stores a file.
- `storage_service.save(key, bytes, content_type) -> "/uploads/<key>"` (S3 in prod).
- `POST .../upload-screenshot` (student file upload → storage → returns `{url, filename}`) — the
  exact pattern to mirror for audio.
- `submit_assignment` accepts `file_url` on the submission; full grading (score, feedback,
  is_graded, graded_by, graded_at) already exists.

So audio homework is a **specialization of `file_upload`**: `assignment_type="audio"`, the
submission's `file_url` is the recorded audio in storage, graded by the teacher (never
auto-graded).

## Backend (small, additive, testable)

1. **Accept `"audio"` as an assignment type.** In `assignments/services.py`:
   `validate_answer_format("audio", ...)` returns True (audio has no structured answers — the
   submission is the file); `validate_assignment_content` accepts `"audio"` (content may be a
   prompt string). Add `"audio": ["question"]` (or minimal) to the content-fields map used by
   the assignment-detail endpoint. Audio is **never auto-graded** (teacher-graded only) — ensure
   the submit path does not run auto-grade for `"audio"`.
2. **`POST /assignments/upload-audio`** (student-only, mirrors `upload-screenshot`): accepts an
   `UploadFile`, enforces a size cap (`max_file_size_mb`, default 15MB for audio), validates the
   content-type against an audio allow-list (`audio/webm`, `audio/ogg`, `audio/mp4`,
   `audio/mpeg`, `audio/mp3`, `audio/wav`, `audio/x-m4a`), saves via
   `storage_service.save(f"assignment_audio/{user_id}_{uuid}{ext}", bytes, content_type)`, returns
   `{url, filename}`. The student then calls the existing `submit_assignment` with that `file_url`
   (and `submitted_file_name`).
3. **Tests:** upload-audio rejects non-audio + oversize, accepts audio and returns a url; the
   `"audio"` type validates with empty answers and is not auto-graded.

No new tables, no migration.

## Frontend (`lms/frontend`)

1. **Assignment creation (teacher):** add "Audio" to the assignment-type selector so a teacher can
   create an audio assignment (title, prompt/description, max_score, due date).
2. **Student — record page** (dedicated route, e.g. `/homework/:assignmentId/record`, English UI):
   - Uses `MediaRecorder` (getUserMedia audio). Buttons: **Record** → **Stop**; after stopping,
     an inline `<audio controls>` plays the recorded blob; **Re-record** discards and starts over
     (unlimited attempts); **Submit** uploads the final blob to `POST /assignments/upload-audio`
     then calls `submit_assignment` with the returned `file_url`.
   - Handle mic-permission denial and unsupported-browser with a clear English message. Show
     recording time; disable Submit until a recording exists; disable during upload.
   - The assignment view gets a **"Record audio / Submit audio"** action that routes here for
     `assignment_type === "audio"`.
3. **Teacher — grading:** in the submission/grading view, when the submission `file_url` is audio
   (or the assignment is `"audio"`), render `<audio controls src={fileUrl}>` so the teacher plays
   it, alongside the existing score + feedback inputs. No grading-logic change.

## Safety / rollout

- Additive and **opt-in**: the recording page and audio type only matter once a teacher creates an
  audio assignment; existing homework is unaffected.
- The backend deploys normally (tested). The recording UX depends on browser `MediaRecorder`,
  which cannot be verified headlessly — the frontend is build/type-checked, then **the user
  should record+submit one test assignment in a browser before announcing it**. Recommend
  verifying Chrome + Safari (Safari records `audio/mp4`, Chrome `audio/webm` — the allow-list
  covers both).

## Out of scope

- Native Expo mobile recording (this targets the web platform / "отдельная страница").
- Audio transcription / auto-grading.
