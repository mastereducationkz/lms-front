
import React, { useState } from 'react';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter
} from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Clock, Loader2 } from 'lucide-react';
import ThinkingLoader from './ThinkingLoader';
import apiClient, { generateSchedule } from '../services/api';
import { toast } from './Toast';
import {
    DEFAULT_LESSON_MINUTES,
    applyShorthand,
    configFromScheduleSlots,
    invalidScheduleTimes,
    scheduleSlotsFromConfig,
    weekdayLabel,
    type ScheduleConfig,
} from '../lib/scheduleShorthand';
import { formatHoursTotal, schedulePreviewPayload } from '../lib/schedulePreview';
import type { Locale } from '../lib/i18n';
import { useLocale, useT } from '../lib/i18n/react';
import SchedulePreviewPanel from './SchedulePreviewPanel';
import '@/lib/i18n/catalogs/schedule';

interface ScheduleGeneratorProps {
    groupId: number | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    trigger?: React.ReactNode;
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/** «Mon» / «Пн» — the row label for a weekday (0 = Monday). */
const dayName = (day: number, locale: Locale): string => {
    const label = weekdayLabel(day, locale);
    return label.charAt(0).toUpperCase() + label.slice(1);
};

// The lengths offered in the per-day select. A stored value outside this set (e.g. a group
// generated before per-day lengths existed with something non-standard) is added to the list
// for that day so it stays visible instead of silently snapping to 60.
const STANDARD_LESSON_LENGTHS = [60, 90, 120];

const lessonLengthOptions = (current: number): number[] =>
    STANDARD_LESSON_LENGTHS.includes(current)
        ? STANDARD_LESSON_LENGTHS
        : [...STANDARD_LESSON_LENGTHS, current].sort((a, b) => a - b);

export default function ScheduleGenerator({ groupId, open, onOpenChange, onSuccess, trigger }: ScheduleGeneratorProps) {
    const t = useT();
    const locale = useLocale();
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [lessons, setLessons] = useState(48);

    // Config: { dayIndex: { time, duration } }
    const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>({});
    const [shorthandText, setShorthandText] = useState('');
    const [shorthandProblems, setShorthandProblems] = useState<string[]>([]);
    // Set by a Generate attempt; the list itself is recomputed live, so fixing a time clears it.
    const [showTimeErrors, setShowTimeErrors] = useState(false);
    const badTimeDays = showTimeErrors ? invalidScheduleTimes(scheduleConfig) : [];
    // What «Generate» would do, previewed while the form is valid; null (no request, no panel)
    // while the stored schedule is still loading or the form is not something the API accepts.
    const previewPayload = isLoading
        ? null
        : schedulePreviewPayload({ groupId, startDate, lessonsCount: lessons, config: scheduleConfig });

    // Ruling L: the quick-entry box parses against this BASE snapshot, not against the live
    // `scheduleConfig` — which a shorthand parse itself keeps replacing (Ruling I). Parsing
    // against the live config meant a half-typed line dropped days out of it, and once the day
    // came back (e.g. backspacing a range down to a bare time) it inherited whatever duration
    // that transient, already-mutated config happened to hold instead of the day's real stored
    // length. The base is set on load and refreshed ONLY by row edits (time, length, day
    // toggle) — never by a shorthand parse — so a bare time always inherits the day's true
    // current length regardless of what was typed and undone along the way.
    const baseConfigRef = React.useRef<ScheduleConfig>({});

    React.useEffect(() => {
        if (open && groupId) {
            // Reset to avoid showing previous group's data while loading
            setScheduleConfig({});
            baseConfigRef.current = {};
            setShorthandText('');
            setShorthandProblems([]);
            setShowTimeErrors(false);
            loadExistingSchedule(groupId);
        }
    }, [open, groupId]);

    const loadExistingSchedule = async (id: number) => {
        setIsLoading(true);
        try {
            const data = await apiClient.getGroupSchedule(id);
            if (data.schedule_items && data.schedule_items.length > 0) {
                setStartDate(data.start_date);
                setLessons(data.lessons_count || (data.weeks_count * (data.schedule_items.length || 3)));
                const loaded = configFromScheduleSlots(data.schedule_items);
                baseConfigRef.current = loaded;
                setScheduleConfig(loaded);
            } else {
                // Reset to defaults if no schedule
                baseConfigRef.current = {};
                setScheduleConfig({});
                setStartDate(new Date().toISOString().split('T')[0]);
                setLessons(48);
            }
        } catch (e) {
            console.error("Failed to load existing schedule", e);
        } finally {
            setIsLoading(false);
        }
    };

    const handleToggleDay = (dayIndex: number) => {
        const next = { ...scheduleConfig };
        if (next[dayIndex]) {
            delete next[dayIndex];
        } else {
            next[dayIndex] = { time: "19:00", duration: DEFAULT_LESSON_MINUTES }; // Default time
        }
        baseConfigRef.current = next;
        setScheduleConfig(next);
    };

    const handleTimeChange = (dayIndex: number, time: string) => {
        const next = {
            ...scheduleConfig,
            [dayIndex]: { time, duration: scheduleConfig[dayIndex]?.duration ?? DEFAULT_LESSON_MINUTES }
        };
        baseConfigRef.current = next;
        setScheduleConfig(next);
    };

    const handleDurationChange = (dayIndex: number, duration: number) => {
        const next = {
            ...scheduleConfig,
            [dayIndex]: { time: scheduleConfig[dayIndex]?.time ?? "19:00", duration }
        };
        baseConfigRef.current = next;
        setScheduleConfig(next);
    };

    const handleShorthandChange = (text: string) => {
        setShorthandText(text);
        // Two separate roles, per Ruling L / Ruling I: `baseConfigRef.current` supplies the
        // length a bare time inherits (never the config a previous keystroke's parse produced),
        // and a non-empty parse REPLACES the selected day set. When nothing parses, the result
        // falls back to `scheduleConfig` — the live, currently-displayed schedule — not the
        // base, so clearing the box or typing garbage after a valid parse never discards what
        // was just typed.
        const { config, problems } = applyShorthand(text, baseConfigRef.current, scheduleConfig, locale);
        setShorthandProblems(problems);
        setScheduleConfig(config);
    };

    const handleGenerate = async () => {
        if (!groupId) return;

        const items = scheduleSlotsFromConfig(scheduleConfig);

        if (items.length === 0) {
            toast(t('schedule.generator.pickDay'), "error");
            return;
        }

        if (invalidScheduleTimes(scheduleConfig).length > 0) {
            setShowTimeErrors(true);
            return;
        }

        setIsGenerating(true);
        try {
            await generateSchedule({
                group_id: groupId,
                start_date: startDate,
                schedule_items: items,
                lessons_count: lessons
            });
            toast(t('schedule.generator.generated'), "success");
            onOpenChange(false);
            if (onSuccess) onSuccess();
        } catch (e) {
            console.error("Failed to generate schedule", e);
            toast(t('schedule.generator.generateFailed'), "error");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            {/* The preview panel makes the dialog taller than a laptop screen can show at once. */}
            <DialogContent className="sm:max-w-[425px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t('schedule.generator.title')}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4 text-foreground/80">
                    {isLoading ? (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-brand" />
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="shorthand" className="text-foreground dark:text-foreground font-semibold">{t('schedule.generator.quickEntry')}</Label>
                                <Input
                                    id="shorthand"
                                    placeholder={t('schedule.generator.quickEntryPlaceholder')}
                                    value={shorthandText}
                                    onChange={(e) => handleShorthandChange(e.target.value)}
                                    className="border-input dark:border-border focus:border-brand"
                                />
                                {shorthandProblems.length > 0 && (
                                    <ul className="text-xs text-red-500 dark:text-red-400 space-y-0.5">
                                        {shorthandProblems.map((problem, i) => (
                                            <li key={i}>{problem}</li>
                                        ))}
                                    </ul>
                                )}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="start-date" className="text-foreground dark:text-foreground font-semibold">{t('schedule.generator.startDate')}</Label>
                                <Input
                                    id="start-date"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="border-input dark:border-border focus:border-brand"
                                />
                            </div>

                            <div className="space-y-3">
                                <Label>{t('schedule.generator.weekly')}</Label>
                                <div className="grid gap-4 border dark:border-border rounded-md p-3">
                                    {WEEKDAYS.map((i) => {
                                        const isSelected = scheduleConfig[i] !== undefined;
                                        const duration = scheduleConfig[i]?.duration ?? DEFAULT_LESSON_MINUTES;
                                        return (
                                            <div key={i} className="flex items-center justify-between gap-2">
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox
                                                        id={`day-${i}`}
                                                        checked={isSelected}
                                                        onCheckedChange={() => handleToggleDay(i)}
                                                    />
                                                    <Label htmlFor={`day-${i}`} className={isSelected ? "font-medium" : "text-muted-foreground"}>
                                                        {dayName(i, locale)}
                                                    </Label>
                                                </div>
                                                {isSelected && (
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex items-center w-24">
                                                            <Clock className="w-3 h-3 mr-2 text-muted-foreground" />
                                                            <Input
                                                                type="text"
                                                                className="h-7 text-xs"
                                                                placeholder="19:00"
                                                                value={scheduleConfig[i]?.time ?? ''}
                                                                onChange={(e) => handleTimeChange(i, e.target.value)}
                                                            />
                                                        </div>
                                                        <Select
                                                            value={String(duration)}
                                                            onValueChange={(value) => handleDurationChange(i, Number(value))}
                                                        >
                                                            <SelectTrigger className="h-7 w-24 text-xs">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {lessonLengthOptions(duration).map((minutes) => (
                                                                    <SelectItem key={minutes} value={String(minutes)}>
                                                                        {formatHoursTotal(minutes, locale)}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                {badTimeDays.length > 0 && (
                                    <p role="alert" className="text-xs text-red-500 dark:text-red-400">
                                        {t('schedule.generator.badTimes', { days: badTimeDays.map((day) => dayName(day, locale)).join(', ') })}
                                    </p>
                                )}
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="lessons">{t('schedule.generator.lessonsCount')}</Label>
                                <Input
                                    id="lessons"
                                    type="number"
                                    min={1}
                                    max={100}
                                    value={lessons}
                                    onChange={(e) => setLessons(parseInt(e.target.value) || 48)}
                                    aria-describedby="lessons-hint"
                                />
                                <p id="lessons-hint" className="text-xs text-muted-foreground">
                                    {t('schedule.generator.lessonsCountHint')}
                                </p>
                            </div>

                            <SchedulePreviewPanel payload={previewPayload} />
                        </>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>{t('common.cancel')}</Button>
                    <Button onClick={handleGenerate} disabled={isGenerating}>
                        {isGenerating ? <ThinkingLoader state="solving" size={20} label={t('schedule.generator.generating')} /> : t('schedule.generator.generate')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
