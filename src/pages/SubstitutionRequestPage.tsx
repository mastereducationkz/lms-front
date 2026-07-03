import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getAvailableTeachers, createLessonRequest } from '../services/api';
import { toast } from '../components/Toast';
import { formatInKZ } from '../lib/datetime';
import type { AvailableTeacher } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';

type RequestType = 'substitution' | 'reschedule' | 'cancel';

export default function SubstitutionRequestPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const eventId = searchParams.get('event_id') ? Number(searchParams.get('event_id')) : undefined;
  const groupId = searchParams.get('group_id') ? Number(searchParams.get('group_id')) : 0;
  const eventTitle = searchParams.get('title') || 'Lesson';
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
      const data = await getAvailableTeachers(eventDatetime, groupId || 0);
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
      const newDatetimeIso = requestType === 'reschedule' && newDatetime
        ? new Date(newDatetime).toISOString()
        : undefined;
      await createLessonRequest({
        request_type: requestType,
        event_id: eventId,
        group_id: groupId,
        original_datetime: eventDatetime,
        substitute_teacher_ids: requestType === 'substitution' ? selectedTeacherIds : undefined,
        new_datetime: newDatetimeIso,
        reason: reason || undefined,
      });
      setSubmitted(true);
    } catch (error: any) {
      console.error('Failed to submit request:', error);
      const msg = error?.response?.data?.detail || 'Failed to submit request. Please try again.';
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle>Invalid Request</CardTitle>
            <CardDescription>
              Missing lesson information. Please start from the Calendar and click on an event.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate('/calendar')}>
              Back to Calendar
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <CardTitle>Request Submitted</CardTitle>
            <CardDescription>
              Your {requestType} request has been sent to the head teacher for approval.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center gap-2">
            <Button variant="outline" onClick={() => navigate('/calendar')}>
              Back to Calendar
            </Button>
            <Button onClick={() => navigate('/my-requests')}>
              View My Requests
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">New Request</h1>
            <p className="text-muted-foreground">Cancel, reschedule, or request a substitute</p>
          </div>
          <Button variant="outline" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{eventTitle}</CardTitle>
            <CardDescription>
              {eventDatetime ? formatInKZ(eventDatetime, { dateStyle: 'long', timeStyle: 'short' }) : 'N/A'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs value={requestType} onValueChange={(v) => setRequestType(v as RequestType)} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="substitution">Substitution</TabsTrigger>
                <TabsTrigger value="reschedule">Reschedule</TabsTrigger>
                <TabsTrigger value="cancel">Cancel</TabsTrigger>
              </TabsList>

              <TabsContent value="substitution" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <Label>Select a substitute teacher</Label>
                </div>

                {loadingTeachers ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    Loading available teachers...
                  </div>
                ) : availableTeachers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm border rounded-md bg-muted/50">
                    No available teachers found for this time slot
                    <Button variant="link" onClick={loadTeachers} className="h-auto p-0 ml-1">Retry</Button>
                  </div>
                ) : (
                  <div className="grid gap-2 border rounded-md p-2 max-h-60 overflow-y-auto">
                    {availableTeachers.map(t => (
                      <div key={t.id} className="flex items-center space-x-2 p-2 rounded hover:bg-muted/50 transition-colors">
                        <Checkbox
                          id={`teacher-${t.id}`}
                          checked={selectedTeacherIds.includes(t.id)}
                          onCheckedChange={() => toggleTeacher(t.id)}
                        />
                        <div className="grid gap-0.5 leading-none">
                          <label
                            htmlFor={`teacher-${t.id}`}
                            className="text-sm font-medium leading-none cursor-pointer"
                          >
                            {t.name}
                          </label>
                          <p className="text-xs text-muted-foreground">{t.email}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="reschedule" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label htmlFor="new-date">New Date & Time</Label>
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
                  This will send a cancellation request to your head teacher. The lesson will only be cancelled after approval.
                </p>
              </TabsContent>
            </Tabs>

            <div className="space-y-2">
              <Label htmlFor="reason">Reason {requestType === 'cancel' ? '' : '(Optional)'}</Label>
              <Textarea
                id="reason"
                placeholder="Explain why you need this change..."
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
              {submitting ? 'Submitting...' : 'Submit Request'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
