import { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import type { LessonRequest } from '../../types';
import { formatInKZ } from '../../lib/datetime';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';

type Props = {
  variant?: 'admin' | 'head_teacher';
};

export default function LessonRequestManagement({ variant = 'admin' }: Props) {
  const [requests, setRequests] = useState<LessonRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('pending,pending_teacher');
  const [adminComment, setAdminComment] = useState<Record<number, string>>({});
  const [processing, setProcessing] = useState<number | null>(null);

  const isHeadTeacher = variant === 'head_teacher';

  const fetchRequests = async () => {
    try {
      setLoading(true);
      let data: LessonRequest[];
      if (isHeadTeacher && statusFilter === 'pending,pending_teacher') {
        data = await apiClient.getPendingLessonRequests();
      } else {
        data = await apiClient.getLessonRequests(statusFilter || undefined);
      }
      setRequests(data);
    } catch (error) {
      console.error('Failed to fetch lesson requests:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [statusFilter, variant]);

  const handleApprove = async (id: number) => {
    try {
      setProcessing(id);
      await apiClient.approveLessonRequest(id, adminComment[id]);
      await fetchRequests();
    } catch (error) {
      console.error('Failed to approve:', error);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (id: number) => {
    try {
      setProcessing(id);
      await apiClient.rejectLessonRequest(id, adminComment[id]);
      await fetchRequests();
    } finally {
      setProcessing(null);
    }
  };

  const formatDate = (dateStr: string) =>
    formatInKZ(dateStr, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const statusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      case 'pending_teacher':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200">Waiting for Teacher</Badge>;
      case 'pending':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200">Pending Head Teacher</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isHeadTeacher ? 'Lesson Requests' : 'Lesson Requests'}
          </h1>
          <p className="text-muted-foreground mt-1">
            {isHeadTeacher
              ? 'Approve or reject lesson change requests from your teachers'
              : 'Manage substitution, reschedule, and cancel requests'}
          </p>
        </div>
        <div className="flex rounded-md shadow-sm">
          {[
            ['pending,pending_teacher', 'Pending'],
            ['approved', 'Approved'],
            ['rejected', 'Rejected'],
            ...(isHeadTeacher ? [] : [['', 'All'] as const]),
          ].map(([value, label], idx, arr) => {
            const isActive = statusFilter === value;
            return (
              <button
                key={value || 'all'}
                onClick={() => setStatusFilter(value)}
                className={`px-4 py-2 text-sm font-medium border transition-colors
                  ${idx === 0 ? 'rounded-l-md' : ''}
                  ${idx === arr.length - 1 ? 'rounded-r-md' : ''}
                  ${idx !== 0 ? '-ml-px' : ''}
                  ${isActive
                    ? 'bg-primary text-primary-foreground border-primary z-10'
                    : 'bg-background text-foreground border-input hover:bg-accent hover:text-accent-foreground'
                  }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <Card>
        <CardHeader className="px-6 py-4 border-b">
          <CardTitle className="text-lg">Requests</CardTitle>
          <CardDescription>
            {loading ? 'Loading requests...' : `${requests.length} requests found`}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead>Group & Requester</TableHead>
                <TableHead>Original Time</TableHead>
                <TableHead>Details / Changes</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                    No requests found.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map(req => (
                  <TableRow key={req.id}>
                    <TableCell className="font-medium capitalize text-muted-foreground">
                      {req.request_type}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{req.group_name}</div>
                      <div className="text-xs text-muted-foreground">by {req.requester_name}</div>
                    </TableCell>
                    <TableCell>{formatDate(req.original_datetime)}</TableCell>
                    <TableCell>
                      {req.request_type === 'reschedule' && req.new_datetime && (
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">New Time:</span>
                          <span>{formatDate(req.new_datetime)}</span>
                        </div>
                      )}
                      {req.request_type === 'substitution' && (
                        <div className="flex flex-col gap-1">
                          {req.confirmed_teacher_name ? (
                            <span className="text-sm font-medium text-green-600">
                              Confirmed: {req.confirmed_teacher_name}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Candidates: {req.substitute_teacher_names?.join(', ') || 'None'}
                            </span>
                          )}
                        </div>
                      )}
                      {req.request_type === 'cancel' && (
                        <span className="text-sm text-red-600">Lesson cancellation</span>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <div className="text-sm truncate" title={req.reason || ''}>
                        {req.reason || '-'}
                      </div>
                      {req.admin_comment && (
                        <div className="text-xs text-blue-600 mt-1 truncate" title={req.admin_comment}>
                          Comment: {req.admin_comment}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{statusBadge(req.status)}</TableCell>
                    <TableCell className="text-right align-top">
                      {req.status === 'pending_teacher' && (
                        <span className="text-xs text-muted-foreground italic">
                          Waiting for teacher confirmation
                        </span>
                      )}
                      {req.status === 'pending' && (
                        <div className="flex flex-col gap-2 items-end">
                          <Input
                            placeholder="Comment..."
                            className="h-8 w-[150px] text-xs"
                            value={adminComment[req.id] || ''}
                            onChange={e => setAdminComment(prev => ({ ...prev, [req.id]: e.target.value }))}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                              onClick={() => handleApprove(req.id)}
                              disabled={processing === req.id}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs hover:bg-red-50 hover:text-red-700 hover:border-red-200"
                              onClick={() => handleReject(req.id)}
                              disabled={processing === req.id}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
