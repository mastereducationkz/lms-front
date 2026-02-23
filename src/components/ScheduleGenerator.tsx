
import React, { useState } from 'react';
import { 
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter 
} from './ui/dialog';
import { Label } from './ui/label';
import { Input } from './ui/input';
import { Checkbox } from './ui/checkbox';
import { Button } from './ui/button';
import { Clock, Loader2 } from 'lucide-react';
import apiClient, { generateSchedule } from '../services/api';
import { toast } from './Toast';

interface ScheduleGeneratorProps {
    groupId: number | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: () => void;
    trigger?: React.ReactNode;
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ScheduleGenerator({ groupId, open, onOpenChange, onSuccess, trigger }: ScheduleGeneratorProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
    const [lessons, setLessons] = useState(48);
    
    // Config: { dayIndex: timeString }
    const [scheduleConfig, setScheduleConfig] = useState<Record<number, string>>({});

    React.useEffect(() => {
        if (open && groupId) {
            // Reset to avoid showing previous group's data while loading
            setScheduleConfig({});
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
                
                const config: Record<number, string> = {};
                data.schedule_items.forEach((item: { day_of_week: number; time_of_day: string }) => {
                    config[item.day_of_week] = item.time_of_day;
                });
                setScheduleConfig(config);
            } else {
                // Reset to defaults if no schedule
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
        setScheduleConfig(prev => {
            const next = { ...prev };
            if (next[dayIndex]) {
                delete next[dayIndex];
            } else {
                next[dayIndex] = "19:00"; // Default time
            }
            return next;
        });
    };

    const handleTimeChange = (dayIndex: number, time: string) => {
        setScheduleConfig(prev => ({
            ...prev,
            [dayIndex]: time
        }));
    };

    const parseShorthand = (text: string) => {
        const dayMap: Record<string, number> = {
            'пн': 0, 'вт': 1, 'ср': 2, 'чт': 3, 'пт': 4, 'сб': 5, 'вс': 6,
            'mon': 0, 'tue': 1, 'wed': 2, 'thu': 3, 'fri': 4, 'sat': 5, 'sun': 6
        };
        
        const newConfig: Record<number, string> = {};
        const normalized = text.toLowerCase().replace(/:/g, ' ');
        const tokens = normalized.split(/\s+/).filter(Boolean);
        
        let currentDays: number[] = [];
        
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            const nextToken = tokens[i + 1];
            
            if (dayMap[token] !== undefined) {
                currentDays.push(dayMap[token]);
            } else if (/^\d{1,2}$/.test(token) && nextToken && /^\d{2}$/.test(nextToken)) {
                // Time format: HH MM
                const hh = token.padStart(2, '0');
                const mm = nextToken;
                const time = `${hh}:${mm}`;
                currentDays.forEach(d => {
                    newConfig[d] = time;
                });
                currentDays = [];
                i++; // Skip nextToken
            } else if (/^\d{1,2}:\d{2}$/.test(token)) {
                // Time format: HH:MM (already handled by replace but safe)
                newConfig[currentDays[0]] = token; // This case shouldn't be reached with replace(/:/g, ' ')
            }
        }
        
        if (Object.keys(newConfig).length > 0) {
            setScheduleConfig(newConfig);
        }
    };

    const handleGenerate = async () => {
        if (!groupId) return;
        
        const items = Object.entries(scheduleConfig).map(([day, time]) => ({
            day_of_week: parseInt(day),
            time_of_day: time
        }));

        if (items.length === 0) {
            toast("Please select at least one day", "error");
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
            toast("Schedule generated successfully", "success");
            onOpenChange(false);
            if (onSuccess) onSuccess();
        } catch (e) {
            console.error("Failed to generate schedule", e);
            toast("Failed to generate schedule", "error");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Generate Class Schedule</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4 text-gray-700 dark:text-gray-300">
                    {isLoading ? (
                        <div className="flex justify-center items-center py-12">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        </div>
                    ) : (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="shorthand" className="text-gray-900 dark:text-foreground font-semibold">Быстрый ввод (пн ср пт 19:00)</Label>
                                <Input 
                                    id="shorthand" 
                                    placeholder="вт чт 20 00 сб 12 00"
                                    onChange={(e) => parseShorthand(e.target.value)}
                                    className="border-gray-300 dark:border-border focus:border-blue-500"
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="start-date" className="text-gray-900 dark:text-foreground font-semibold">Start Date</Label>
                                <Input 
                                    id="start-date" 
                                    type="date" 
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="border-gray-300 dark:border-border focus:border-blue-500"
                                />
                            </div>

                            <div className="space-y-3">
                                <Label>Weekly Schedule</Label>
                                <div className="grid gap-4 border dark:border-border rounded-md p-3">
                                    {DAYS.map((day, i) => {
                                        const isSelected = scheduleConfig[i] !== undefined;
                                        return (
                                            <div key={day} className="flex items-center justify-between">
                                                <div className="flex items-center space-x-2">
                                                    <Checkbox 
                                                        id={`day-${i}`} 
                                                        checked={isSelected}
                                                        onCheckedChange={() => handleToggleDay(i)}
                                                    />
                                                    <Label htmlFor={`day-${i}`} className={isSelected ? "font-medium" : "text-muted-foreground"}>
                                                        {day}
                                                    </Label>
                                                </div>
                                                {isSelected && (
                                                    <div className="flex items-center w-28">
                                                        <Clock className="w-3 h-3 mr-2 text-muted-foreground" />
                                                        <Input 
                                                            type="text" 
                                                            className="h-7 text-xs"
                                                            placeholder="19:00"
                                                            value={scheduleConfig[i]}
                                                            onChange={(e) => handleTimeChange(i, e.target.value)}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="lessons">Duration (Lessons)</Label>
                                <Input 
                                    id="lessons" 
                                    type="number" 
                                    min={1} 
                                    max={100}
                                    value={lessons}
                                    onChange={(e) => setLessons(parseInt(e.target.value) || 48)}
                                />
                            </div>
                        </>
                    )}
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleGenerate} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : "Generate"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
