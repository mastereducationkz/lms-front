import { useState, useEffect } from 'react';
import { getMyLessonRequests, getIncomingRequests, confirmLessonRequest, declineLessonRequest } from '../services/api';
import type { LessonRequest } from '../types';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Loader2 } from 'lucide-react';

export default function MyLessonRequests() {
  const [outgoing, setOutgoing] = useState<LessonRequest[]>([]);
  const [incoming, setIncoming] = useState<LessonRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [myReqs, incReqs] = await Promise.all([
        getMyLessonRequests(),
        getIncomingRequests(true) // Fetch history
      ]);
      setOutgoing(myReqs);
      setIncoming(incReqs);
    } catch (error) {
      console.error('Failed to load requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id: number) => {
    try {
      setActionLoading(id);
      await confirmLessonRequest(id);
      await loadData(); // Reload to refresh lists
    } catch (error) {
      console.error('Failed to confirm request:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (id: number) => {
    try {
      setActionLoading(id);
      await declineLessonRequest(id);
      await loadData();
    } catch (error) {
      console.error('Failed to decline request:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
        case 'approved': return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">Approved</Badge>;
        case 'rejected': return <Badge variant="destructive">Rejected</Badge>;
        case 'pending': return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">Pending Admin</Badge>;
        case 'pending_teacher': return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">Waiting for Teacher</Badge>;
        default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Separate incoming into pending (action needed) and history
  const incomingPending = incoming.filter(r => r.status === 'pending_teacher');
  const incomingHistory = incoming.filter(r => r.status !== 'pending_teacher');

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-5xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Lesson Requests</h1>
        <p className="text-muted-foreground mt-1">Manage your substitution and reschedule requests</p>
      </div>

      <Tabs defaultValue="outgoing" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-md mb-8">
          <TabsTrigger value="outgoing">My Requests</TabsTrigger>
          <TabsTrigger value="incoming">Incoming Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="outgoing">
             <Card>
                <CardHeader className="px-6 py-4 border-b">
                    <CardTitle className="text-lg">My Outgoing Requests</CardTitle>
                    <CardDescription>Requests you have sent</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Type</TableHead>
                                <TableHead>Group</TableHead>
                                <TableHead>Original Time</TableHead>
                                <TableHead>Details</TableHead>
                                <TableHead>Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {outgoing.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        No outgoing requests found.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                outgoing.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell className="font-medium capitalize text-muted-foreground">
                                            {req.request_type}
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            {req.group_name}
                                        </TableCell>
                                        <TableCell>
                                            {new Date(req.original_datetime).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            {req.reason && <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">Reason: {req.reason}</div>}
                                            {req.request_type === 'reschedule' && req.new_datetime && (
                                                <div className="text-xs">
                                                    New Time: <span className="font-medium">{new Date(req.new_datetime).toLocaleString()}</span>
                                                </div>
                                            )}
                                            {req.request_type === 'substitution' && (
                                                <div className="text-xs">
                                                    {req.confirmed_teacher_name ? (
                                                        <span className="text-green-600 font-medium">Confirmed: {req.confirmed_teacher_name}</span>
                                                    ) : (
                                                        <span className="text-muted-foreground">
                                                            {req.substitute_teacher_names?.length 
                                                                ? `Candidates: ${req.substitute_teacher_names.join(', ')}`
                                                                : 'No candidates selected'}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(req.status)}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
             </Card>
        </TabsContent>

        <TabsContent value="incoming" className="space-y-6">
            {/* Active Requests */}
            <Card>
                <CardHeader className="px-6 py-4 border-b bg-blue-50/30 dark:bg-blue-900/10">
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="text-lg text-blue-800 dark:text-blue-400">New Opportunities</CardTitle>
                            <CardDescription>Substitution requests requiring your action</CardDescription>
                        </div>
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
                            {incomingPending.length} New
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Requester</TableHead>
                                <TableHead>Group</TableHead>
                                <TableHead>Time</TableHead>
                                <TableHead>Reason</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                             {incomingPending.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                        No new requests at the moment.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                incomingPending.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell className="font-medium">
                                            {req.requester_name}
                                        </TableCell>
                                        <TableCell>
                                            {req.group_name}
                                        </TableCell>
                                        <TableCell>
                                            {new Date(req.original_datetime).toLocaleString()}
                                        </TableCell>
                                        <TableCell className="max-w-[200px] truncate" title={req.reason || ''}>
                                            {req.reason || '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm"
                                                    onClick={() => handleDecline(req.id)}
                                                    disabled={actionLoading === req.id}
                                                    className="h-8 text-xs text-muted-foreground hover:text-red-600 hover:bg-red-50"
                                                >
                                                    Decline
                                                </Button>
                                                <Button 
                                                    size="sm"
                                                    onClick={() => handleConfirm(req.id)}
                                                    disabled={actionLoading === req.id}
                                                    className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                                                >
                                                    {actionLoading === req.id && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                                    Accept
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* History */}
            {incomingHistory.length > 0 && (
                <Card>
                    <CardHeader className="px-6 py-4 border-b">
                        <CardTitle className="text-lg">Accepted Requests</CardTitle>
                        <CardDescription>Substitutions you have accepted</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Requester</TableHead>
                                    <TableHead>Group</TableHead>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {incomingHistory.map(req => (
                                    <TableRow key={req.id}>
                                        <TableCell className="font-medium text-muted-foreground">
                                            {req.requester_name}
                                        </TableCell>
                                        <TableCell>
                                            {req.group_name}
                                        </TableCell>
                                        <TableCell>
                                            {new Date(req.original_datetime).toLocaleString()}
                                        </TableCell>
                                        <TableCell>
                                            {getStatusBadge(req.status)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
