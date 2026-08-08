import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import apiClient from "../services/api";
import type { ExamCountdown as ExamCountdownData, ExamKind } from "../services/api/assignment-zero";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import "./ExamCountdown.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";

const EXAM_LABEL: Record<ExamKind, string> = { sat: "SAT", ielts: "IELTS" };

function formatDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

const DIGIT_RE = /^[0-9]$/;

/** One step from `from` toward `to` along the shortest direction (with wrap),
    returning the next digit and how many steps remain (including this one). */
function stepToward(from: string, to: string): { next: string; remaining: number } {
  const f = from.charCodeAt(0) - 48;
  const t = to.charCodeAt(0) - 48;
  const up = (t - f + 10) % 10;
  const down = (f - t + 10) % 10;
  if (up <= down) return { next: String((f + 1) % 10), remaining: up };
  return { next: String((f + 9) % 10), remaining: down };
}

/** One split-flap flip-clock digit tile. When its target changes it rolls
    through the in-between digits (fast for a big jump, slow for a single step)
    and leaves unchanged digits untouched. */
function FlipDigit({ char }: { char: string }) {
  const [shown, setShown] = useState(char);
  const [flip, setFlip] = useState<{ from: string; to: string; half: number; id: number } | null>(null);
  const idRef = useRef(0);

  useEffect(() => {
    if (!DIGIT_RE.test(shown) || !DIGIT_RE.test(char)) {
      if (shown !== char) setShown(char);
      setFlip(null);
      return;
    }
    if (shown === char) {
      setFlip(null);
      return;
    }
    const { next, remaining } = stepToward(shown, char);
    const totalMs = remaining > 1 ? 150 : 440; // fast mid-roll, slower final settle
    idRef.current += 1;
    setFlip({ from: shown, to: next, half: totalMs / 2, id: idRef.current });
    const t = setTimeout(() => setShown(next), totalMs);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, char]);

  const topDigit = flip ? flip.to : shown;
  const bottomDigit = flip ? flip.from : shown;

  return (
    <span className="fc" style={flip ? ({ "--fc-half": `${flip.half}ms` } as CSSProperties) : undefined}>
      {/* static: top shows the incoming digit; bottom shows the outgoing one */}
      <span className="fc__half fc__top">
        <span className="fc__inner">{topDigit}</span>
      </span>
      <span className="fc__half fc__bottom">
        <span className="fc__inner">{bottomDigit}</span>
      </span>
      {flip && [
        <span key={`t${flip.id}`} className="fc__half fc__top fc__flip-top">
          <span className="fc__inner">{flip.from}</span>
        </span>,
        <span key={`b${flip.id}`} className="fc__half fc__bottom fc__flip-bottom">
          <span className="fc__inner">{flip.to}</span>
        </span>,
      ]}
    </span>
  );
}

/** A labelled unit of the countdown (e.g. two tiles + "hrs"). */
function TimeGroup({ value, label, minDigits = 2 }: { value: number; label: string; minDigits?: number }) {
  const chars = String(Math.max(0, value)).padStart(minDigits, "0").split("");
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex gap-1">
        {chars.map((c, i) => (
          <FlipDigit key={i} char={c} />
        ))}
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/55">{label}</span>
    </div>
  );
}

/** Colon separator between countdown units (aligned with the tile row). */
function UnitSeparator() {
  return (
    <span className="flex h-[4.75rem] sm:h-[4.5rem] items-center text-4xl font-bold text-white/35">:</span>
  );
}

/**
 * Countdown to a student's exam date(s) for the dashboard hero.
 *
 * A student on both tracks sees BOTH countdowns side by side. This used to be a toggle
 * showing one at a time, which meant a SAT+IELTS student could only ever see one of
 * their two deadlines and had to know to click for the other - the one they were not
 * looking at is exactly the one they were liable to forget.
 *
 * "Set/Change date" saves the planned test date via PATCH /assignment-zero/planned-date,
 * the same field curators read to follow up on results on time.
 */
