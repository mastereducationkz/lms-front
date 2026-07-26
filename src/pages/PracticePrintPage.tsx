import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import apiClient from '../services/api';
import { renderTextWithLatex } from '../utils/latex';
import { parseGap } from '../utils/gapParser';
import type { Lesson, Step, Question, QuestionOption, QuizData } from '../types';

const BACKEND = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

// A quiz question paired with the running number it gets across the whole unit.
interface NumberedQuestion {
  n: number;
  q: Question;
  quizTitle: string;
}

interface ParsedGap {
  n: number;
  options: string[];
  correct: string;
}

const GAP_TYPES = new Set(['fill_blank', 'text_completion']);

/** Resolve a media path (e.g. "/uploads/..") against the backend host. */
function mediaUrl(path?: string): string {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  return `${BACKEND}${path}`;
}

/** The letter shown for a choice option: explicit SAT letter, else A/B/C… by index. */
function optionLetter(opt: QuestionOption, index: number): string {
  return opt.letter || String.fromCharCode(65 + index);
}

/** A/B/C… by index (for gap options, which are plain strings). */
function idxLetter(index: number): string {
  return String.fromCharCode(65 + index);
}

/**
 * True if the HTML has real content worth showing. Guards against stale
 * passages that were emptied but still hold tags like "<p></p>" / "<p><br></p>",
 * which would otherwise render as an empty styled box.
 */
function hasVisibleContent(html?: string): boolean {
  if (!html) return false;
  if (/<(img|iframe|video|audio|table)\b/i.test(html)) return true;
  const text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&[a-z0-9#]+;/gi, '')
    .trim();
  return text.length > 0;
}

/**
 * Split a gap passage ("…restaurant [[opt1 / opt2 / opt3 / opt4]] considered…") into an HTML
 * string (each gap replaced by a numbered blank) plus the parsed options for
 * every gap, using the question's own separator + `parseGap` convention.
 */
function parseGapPassage(text: string, separator: string) {
  const parts = (text || '').split(/(\[\[.*?\]\])/g);
  const gaps: ParsedGap[] = [];
  let n = 0;
  const html = parts
    .map((part) => {
      const m = part.match(/^\[\[(.*?)\]\]$/);
      if (!m) return renderTextWithLatex(part);
      n += 1;
      const { options, correctOption } = parseGap(m[1], separator);
      gaps.push({ n, options, correct: correctOption });
      return `<span class="gap-blank">(${n})&nbsp;______</span>`;
    })
    .join('');
  return { html, gaps };
}

/** Correct answer(s) for a NON-gap question, for the answer-key section. */
function correctAnswerDisplay(q: Question): string {
  const opts = q.options || [];

  // Any choice-style question (single/multiple choice, or a media_question that
  // carries options): show the correct letter + its text, e.g. "D) 14".
  if (opts.length > 0) {
    const label = (o: QuestionOption, i: number) => `${optionLetter(o, i)}) ${o.text ?? ''}`.trim();

    const byFlag = opts.map((o, i) => ({ o, i })).filter(({ o }) => o.is_correct).map(({ o, i }) => label(o, i));
    if (byFlag.length) return byFlag.join('; ');

    const ca = q.correct_answer;
    const indices: number[] = Array.isArray(ca) ? ca : ca != null ? [ca] : [];
    const byIndex = indices
      .map((i) => (typeof i === 'number' && opts[i] ? label(opts[i], i) : String(i)))
      .filter(Boolean);
    if (byIndex.length) return byIndex.join('; ');
  }

  if (q.question_type === 'matching' && Array.isArray(q.matching_pairs)) {
    return q.matching_pairs.map((p) => `${p.left} → ${p.right}`).join('; ');
  }

  const ca = q.correct_answer;
  if (ca == null || ca === '') return '—';
  if (Array.isArray(ca)) return ca.join(', ');
  return String(ca);
}

/** dangerouslySetInnerHTML with LaTeX + markdown rendering. */
function Rich({ text, className }: { text?: string; className?: string }) {
  if (!text) return null;
  return <span className={className} dangerouslySetInnerHTML={{ __html: renderTextWithLatex(text) }} />;
}

/** Blank ruled lines for hand-written answers. */
function WritingLines({ count }: { count: number }) {
  return (
    <div className="write-lines" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="write-line" />
      ))}
    </div>
  );
}

