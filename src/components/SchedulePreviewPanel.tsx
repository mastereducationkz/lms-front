import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { previewSchedule } from '../services/api';
import {
    PREVIEW_CHANGE_TAGS,
    formatPreviewLessonRow,
    previewSummary,
    type SchedulePreview,
    type SchedulePreviewPayload,
} from '../lib/schedulePreview';
import { cn } from '../lib/utils';

/**
 * What pressing «Generate» would do, shown before it is pressed: how many lessons have passed,
 * how many will be planned and until when, the course total, and how many existing lessons move,
 * change length, appear or are switched off.
 *
 * The dialog hands over a payload only while the form is valid; `null` hides the panel. Edits
 * are debounced (400 ms) and every request owns an AbortController, so typing a time does not
 * fire a request per keystroke and a slow answer to an older edit cannot overwrite a newer one.
 * The preview is advice: when it fails, saving is still allowed and the panel says so.
 *
 * Ported from crm-master frontend/src/components/groups/SchedulePreviewPanel.tsx (2026-09-17).
 */

const DEBOUNCE_MS = 400;

type PreviewState =
    | { status: 'idle' }
    | { status: 'loading'; last: SchedulePreview | null }
    | { status: 'ready'; preview: SchedulePreview }
    | { status: 'error' };

interface SchedulePreviewPanelProps {
    payload: SchedulePreviewPayload | null;
}

export default function SchedulePreviewPanel({ payload }: SchedulePreviewPanelProps) {
    const [state, setState] = useState<PreviewState>({ status: 'idle' });
    const [showDates, setShowDates] = useState(false);

    // The dialog rebuilds the payload object on every render; its JSON is what actually changed.
    const payloadKey = payload ? JSON.stringify(payload) : null;

    useEffect(() => {
        if (!payloadKey) {
            setState({ status: 'idle' });
            return;
        }
        setState((previous) => ({
            status: 'loading',
            last: previous.status === 'ready' ? previous.preview : previous.status === 'loading' ? previous.last : null,
        }));

        const controller = new AbortController();
        const timer = window.setTimeout(() => {
            previewSchedule(JSON.parse(payloadKey) as SchedulePreviewPayload, controller.signal)
                .then((preview) => {
                    if (!controller.signal.aborted) setState({ status: 'ready', preview });
                })
                .catch(() => {
                    if (!controller.signal.aborted) setState({ status: 'error' });
                });
        }, DEBOUNCE_MS);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [payloadKey]);

    if (state.status === 'idle') return null;

    if (state.status === 'error') {
        return (
            <p
                role="status"
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200"
            >
                Не удалось рассчитать — сохранение всё равно возможно
            </p>
        );
    }

    const preview = state.status === 'ready' ? state.preview : state.last;
    const loading = state.status === 'loading';

    if (!preview) {
        return (
            <p role="status" className="flex items-center gap-2 rounded-md border dark:border-border px-3 py-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Рассчитываю…
            </p>
        );
    }

    const summary = previewSummary(preview);

    return (
        <div
            className={cn(
                'space-y-1.5 rounded-md border dark:border-border bg-muted/30 px-3 py-2 text-xs transition-opacity',
                loading && 'opacity-60',
            )}
            aria-live="polite"
            aria-busy={loading}
        >
            <p className="text-muted-foreground">{summary.started}</p>
            <p>{summary.planned}</p>
            <p className="font-medium text-gray-900 dark:text-foreground">{summary.total}</p>
            <p className="text-muted-foreground">{summary.changes}</p>

            {preview.warnings.map((warning) => (
                <p key={warning} className="text-amber-700 dark:text-amber-400">
                    {warning}
                </p>
            ))}

            {preview.lessons.length > 0 && (
                <div className="pt-0.5">
                    <button
                        type="button"
                        className="text-blue-600 hover:underline dark:text-blue-400"
                        onClick={() => setShowDates((open) => !open)}
                        aria-expanded={showDates}
                    >
                        {showDates ? 'Скрыть даты' : 'Показать даты'}
                    </button>
                    {showDates && (
                        <ul className="mt-1.5 max-h-48 space-y-0.5 overflow-y-auto pr-1 tabular-nums">
                            {preview.lessons.map((lesson, index) => {
                                const tag = PREVIEW_CHANGE_TAGS[lesson.change];
                                const before =
                                    lesson.previous_start && lesson.previous_end
                                        ? `было: ${formatPreviewLessonRow(lesson.previous_start, lesson.previous_end)}`
                                        : undefined;
                                return (
                                    <li key={`${lesson.event_id ?? 'new'}-${lesson.start}-${index}`} className="flex items-center gap-2">
                                        <span>{formatPreviewLessonRow(lesson.start, lesson.end)}</span>
                                        {tag && (
                                            <span
                                                className={cn(
                                                    'rounded px-1.5 py-px text-[10px] leading-4',
                                                    lesson.change === 'create'
                                                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
                                                        : 'bg-amber-50 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
                                                )}
                                                title={before}
                                            >
                                                {tag}
                                            </span>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}

            {loading && <p className="text-muted-foreground">Рассчитываю…</p>}
        </div>
    );
}
