import { useEffect, useState } from 'react';
import { chartColors, chartTick, chartTooltipStyle } from '../lib/chartTheme';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Avatar, AvatarFallback } from '../components/ui/avatar';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "../components/ui/accordion";
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer
} from 'recharts';
import apiClient from '../services/api';
import { ChevronLeft } from 'lucide-react';
import UserAvatar from '@/components/mascot/UserAvatar';

interface Student {
    id: number;
    name: string;
    email: string;
    avatar_url: string | null;
    mascot?: string | null;
    avg_progress: number;
    overdue_count: number;
}

interface CuratorGroup {
    id: number;
    name: string;
    student_count: number;
    overdue_count: number;
    avg_progress: number;
    students: Student[];
}

interface CuratorDetails {
    id: number;
    name: string;
    email: string;
    avatar_url: string | null;
    groups: CuratorGroup[];
    total_students: number;
    total_overdue: number;
    avg_progress: number;
    performance_distribution?: Array<{ range: string; count: number }>;
    overdue_history?: Array<{ date: string; count: number }>;
    group_comparison?: Array<{ group_name: string; avg_progress: number; student_count: number; overdue_count: number }>;
}

export default function HeadCuratorCuratorPage() {
    const { curatorId } = useParams<{ curatorId: string }>();
    const navigate = useNavigate();
    const [curator, setCurator] = useState<CuratorDetails | null>(null);
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        loadCuratorDetails();
    }, [curatorId]);

    const loadCuratorDetails = async () => {
        if (!curatorId) return;
        setLoading(true);
        try {
            const res = await apiClient.getCuratorDetails(parseInt(curatorId));
            setCurator(res as any);
        } catch (error) {
            console.error('Failed to load curator details:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex justify-center items-center">
                <div className="animate-pulse text-muted-foreground">Загрузка данных куратора...</div>
            </div>
        );
    }

    if (!curator) {
        return (
            <div className="p-8 text-center text-muted-foreground">
                Куратор не найден
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-col space-y-2">
                <Button 
                    variant="ghost" 
                    onClick={() => navigate('/dashboard')} 
                    className="w-fit pl-0 mb-2 hover:bg-muted -ml-2 text-muted-foreground"
                >
                    <ChevronLeft className="mr-2 h-4 w-4" /> Назад к дашборду
                </Button>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Avatar className="h-14 w-14">
                            <AvatarFallback className="bg-brand-subtle text-brand-subtle-foreground font-bold text-xl">
                                {curator.name.charAt(0)}
                            </AvatarFallback>
                        </Avatar>
                        <div>
                            <h1 className="text-3xl font-bold tracking-tight text-foreground">{curator.name}</h1>
                            <p className="text-muted-foreground">{curator.email}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 @2xl:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Студентов</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{curator.total_students}</div>
                        <p className="text-xs text-muted-foreground mt-1">В {curator.groups.length} группах</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Просрочено</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-amber-600 dark:text-amber-300">{curator.total_overdue}</div>
                        <p className="text-xs text-muted-foreground mt-1">Просроченные задания</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Ср. прогресс</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${
                            curator.avg_progress > 80 ? 'text-emerald-600 dark:text-emerald-300' : 
                            curator.avg_progress > 60 ? 'text-amber-600 dark:text-amber-300' : 'text-foreground'
                        }`}>
                            {curator.avg_progress}%
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Средний прогресс</p>
                    </CardContent>
                </Card>
            </div>

            {/* Overdue History Chart */}
            <Card className="border-border shadow-sm">
                <CardHeader>
                    <CardTitle className="text-lg">Тренды просрочек</CardTitle>
                    <CardDescription>Новые просроченные задания за последние 30 дней</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={curator.overdue_history || []}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={chartColors.grid} />
                                <XAxis 
                                    dataKey="date" 
                                    tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' })}
                                    tick={chartTick(12)} 
                                    axisLine={false}
                                    tickLine={false}
                                    minTickGap={30}
                                />
                                <YAxis 
                                    allowDecimals={false}
                                    tick={chartTick(12)} 
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <RechartsTooltip 
                                    contentStyle={chartTooltipStyle}
                                    labelFormatter={(label) => new Date(label).toLocaleDateString()}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="count" 
                                    stroke="#f59e0b" 
                                    strokeWidth={3}
                                    dot={{ r: 4, fill: "#f59e0b", strokeWidth: 2, stroke: chartColors.surface }}
                                    activeDot={{ r: 6 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Groups with Student Details */}
            <Card className="border-border shadow-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-lg">Группы и студенты</CardTitle>
                    <CardDescription>Подробная информация о студентах каждой группы</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {curator.groups.length === 0 && (
                        <p className="p-6 text-center text-muted-foreground italic">У этого куратора нет групп.</p>
                    )}
                    <Accordion type="multiple" className="w-full">
                        {curator.groups.map((group) => (
                            <AccordionItem key={group.id} value={`group-${group.id}`} className="border-b last:border-b-0">
                                <AccordionTrigger className="px-6 py-4 hover:bg-muted/60 hover:no-underline">
                                    <div className="flex items-center justify-between w-full pr-4">
                                        <div className="flex items-center gap-4">
                                            <div>
                                                <p className="font-semibold text-foreground text-left">{group.name}</p>
                                                <p className="text-sm text-muted-foreground text-left">{group.student_count} студентов</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {group.overdue_count > 0 && (
                                                <Badge variant="destructive" className="text-xs">
                                                    {group.overdue_count} просрочено
                                                </Badge>
                                            )}
                                            <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/30">
                                                {group.avg_progress}%
                                            </Badge>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="text-brand hover:text-brand-subtle-foreground hover:bg-brand-surface"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate(`/curator/leaderboard?groupId=${group.id}`);
                                                }}
                                            >
                                                Лидерборд
                                            </Button>
                                        </div>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent className="px-6 pb-4 bg-slate-50/30 dark:bg-muted/40">
                                    {group.students.length === 0 ? (
                                        <p className="text-center text-muted-foreground italic py-4">Студентов не найдено.</p>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <table className="w-full border-collapse bg-card rounded-lg overflow-hidden">
                                                <thead>
                                                    <tr className="bg-slate-50 dark:bg-muted border-b">
                                                        <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Студент</th>
                                                        <th className="px-4 py-3 text-left text-xs font-bold text-muted-foreground uppercase">Email</th>
                                                        <th className="px-4 py-3 text-center text-xs font-bold text-muted-foreground uppercase">Прогресс</th>
                                                        <th className="px-4 py-3 text-center text-xs font-bold text-muted-foreground uppercase">Просрочено</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-border">
                                                    {group.students.map((student) => (
                                                        <tr 
                                                            key={student.id}
                                                            className="hover:bg-muted/60 transition-colors"
                                                        >
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-3">
                                                                    <UserAvatar userId={student.id} name={student.name} avatarUrl={student.avatar_url} mascot={student.mascot} isStudent size={32} />
                                                                    <span className="font-medium text-foreground">{student.name}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className="text-sm text-muted-foreground">{student.email}</span>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center justify-center gap-2">
                                                                    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                                                                        <div 
                                                                            className="h-full bg-green-500 rounded-full transition-all" 
                                                                            style={{ width: `${student.avg_progress}%` }} 
                                                                        />
                                                                    </div>
                                                                    <span className="text-xs font-bold text-foreground min-w-[35px]">{student.avg_progress}%</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <Badge 
                                                                    variant={student.overdue_count > 0 ? "destructive" : "secondary"}
                                                                    className={student.overdue_count === 0 ? "bg-green-50 dark:bg-green-500/15 text-green-700 dark:text-green-300 border-green-100" : ""}
                                                                >
                                                                    {student.overdue_count}
                                                                </Badge>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>
        </div>
    );
}