function GapWorksheet({ q }: { q: Question }) {
  const separator = q.gap_separator || ',';
  const gapSource = q.content_text || q.question_text || '';
  const showPrompt = !!q.question_text && q.question_text !== gapSource;
  const { html, gaps } = parseGapPassage(gapSource, separator);
  const hasChoices = gaps.some((g) => g.options.length > 1);

  return (
    <>
      {showPrompt && (
        <div className="qtext">
          <Rich text={q.question_text} />
        </div>
      )}
      <div className="passage gap-passage" dangerouslySetInnerHTML={{ __html: html }} />
      {hasChoices && (
        <div className="gap-options">
          {gaps.map((g) =>
            g.options.length > 1 ? (
              <div key={g.n} className="gap-option-row">
                <span className="qnum">({g.n})</span>
                {g.options.map((opt, i) => (
                  <span key={i} className="gap-opt">
                    <b>{idxLetter(i)})</b> <Rich text={opt} />
                  </span>
                ))}
              </div>
            ) : null,
          )}
        </div>
      )}
    </>
  );
}

function WorksheetQuestion({ item }: { item: NumberedQuestion }) {
  const { n, q } = item;
  const type = q.question_type;
  const isGap = GAP_TYPES.has(type);
  // A question is "choice" whenever it actually carries options — this covers
  // single/multiple choice AND media_question, which is MCQ + an image.
  const hasOptions = !isGap && Array.isArray(q.options) && q.options.length > 0;
  const isImageOnly = type === 'image_content';
  const isLongOpen = !hasOptions && (type === 'long_text' || type === 'media_open_question');
  const isShortOpen = !hasOptions && (type === 'short_answer' || type === 'media_question');

  // Most questions should never split across a page. But gap passages and
  // long-answer lists can be taller than a page — forcing them to stay whole
  // would leave a blank page — so those remain breakable.
  const breakable = isGap || isLongOpen;

  return (
    <div className={`question${breakable ? ' question-breakable' : ''}`}>
      <div className="question-head">
        <span className="qnum">{n}.</span>
        <div className="qbody">
          {isGap ? (
            <GapWorksheet q={q} />
          ) : (
            <div className="qtext">
              <Rich text={q.question_text} />
            </div>
          )}

          {/* Shared passage / stimulus, shown after the prompt (non-gap questions) */}
          {!isGap && hasVisibleContent(q.content_text) && (
            <div className="passage">
              <Rich text={q.content_text} />
            </div>
          )}

          {/* Question-level media */}
          {q.media_url && (q.media_type === 'image' || isImageOnly) && (
            <img className="qmedia" src={mediaUrl(q.media_url)} alt="" />
          )}

          {/* Answer area by type */}
          {hasOptions && (
            <ol className="options">
              {(q.options || []).map((opt, i) => (
                <li key={opt.id ?? i} className="option">
                  <span className="bubble">{optionLetter(opt, i)}</span>
                  <span className="option-text">
                    <Rich text={opt.text} />
                    {opt.image_url && <img className="option-img" src={mediaUrl(opt.image_url)} alt="" />}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {type === 'matching' && Array.isArray(q.matching_pairs) && (
            <div className="matching">
              <div className="match-col">
                {q.matching_pairs.map((p, i) => (
                  <div key={i} className="match-item">
                    <span className="qnum">{i + 1}.</span> <Rich text={p.left} />
                    <span className="match-blank">____</span>
                  </div>
                ))}
              </div>
              <div className="match-col">
                {q.matching_pairs.map((p, i) => (
                  <div key={i} className="match-item">
                    <span className="bubble">{idxLetter(i)}</span> <Rich text={p.right} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {isShortOpen && <WritingLines count={2} />}
          {isLongOpen && <WritingLines count={5} />}
        </div>
      </div>
    </div>
  );
}

function AnswerKeyRow({ item }: { item: NumberedQuestion }) {
  const { n, q } = item;

  // Gap questions: list the correct option for every blank.
  if (GAP_TYPES.has(q.question_type)) {
    const separator = q.gap_separator || ',';
    const { gaps } = parseGapPassage(q.content_text || q.question_text || '', separator);
    const fallback: string[] = Array.isArray(q.correct_answer) ? q.correct_answer : [];
    return (
      <div className="answer-row">
        <div className="answer-line">
          <span className="qnum">{n}.</span>
        </div>
        <div className="gap-key">
          {gaps.map((g, i) => {
            const correct = g.correct || fallback[i] || '—';
            const letterIdx = g.options.indexOf(correct);
            const letter = letterIdx >= 0 ? `${idxLetter(letterIdx)}) ` : '';
            return (
              <div key={g.n} className="gap-key-item">
                <span className="gap-key-num">{g.n}.</span> {letter}
                <Rich text={correct} />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="answer-row">
      <div className="answer-line">
        <span className="qnum">{n}.</span>
        <Rich className="answer-value" text={correctAnswerDisplay(q)} />
      </div>
      {q.explanation && (
        <div className="explanation">
          <Rich text={q.explanation} />
        </div>
      )}
    </div>
  );
}

export default function PracticePrintPage() {
  const { lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const [searchParams] = useSearchParams();
  const stepId = searchParams.get('step');
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [steps, setSteps] = useState<Step[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const autoPrintedRef = useRef(false);

  useEffect(() => {
    if (!lessonId) return;
    let active = true;
    (async () => {
      try {
        setLoading(true);
        // With ?step=<id> we print a single step; otherwise the whole unit.
        const [lessonData, stepsData] = await Promise.all([
          apiClient.getLesson(lessonId),
          stepId
            ? apiClient.getStep(stepId).then((s) => [s])
            : apiClient.getLessonSteps(lessonId, true),
        ]);
        if (!active) return;
        setLesson(lessonData);
        setSteps(stepsData);
      } catch (e) {
        if (active) setError('Failed to load the practice. Please refresh the page.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [lessonId, stepId]);

  // Flatten every quiz step's questions into one continuously-numbered list.
  const questions = useMemo<NumberedQuestion[]>(() => {
    const quizSteps = [...steps]
      .filter((s) => s.content_type === 'quiz')
      .sort((a, b) => a.order_index - b.order_index);

    const out: NumberedQuestion[] = [];
    let n = 1;
    for (const step of quizSteps) {
      let data: QuizData | null = null;
      try {
        data = JSON.parse(step.content_text || '{}');
      } catch {
        data = null;
      }
      const qs = data?.questions || [];
      for (const q of qs) {
        out.push({ n: n++, q, quizTitle: data?.title || step.title });
      }
    }
    return out;
  }, [steps]);

  const triggerPrint = () => window.print();

  // Auto-open the print dialog once content + images are ready.
  useEffect(() => {
    if (loading || error || questions.length === 0 || autoPrintedRef.current) return;
    autoPrintedRef.current = true;

    const el = containerRef.current;
    const imgs = el ? Array.from(el.querySelectorAll('img')) : [];
    const pending = imgs.filter((img) => !img.complete);

    if (pending.length === 0) {
      const id = window.setTimeout(triggerPrint, 150);
      return () => window.clearTimeout(id);
    }

    let done = false;
    const fire = () => {
      if (done) return;
      done = true;
      window.clearTimeout(fallback);
      triggerPrint();
    };
    let remaining = pending.length;
    const onSettled = () => {
      remaining -= 1;
      if (remaining <= 0) fire();
    };
    pending.forEach((img) => {
      img.addEventListener('load', onSettled, { once: true });
      img.addEventListener('error', onSettled, { once: true });
    });
    // Safety net so a slow/broken image never blocks printing forever.
    const fallback = window.setTimeout(fire, 3500);
    return () => window.clearTimeout(fallback);
  }, [loading, error, questions.length]);

  return (
    <div className="practice-print" ref={containerRef}>
      <style>{PRINT_CSS}</style>

      {/* Screen-only toolbar (hidden when printing) */}
      <div className="no-print toolbar">
        <button className="print-btn" onClick={triggerPrint}>
          <Printer size={16} /> Print / Save as PDF
        </button>
        <span className="toolbar-hint">In the print dialog, choose “Save as PDF”.</span>
      </div>

      {loading && <div className="status">Loading practice…</div>}
      {error && <div className="status">{error}</div>}
      {!loading && !error && questions.length === 0 && (
        <div className="status">This unit has no practice questions.</div>
      )}

      {!loading && !error && questions.length > 0 && (
        <>
          <header className="sheet-header">
            <h1>{(stepId && steps[0]?.title) || lesson?.title || 'Practice'}</h1>
            {stepId && steps[0]?.title && lesson?.title && (
              <div className="sheet-sub">{lesson.title}</div>
            )}
          </header>

          <section className="worksheet">
            {questions.map((item) => (
              <WorksheetQuestion key={item.n} item={item} />
            ))}
          </section>

          <section className="answer-key">
            <h2>Answer Key &amp; Explanations</h2>
            {questions.map((item) => (
              <AnswerKeyRow key={item.n} item={item} />
            ))}
          </section>
        </>
      )}
    </div>
  );
}

// Self-contained styling. Kept independent of the app theme so the sheet always
// prints as black-on-white regardless of the user's dark/light mode.
const PRINT_CSS = `
.practice-print {
  max-width: 820px;
  margin: 0 auto;
  padding: 24px 28px 64px;
  background: #ffffff;
  color: #111111;
  font-family: 'Georgia', 'Times New Roman', serif;
  font-size: 15px;
  line-height: 1.6;
}
.practice-print img { max-width: 100%; height: auto; }
/* Restore list markers that the app's global CSS reset strips. */
.practice-print ol { list-style: decimal; }
.practice-print ul { list-style: disc; }
.practice-print ol, .practice-print ul { margin: 6px 0 6px 1.6em; padding: 0; }
.practice-print li { margin: 4px 0; }

.toolbar {
  position: sticky; top: 0; z-index: 10;
  display: flex; align-items: center; gap: 14px; flex-wrap: wrap;
  padding: 12px 0 16px; margin-bottom: 12px;
  border-bottom: 1px solid #e2e2e2; background: #ffffff;
}
.print-btn {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 8px 16px; border: none; border-radius: 8px;
  background: #2563eb; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer;
  font-family: system-ui, sans-serif;
}
.print-btn:hover { background: #1d4ed8; }
.toolbar-hint { font-family: system-ui, sans-serif; font-size: 13px; color: #666; }
.status { padding: 40px 0; text-align: center; color: #555; font-family: system-ui, sans-serif; }

.sheet-header { border-bottom: 2px solid #111; padding-bottom: 10px; margin-bottom: 22px; }
.sheet-header h1 { font-size: 22px; margin: 0; }
.sheet-sub { margin-top: 4px; font-size: 14px; color: #555; }

/* Keep each question whole on one page (move it to the next page if it doesn't
   fit). Tall questions opt out via .question-breakable so they don't strand a
   blank page. */
.question { margin: 0 0 24px; page-break-inside: avoid; break-inside: avoid; }
.question-breakable { page-break-inside: auto; break-inside: auto; }
.passage {
  border-left: 3px solid #cbd5e1; padding: 6px 12px; margin: 0 0 10px;
  background: #f8fafc; font-size: 14.5px;
}
.gap-passage { line-height: 1.9; }
.gap-blank { font-weight: 700; white-space: nowrap; }
.question-head { display: flex; gap: 8px; align-items: baseline; }
.qnum { font-weight: 700; }
.qbody { flex: 1; min-width: 0; }
.qtext { margin-bottom: 8px; }

.gap-options { margin: 12px 0 0; }
.gap-option-row { margin: 5px 0; page-break-inside: avoid; }
.gap-opt { display: inline-block; margin-right: 18px; }
.gap-opt b { font-family: system-ui, sans-serif; }

.qmedia {
  display: block; margin: 10px 0; width: auto; max-width: 62%; max-height: 230px;
  border: 1px solid #e2e2e2; border-radius: 4px;
}

.options { list-style: none; margin: 16px 0 0; padding: 0; }
.option {
  display: flex; align-items: center; gap: 14px; margin: 10px 0;
  padding: 12px 16px; border: 1px solid #d0d5dd; border-radius: 10px;
  font-size: 16px; line-height: 1.4;
  page-break-inside: avoid; break-inside: avoid;
}
.bubble {
  flex: none; width: 28px; height: 28px; border: 1.5px solid #333; border-radius: 50%;
  display: inline-flex; align-items: center; justify-content: center;
  font-size: 14px; font-weight: 700; font-family: system-ui, sans-serif;
}
.option-text { flex: 1; }
.option-img { display: block; margin-top: 4px; max-height: 160px; }

.matching { display: flex; gap: 32px; margin-top: 10px; }
.match-col { flex: 1; }
.match-item { margin: 6px 0; }
.match-blank { margin-left: 8px; letter-spacing: 2px; }

.write-lines { margin: 10px 0 0; }
.write-line { border-bottom: 1px solid #b8b8b8; height: 26px; }

.answer-key { page-break-before: always; break-before: page; border-top: 2px solid #111; padding-top: 14px; }
.answer-key h2 { font-size: 18px; margin: 0 0 14px; }
.answer-row { margin: 0 0 16px; page-break-inside: avoid; break-inside: avoid; }
.answer-line { display: flex; gap: 8px; }
.answer-value { font-weight: 700; }
.explanation { margin: 4px 0 0 20px; font-size: 14px; color: #333; }
.gap-key { margin: 4px 0 0 20px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 2px 24px; }
.gap-key-item { font-size: 14px; }
.gap-key-num { font-weight: 700; }

.practice-print .katex { font-size: 1.1em; }
/* Fractions render small in KaTeX; enlarge them where legibility matters most.
   These use a .practice-print prefix so they out-specify the base rule above
   (equal specificity would otherwise let the later base rule win). */
.practice-print .option .katex,
.practice-print .gap-opt .katex { font-size: 1.5em; }
.practice-print .answer-value .katex,
.practice-print .gap-key-item .katex { font-size: 1.3em; }

@media print {
  .no-print { display: none !important; }
  .practice-print { max-width: none; margin: 0; padding: 0; font-size: 12pt; }
  .answer-row, .gap-option-row, .option, .match-item { page-break-inside: avoid; }
  @page { margin: 16mm 14mm; }
}
`;
