import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAvailableTeachers, createLessonRequest } from '../services/api';
import { toast } from '../components/Toast';
import { fromDatetimeLocalKZ } from '../lib/datetime';
import { formatDateTime, type MessageKey } from '../lib/i18n';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/teacherDesk';
import type { AvailableTeacher } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';

type RequestType = 'substitution' | 'reschedule' | 'cancel';

/** What the confirmation says, per request type: applied at once, or sent for approval. */
const APPLIED_TEXT: Record<RequestType, MessageKey> = {
  substitution: 'teacherDesk.subRequest.appliedSubstitution',
  reschedule: 'teacherDesk.subRequest.appliedReschedule',
  cancel: 'teacherDesk.subRequest.appliedCancel',
};
const SENT_TEXT: Record<RequestType, MessageKey> = {
  substitution: 'teacherDesk.subRequest.sentSubstitution',
  reschedule: 'teacherDesk.subRequest.sentReschedule',
  cancel: 'teacherDesk.subRequest.sentCancel',
};

export default function SubstitutionRequestPage() {
  const navigate = useNavigate();
  const t = useT();
  const [searchParams] = useSearchParams();

  const eventId = searchParams.get('event_id') ? Number(searchParams.get('event_id')) : undefined;
  const groupId = searchParams.get('group_id') ? Number(searchParams.get('group_id')) : 0;
  const eventTitle = searchParams.get('title') || t('teacherDesk.subRequest.lessonFallback');
  const eventDatetime = searchParams.get('datetime') || '';
  const initialType = (searchParams.get('type') as RequestType) || 'substitution';

  const [requestType, setRequestType] = useState<RequestType>(initialType);
  const [availableTeachers, setAvailableTeachers] = useState<AvailableTeacher[]>([]);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [selectedTeacherIds, setSelectedTeacherIds] = useState<number[]>([]);
  const [newDatetime, setNewDatetime] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [autoApplied, setAutoApplied] = useState(false);

  useEffect(() => {
    if (requestType === 'substitution' && eventDatetime) {
      loadTeachers();
    }
  }, [requestType, eventDatetime]);

  const loadTeachers = async () => {
    try {
      setLoadingTeachers(true);
      setAvailableTeachers([]);
      setSelectedTeacherIds([]);
      const data = await getAvailableTeachers(eventDatetime, groupId || 0, eventId);
      setAvailableTeachers(data.available_teachers || []);
    } catch (error) {
      console.error('Failed to load available teachers:', error);
    } finally {
      setLoadingTeachers(false);
    }
  };

  // Single substitute: the requester names one teacher and the request goes
  // straight to the head teacher for approval (no substitute confirmation step).
  const toggleTeacher = (id: number) => {
    setSelectedTeacherIds(prev => (prev.includes(id) ? [] : [id]));
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      // datetime-local is deliberately timezone-free. Its wall-clock value is the
      // school's time, not the browser/device timezone of the person filing it.
      const newDatetimeIso = requestType === 'reschedule' && newDatetime
        ? fromDatetimeLocalKZ(newDatetime)
        : undefined;
      const created = await createLessonRequest({
        request_type: requestType,
        event_id: eventId,
        group_id: groupId,
        original_datetime: eventDatetime,
        substitute_teacher_ids: requestType === 'substitution' ? selectedTeacherIds : undefined,
        new_datetime: newDatetimeIso,
        reason: reason || undefined,
      });
      // When the requester heads their own subject, the change is applied at once.
      setAutoApplied((created as any)?.status === 'approved');
      setSubmitted(true);
    } catch (error: any) {
      console.error('Failed to submit request:', error);
      const msg = error?.response?.data?.detail || t('teacherDesk.subRequest.submitFailed');
      toast(typeof msg === 'string' ? msg : JSON.stringify(msg), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    requestType === 'substitution'
      ? selectedTeacherIds.length > 0
      : requestType === 'reschedule'
        ? !!newDatetime
        : true;

  const hasValidParams = eventDatetime && groupId > 0;

  if (!hasValidParams) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle>{t('teacherDesk.subRequest.invalid')}</CardTitle>
            <CardDescription>
              {t('teacherDesk.subRequest.invalidHint')}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate('/calendar')}>
              {t('teacherDesk.subRequest.backToCalendar')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle>{autoApplied ? t('teacherDesk.subRequest.applied') : t('teacherDesk.subRequest.submitted')}</CardTitle>
            <CardDescription>
              {t(autoApplied ? APPLIED_TEXT[requestType] : SENT_TEXT[requestType])}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => navigate('/calendar')}>
              {t('teacherDesk.subRequest.backToCalendar')}
            </Button>
            <Button onClick={() => navigate('/my-requests')}>
              {t('teacherDesk.subRequest.myRequests')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t('teacherDesk.subRequest.title')}</h1>
            <p className="text-muted-foreground">{t('teacherDesk.subRequest.subtitle')}</p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>
            {t('common.back')}
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{eventTitle}</CardTitle>
            <CardDescription>
              {eventDatetime ? formatDateTime(eventDatetime, { dateStyle: 'long', timeStyle: 'short' }) : t('teacherDesk.notAvailable')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs value={requestType} onValueChange={(v) => setRequestType(v as RequestType)} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="substitution">{t('teacherDesk.subRequest.tabSubstitution')}</TabsTrigger>
                <TabsTrigger value="reschedule">{t('teacherDesk.subRequest.tabReschedule')}</TabsTrigger>
                <TabsTrigger value="cancel">{t('teacherDesk.subRequest.tabCancel')}</TabsTrigger>
              </TabsList>

              <TabsContent value="substitution" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <Label>{t('teacherDesk.subRequest.selectSubstitute')}</Label>
                </div>

                {loadingTeachers ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    {t('teacherDesk.subRequest.loadingTeachers')}
                  </div>
                ) : availableTeachers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm border rounded-md bg-muted/50">
                    {t('teacherDesk.subRequest.noTeachers')}
                    <Button variant="link" onClick={loadTeachers} className="h-auto p-0 ml-1">{t('teacherDesk.retry')}</Button>
                  </div>
                ) : (
                  <div className="grid gap-2 border rounded-md p-2 max-h-60 overflow-y-auto">
                    {availableTeachers.map(teacher => (
                      <div key={teacher.id} className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50 transition-colors">
                        <Checkbox
                          id={`teacher-${teacher.id}`}
                          checked={selectedTeacherIds.includes(teacher.id)}
                          onCheckedChange={() => toggleTeacher(teacher.id)}
                        />
                        <div className="grid gap-0.5 leading-none">
                          <label
                            htmlFor={`teacher-${teacher.id}`}
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            {teacher.name}
                          </label>
                          <p className="text-xs text-muted-foreground">{teacher.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="reschedule" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="new-date">{t('teacherDesk.subRequest.newDateTime')}</Label>
                  <Input
                    id="new-date"
                    type="datetime-local"
                    value={newDatetime}
                    onChange={e => setNewDatetime(e.target.value)}
                  />
                </div>
              </TabsContent>

              <TabsContent value="cancel" className="space-y-4 mt-4">
                <p className="text-sm text-muted-foreground">
                  {t('teacherDesk.subRequest.cancelHint')}
                </p>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <Label htmlFor="reason">{requestType === 'cancel' ? t('teacherDesk.subRequest.reason') : t('teacherDesk.subRequest.reasonOptional')}</Label>
              <Textarea
                id="reason"
                placeholder={t('teacherDesk.subRequest.reasonPlaceholder')}
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="resize-none"
              />
            </div>

            <Button
              className="w-full"
              onClick={handleSubmit}
              disabled={submitting || !canSubmit}
              variant={requestType === 'cancel' ? 'destructive' : 'default'}
            >
              {submitting ? t('teacherDesk.subRequest.submitting') : t('teacherDesk.subRequest.submit')}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
