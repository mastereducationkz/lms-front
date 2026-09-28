import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, Download, CheckCircle2, AlertCircle, BarChart3, Lightbulb } from 'lucide-react';
import { exportAnalyticsExcel } from '../services/api';

interface ExportToExcelModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseId: string;
  courseName: string;
  groups?: Array<{ id?: number; group_id?: number; name?: string; group_name?: string }>;
}

export default function ExportToExcelModal({
  open,
  onOpenChange,
  courseId,
  courseName,
  groups = []
}: ExportToExcelModalProps) {
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [isExporting, setIsExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{
    success: boolean;
    error?: string;
  } | null>(null);

  const handleExport = async () => {
    setIsExporting(true);
    setExportResult(null);

    try {
      // Only pass groupId if it's not "all"
      const groupId = selectedGroup && selectedGroup !== 'all' ? parseInt(selectedGroup) : undefined;
      const blob = await exportAnalyticsExcel(parseInt(courseId), groupId);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Generate filename
      const selectedGroupObj = groups.find(g => (g.group_id || g.id) === groupId);
      const groupSuffix = groupId && selectedGroupObj ? `_${selectedGroupObj.group_name || selectedGroupObj.name || 'Group'}` : '';
      const filename = `Analytics_${courseName.replace(/\s+/g, '_')}${groupSuffix}_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.setAttribute('download', filename);
      
      // Trigger download
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setExportResult({
        success: true
      });
    } catch (error: any) {
      setExportResult({
        success: false,
        error: error.response?.data?.detail || 'Failed to export analytics to Excel. Please try again.'
      });
    } finally {
      setIsExporting(false);
    }
  };

  const handleClose = () => {
    setExportResult(null);
    setSelectedGroup('all');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Export Analytics to Excel</DialogTitle>
          <DialogDescription>
            Download Excel file with detailed analytics and charts for <strong>{courseName}</strong>
          </DialogDescription>
        </DialogHeader>

        {!exportResult ? (
          <div className="space-y-4 py-4">
            {groups.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="group">Filter by Group (Optional)</Label>
                <Select value={selectedGroup} onValueChange={setSelectedGroup} disabled={isExporting}>
                  <SelectTrigger id="group">
                    <SelectValue placeholder="All students" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All students</SelectItem>
                    {groups.map((group) => {
                      const groupId = group.group_id || group.id;
                      const groupName = group.group_name || group.name;
                      if (!groupId) return null; // Skip groups without ID
                      return (
                        <SelectItem key={groupId} value={groupId.toString()}>
                          {groupName || 'Unknown Group'}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Alert>
              <AlertDescription className="text-sm">
                <strong>Excel file will include:</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li><strong>Student Progress</strong> - detailed metrics with color coding</li>
                  <li><strong>Course Overview</strong> - course statistics and structure</li>
                  {selectedGroup === 'all' && <li><strong>Groups Summary</strong> - group performance comparison</li>}
                  <li><strong>Charts & Analytics</strong> - visual progress distribution and comparisons</li>
                </ul>
                <p className="mt-3 flex items-center gap-1.5 text-xs">
                  <BarChart3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  File includes interactive charts and conditional formatting
                </p>
              </AlertDescription>
            </Alert>
          </div>
        ) : exportResult.success ? (
          <div className="space-y-4 py-4">
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Export successful!</strong>
                <p className="mt-2">
                  Your Excel file has been downloaded. Check your downloads folder.
                </p>
                <p className="mt-2 flex items-start gap-1.5 text-xs">
                  <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-px" aria-hidden="true" />
                  Tip: You can upload the Excel file to Google Sheets for online collaboration
                </p>
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Export failed</strong>
                <p className="mt-2">{exportResult.error}</p>
              </AlertDescription>
            </Alert>

            <Button onClick={() => setExportResult(null)} variant="outline" className="w-full">
              Try Again
            </Button>
          </div>
        )}

        <DialogFooter>
          {!exportResult ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isExporting}>
                Cancel
              </Button>
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    Export to Excel
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose} variant="outline">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
