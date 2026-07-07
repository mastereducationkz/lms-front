# Reusable AudioPlayer — Implementation Report

**Date:** 2026-07-07
**Scope:** `lms/frontend` only.

## Problem

1. In the grading dialog (dashboard's `GradeDialog`/`ViewDialog` and the homework page's `AssignmentGradingPage`) an audio submission only showed a **Download** link — no inline listening.
2. On the student record page (`AssignmentRecordPage`), the default `<audio controls>` element showed a bogus duration (`0:01`) for MediaRecorder-produced `.webm` blobs, even though playback worked fine. This is a well-known Chromium/webm quirk: MediaRecorder blobs have no duration in their container metadata, so `audio.duration` reports `Infinity`/`NaN` until the browser is forced to scan the stream.

## Files created

- **`src/components/AudioPlayer.tsx`** (new) — reusable `<AudioPlayer src className />` component plus `export function isAudioUrl(url?: string | null): boolean` helper (true for `.webm|.ogg|.mp3|.m4a|.wav|.aac|.oga|.opus`, case-insensitive, querystring/hash stripped).

## Files changed

- `src/components/curator-homeworks/GradeDialog.tsx` — the `submissionDetails.file_url` card: added an `<AudioPlayer>` above the existing file card when `isAudioUrl(file_url || submitted_file_name)`; kept the Download link. Resolves the URL the same way the existing download link already did (`file_url.startsWith('http') ? file_url : backendUrl + file_url`), now hoisted into `resolvedFileUrl` and reused by both the player and the (unchanged) download `<a>`.
- `src/components/curator-homeworks/ViewDialog.tsx` — same treatment in two spots: (1) the multi-task `file_task` answer render (adds an `<AudioPlayer>` above the existing green file-download row when the task answer's file is audio), and (2) the top-level submission `file_url` card (same pattern as GradeDialog). Download links unchanged in both spots.
- `src/pages/assingments/AssignmentGradingPage.tsx` — replaced the raw `<audio controls src={resolveFileUrl(...)}>` in the audio-submission branch with `<AudioPlayer src={resolveFileUrl(...)}>` (using the file's existing `resolveFileUrl`/`isAudioSubmission` helpers, unchanged).
- `src/pages/assingments/AssignmentPage.tsx` — replaced the student's submitted-audio raw `<audio controls src={resolveFileUrl(submission.file_url)}>` with `<AudioPlayer src={resolveFileUrl(submission.file_url)}>`.
- `src/pages/assingments/AssignmentRecordPage.tsx` — replaced the recorded-preview raw `<audio controls src={recordedUrl}>` (the exact spot that produced the `0:01`-duration bug from a live MediaRecorder blob URL) with `<AudioPlayer src={recordedUrl}>`. No changes to the record/stop/re-record/submit state machine or the object-URL/ref cleanup logic in this file — only the preview element itself was swapped.

## Duration-fix approach (in `AudioPlayer.tsx`)

On the `<audio>` element's `loadedmetadata` event:
- If `audio.duration` is already a finite, non-NaN number, use it directly.
- Otherwise (the MediaRecorder-webm case): set `audio.currentTime = 1e101`. This forces the browser's media pipeline to seek to the end of the stream, which as a side effect computes the real duration. A one-shot `timeupdate` listener then fires; it resets `audio.currentTime = 0` (so playback starts from the beginning, not mid/end-of-file), reads the now-correct `audio.duration` into state, and removes itself.
- Until a real duration is resolved, the time label shows `--:--` and the seek `<input type="range">` is `disabled` (so it isn't misleadingly draggable against an unknown/zero max). Once `duration` resolves, the range's `max` becomes the real duration and it becomes interactive.

Other behavior: `timeupdate` updates the current-time state and the progress-bar fill (`linear-gradient` background); `ended` resets to a paused/start state; all listeners are added/removed in a `useEffect` keyed on `src` so switching `src` re-initializes cleanly, and everything is torn down on unmount. Works identically for remote HTTP(S) URLs (S3/backend-served) and local `blob:` object URLs (the student's live recording preview).

Styling: Tailwind, matches app conventions — pill play/pause button using `bg-primary`/`text-primary-foreground` (same tokens as the `Button` component), a native range input styled via `accent-primary` plus an inline gradient fill using the same `hsl(var(--primary))` / `hsl(var(--muted))` CSS variables the rest of the app's theme uses, and a `tabular-nums text-muted-foreground` time label. Compact single-row layout (`flex items-center gap-3`) inside a bordered card (`border-border`, `bg-white dark:bg-card`) consistent with the existing file-attachment cards it sits next to.

## `npm run build` result (tail)

```
dist/assets/index-Df4zqJvN.css                          246.29 kB │ gzip:  40.07 kB
dist/assets/index-CxEZs07i.js                         3,360.71 kB │ gzip: 914.60 kB
✓ built in 21.02s
...
✓ built in 334ms
PWA v1.2.0
mode      injectManifest
precache  15 entries (3525.35 KiB)
files generated
  dist/sw.js
```
Build succeeded, no errors. (Large-chunk-size warning is pre-existing and unrelated.)

## `npx tsc --noEmit` result

222 pre-existing errors both **before** (verified via `git stash`) and **after** my changes — identical count. Zero new errors introduced by this change.

The only errors inside a file I touched are in `AssignmentGradingPage.tsx` (lines 73/76): `extensionStudentId` typed `number | null` vs. a `string` from `submission.user_id`. These are the same pre-existing errors documented in the earlier `audio-frontend-report.md` (there at lines 72/75); the line numbers shifted by exactly 1 because I added one new `import` line above them. I did not touch that code path.

All other pre-existing errors are in unrelated files (a mostly-dead `src/pages/student/*`/`src/pages/teacher/*` tree with broken relative imports, plus a handful of `noUnusedLocals`/`is_active`-property issues elsewhere) — untouched by this task.

## Commit

`feat(homework): reusable AudioPlayer with webm-duration fix; inline playback in grading dialogs`

Not pushed (per instructions).

## In-browser test checklist

1. **Dashboard grading dialog (`GradeDialog`)**: open a curator/teacher dashboard, find a student with an audio-homework submission, open "Grade" — confirm the custom player (play/pause pill, seek bar, `m:ss / m:ss` label) appears above the Download row and plays audio inline; confirm seeking works by dragging the bar; confirm the Download link still works.
2. **Homework page grading dialog / `ViewDialog`**: same check from the homework page's student-progress "View" dialog — both the top-level submission file spot and, if applicable, a multi-task `file_task` answer that happens to be audio.
3. **`AssignmentGradingPage` (`/homework/:id/grade`)**: open an audio assignment's grading page, click "Grade" on a submission — confirm the player replaces the old raw `<audio controls>`, plays correctly, and Score/Feedback + Save Grade still work unchanged.
4. **Student submitted-audio view (`AssignmentPage`)**: as a student who already submitted an audio assignment, view "My Submission" — confirm the player shows correct duration (not `0:01`) and plays back correctly.
5. **Record page preview (`AssignmentRecordPage`) — the original bug**: as a student, record a new audio answer, stop recording — confirm the preview player immediately shows the **correct** duration (not `0:01`/`Infinity`), that the seek bar is draggable once duration resolves, and that Re-record/Submit still work as before.
6. **Cross-browser**: repeat the record-page check in both Chrome (webm/opus) and Safari (mp4/m4a) since MediaRecorder codec support differs — confirm duration resolves correctly in both.
