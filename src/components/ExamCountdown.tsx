import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, Pencil, GraduationCap } from "lucide-react";
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
    <span className="flex h-[2.9rem] sm:h-[4.5rem] items-center text-xl sm:text-4xl font-bold text-white/35">:</span>
  );
}

/**
 * Countdown to a student's exam date (SAT/IELTS) for the dashboard hero.
 * When the student is in both SAT and IELTS groups, a toggle switches between them.
 * "Set/Change date" opens a popup with exam-specific info and saves the planned
 * test date via PATCH /assignment-zero/planned-date — the same field curators
 * read in /assignment-zero/curator/upcoming to follow up on results on time.
 */
export default function ExamCountdown({ tileColor }: { tileColor?: string }) {
  const navigate = useNavigate();
  const [data, setData] = useState<ExamCountdownData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ExamKind | null>(null);
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

  const active: ExamKind =
    selected && data.available_exams.includes(selected)
      ? selected
      : data.default_exam ?? data.available_exams[0];
  const info = data.exams[active];
  const examLabel = EXAM_LABEL[active];
  const officialDates = data.sat_official_dates ?? [];

  // Live countdown to local midnight of the exam date, ticking every second.
  const targetMs = info?.target_date
    ? new Date(`${info.target_date.slice(0, 10)}T00:00:00`).getTime()
    : null;
  const diff = targetMs != null ? targetMs - now : null;
  const hasCountdown = diff != null && diff > 0;
  const dd = hasCountdown ? Math.floor(diff! / 86_400_000) : 0;
  const hh = hasCountdown ? Math.floor((diff! / 3_600_000) % 24) : 0;
  const mm = hasCountdown ? Math.floor((diff! / 60_000) % 60) : 0;
  const ss = hasCountdown ? Math.floor((diff! / 1_000) % 60) : 0;

  const openModal = () => {
    setError("");
    setNeedsAssignmentZero(false);
    setDateValue(info?.target_date ? info.target_date.slice(0, 10) : "");
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

  return (
    <>
      <div className="w-full sm:w-auto text-center" style={tileColor ? ({ "--fc-tile": tileColor } as CSSProperties) : undefined}>
        {data.available_exams.length > 1 && (
          <div className="mx-auto mb-3 inline-flex rounded-lg bg-black/20 p-0.5 text-[11px] font-semibold">
            {data.available_exams.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setSelected(k)}
                className={`rounded-md px-4 py-1 transition-colors ${
                  active === k ? "bg-sky-500 text-white shadow-sm" : "text-white/55 hover:text-white"
                }`}
              >
                {EXAM_LABEL[k]}
              </button>
            ))}
          </div>
        )}

        {hasCountdown ? (
          <>
            <div className="flex items-start justify-center gap-1.5 sm:gap-2">
              <TimeGroup value={dd} label="days" />
              <UnitSeparator />
              <TimeGroup value={hh} label="hrs" />
              <UnitSeparator />
              <TimeGroup value={mm} label="min" />
              <UnitSeparator />
              <TimeGroup value={ss} label="sec" />
            </div>
            <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.13em] text-white/55">
              until {examLabel} · {formatDate(info!.target_date!)}
            </div>
            <button
              type="button"
              onClick={openModal}
              className="mt-1 inline-flex items-center gap-1 text-[11px] text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline"
            >
              <Pencil className="h-3 w-3" /> Change date
            </button>
          </>
        ) : targetMs != null ? (
          <>
            <div className="text-2xl font-extrabold text-white">Exam day! 🎓</div>
            <div className="mt-1 text-xs text-white/70">{examLabel} · {formatDate(info!.target_date!)}</div>
            <button
              type="button"
              onClick={openModal}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-sky-300 underline-offset-2 hover:text-sky-200 hover:underline"
            >
              <Pencil className="h-3 w-3" /> Change date
            </button>
          </>
        ) : (
          <>
            <CalendarClock className="mx-auto h-6 w-6 text-sky-300" />
            <div className="mt-1.5 text-sm font-medium leading-snug text-white">
              Set your {examLabel} exam date
            </div>
            <div className="mt-0.5 text-[11px] text-white/60">Add it to see your countdown</div>
            <Button
              size="sm"
              className="mt-2 h-7 bg-sky-500 px-3 text-xs text-white hover:bg-sky-400"
              onClick={openModal}
            >
              Set date
            </Button>
          </>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-blue-600" />
              Your {examLabel} test date
            </DialogTitle>
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