export default function ExamCountdown({ tileColor }: { tileColor?: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState<ExamCountdownData | null>(null);
  const [loading, setLoading] = useState(true);
  // Which exam's date dialog is open, if any. Replaces the old single "active" exam:
  // every available exam is rendered, so editing has to name its target.
  const [editing, setEditing] = useState<ExamKind | null>(null);
  const [open, setOpen] = useState(false);
  const [dateValue, setDateValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [needsAssignmentZero, setNeedsAssignmentZero] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const load = async () => {
    try {
      const res = await apiClient.getExamCountdown();
      setData(res);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading || !data || !data.applicable || data.available_exams.length === 0) return null;

  const officialDates = data.sat_official_dates ?? [];
  // The exam the dialog is editing. Falls back to the first available one so the
  // dialog always has a subject even if state is momentarily out of step.
  const active: ExamKind = editing ?? data.default_exam ?? data.available_exams[0];
  const examLabel = EXAM_LABEL[active];

  const openModal = (kind: ExamKind) => {
    setEditing(kind);
    setError("");
    setNeedsAssignmentZero(false);
    const target = data.exams[kind]?.target_date;
    setDateValue(target ? target.slice(0, 10) : "");
    setOpen(true);
  };

  const saveDate = async () => {
    if (!dateValue) {
      setError("Please choose a date.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      await apiClient.updateAssignmentZeroPlannedDate({
        exam_type: active,
        planned_test_date: dateValue,
      });
      setOpen(false);
      await load();
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      if (status === 404) {
        setNeedsAssignmentZero(true);
      } else {
        setError("Could not save. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  // The nearest upcoming exam gets the full flip clock; the other tracks sit under it
  // as compact lines. Two full clocks side by side swamped the hero - they squeezed the
  // greeting to one word per line and gave equal weight to a deadline months away.
  const withDays = (kind: ExamKind) => {
    const target = data.exams[kind]?.target_date;
    if (!target) return Number.POSITIVE_INFINITY;
    return new Date(`${target.slice(0, 10)}T00:00:00`).getTime() - now;
  };
  const ordered = [...data.available_exams].sort((a, b) => {
    const da = withDays(a);
    const db = withDays(b);
    // Exams already past sort after upcoming ones, undated last of all.
    const rank = (v: number) => (v === Number.POSITIVE_INFINITY ? 2 : v < 0 ? 1 : 0);
    return rank(da) - rank(db) || da - db;
  });
  const [primary, ...secondary] = ordered;

  return (
    <>
      <div className="flex w-full flex-col items-center gap-2 sm:w-auto">
        <ExamPanel
          kind={primary}
          info={data.exams[primary]}
          now={now}
          tileColor={tileColor}
          onEdit={() => openModal(primary)}
        />

        {secondary.length > 0 && (
          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-white/15 pt-2 text-[11px]">
            {secondary.map((kind) => (
              <SecondaryExam
                key={kind}
                kind={kind}
                info={data.exams[kind]}
                now={now}
                onEdit={() => openModal(kind)}
              />
            ))}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your {examLabel} test date</DialogTitle>
            <DialogDescription>
              {active === "sat"
                ? "The SAT is held on fixed official test dates. Pick the date you're registered for."
                : "IELTS is offered on many dates each month. Enter the date you're registered to take your test."}
            </DialogDescription>
          </DialogHeader>

          {needsAssignmentZero ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Please complete Assignment Zero first — that's where your exam details are set up.
              </p>
              <Button
                className="w-full"
                onClick={() => {
                  setOpen(false);
                  navigate("/assignment-zero");
                }}
              >
                Go to Assignment Zero
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {active === "sat" && officialDates.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">Official SAT dates</p>
                  <div className="flex flex-wrap gap-2">
                    {officialDates.map((d) => {
                      const iso = d.slice(0, 10);
                      const isSelected = dateValue === iso;
                      return (
                        <button
                          key={iso}
                          type="button"
                          onClick={() => setDateValue(iso)}
                          className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                            isSelected
                              ? "border-blue-600 bg-blue-600 text-white"
                              : "border-border hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950"
                          }`}
                        >
                          {formatDate(iso)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {active === "sat" && officialDates.length > 0 ? "Or enter another date" : "Test date"}
                </label>
                <Input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} />
              </div>

              <p className="text-[11px] text-muted-foreground">
                Your curator uses this date to check in and ask about your results on time.
              </p>

              {error ? <p className="text-sm text-destructive">{error}</p> : null}

              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={saveDate} disabled={saving || !dateValue}>
                  {saving ? "Saving…" : "Save date"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}


/**
 * One track's countdown. Extracted so several can render at once - a student on both
 * SAT and IELTS needs to see both deadlines, not one behind a toggle.
 */
function ExamPanel({
  kind,
  info,
  now,
  tileColor,
  onEdit,
  className,
}: {
  kind: ExamKind;
  info?: { target_date: string | null; days_left: number | null; source: string | null; can_edit: boolean };
  now: number;
  tileColor?: string;
  onEdit: () => void;
  className?: string;
}) {
  const examLabel = EXAM_LABEL[kind];
  const targetMs = info?.target_date
    ? new Date(`${info.target_date.slice(0, 10)}T00:00:00`).getTime()
    : null;
  const diff = targetMs != null ? targetMs - now : null;
  const hasCountdown = diff != null && diff > 0;
  const dd = hasCountdown ? Math.floor(diff! / 86_400_000) : 0;
  const hh = hasCountdown ? Math.floor((diff! / 3_600_000) % 24) : 0;
  const mm = hasCountdown ? Math.floor((diff! / 60_000) % 60) : 0;
  const ss = hasCountdown ? Math.floor((diff! / 1_000) % 60) : 0;

  return (
    <div
      className={`w-full text-center sm:w-auto ${className ?? ""}`}
      style={tileColor ? ({ "--fc-tile": tileColor } as CSSProperties) : undefined}
    >
      <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-white/70">
        {examLabel}
      </div>

      {hasCountdown ? (
        <>
          <div className="flex items-start justify-center gap-1.5 sm:gap-2">
            <TimeGroup value={dd} label="days" />
            <UnitSeparator />
            <TimeGroup value={hh} label="hrs" />
            {/* minutes & seconds only from sm up; phones show days : hrs */}
            <div className="hidden items-start gap-1.5 sm:flex sm:gap-2">
              <UnitSeparator />
              <TimeGroup value={mm} label="min" />
              <UnitSeparator />
              <TimeGroup value={ss} label="sec" />
            </div>
          </div>
          <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-white/55">
            {formatDate(info!.target_date!)}
          </div>
          <button
            type="button"
            onClick={onEdit}
            className="mt-1 inline-flex items-center gap-1 text-[11px] text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline"
          >
            Change date
          </button>
        </>
      ) : targetMs != null ? (
        <>
          <div className="text-2xl font-extrabold text-white">Exam day! 🎓</div>
          <div className="mt-1 text-xs text-white/70">{formatDate(info!.target_date!)}</div>
          <button
            type="button"
            onClick={onEdit}
            className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline"
          >
            Change date
          </button>
        </>
      ) : (
        <>
          <div className="text-sm font-medium leading-snug text-white">
            Set your {examLabel} exam date
          </div>
          <div className="mt-0.5 text-[11px] text-white/60">Add it to see your countdown</div>
          <Button
            size="sm"
            className="mt-2 h-7 bg-sky-500 px-3 text-xs text-white hover:bg-sky-400"
            onClick={onEdit}
          >
            Set date
          </Button>
        </>
      )}
    </div>
  );
}


/**
 * A non-primary track, rendered as one compact line: "IELTS · 30 days · Sep 9, 2026".
 *
 * A student on two tracks needs to see both deadlines, but they are not equally urgent.
 * Giving the further-off exam its own flip clock doubled the width of the hero and left
 * the greeting wrapping one word per line, so the secondary track states the same facts
 * in a single row.
 */
function SecondaryExam({
  kind,
  info,
  now,
  onEdit,
}: {
  kind: ExamKind;
  info?: { target_date: string | null };
  now: number;
  onEdit: () => void;
}) {
  const label = EXAM_LABEL[kind];
  const target = info?.target_date
    ? new Date(`${info.target_date.slice(0, 10)}T00:00:00`).getTime()
    : null;
  const days = target != null ? Math.floor((target - now) / 86_400_000) : null;

  return (
    <span className="inline-flex items-center gap-1.5 text-white/70">
      <span className="font-semibold uppercase tracking-[0.12em] text-white/80">{label}</span>
      {days != null && days > 0 ? (
        <>
          <span aria-hidden="true">·</span>
          <span className="font-semibold text-white">{days}</span>
          <span>{days === 1 ? "day" : "days"}</span>
          <span aria-hidden="true">·</span>
          <span>{formatDate(info!.target_date!)}</span>
        </>
      ) : days != null && days <= 0 ? (
        <>
          <span aria-hidden="true">·</span>
          <span className="font-semibold text-white">Exam day 🎓</span>
        </>
      ) : (
        <>
          <span aria-hidden="true">·</span>
          <span>no date set</span>
        </>
      )}
      <button
        type="button"
        onClick={onEdit}
        className="ml-0.5 text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline"
      >
        {days != null ? "Change" : "Set date"}
      </button>
    </span>
  );
}
