import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Alert, AlertDescription } from './ui/alert';
import { Loader2, Download, CheckCircle2, AlertCircle, BarChart3, Lightbulb } from 'lucide-react';
import { exportAnalyticsExcel } from '../services/api';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/teacherDesk';

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
  const t = useT();
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
        error: error.response?.data?.detail || t('teacherDesk.export.failed')
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
          <DialogTitle>{t('teacherDesk.export.title')}</DialogTitle>
          <DialogDescription>
            {t('teacherDesk.export.description').split(/\{(\w+)\}/).map((part, i) => (i % 2 ? <strong key={i}>{courseName}</strong> : part))}
          </DialogDescription>
        </DialogHeader>

        {!exportResult ? (
          <div className="space-y-4 py-4">
            {groups.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="group">{t('teacherDesk.export.groupFilter')}</Label>
                <Select value={selectedGroup} onValueChange={setSelectedGroup} disabled={isExporting}>
                  <SelectTrigger id="group">
                    <SelectValue placeholder={t('teacherDesk.export.allStudents')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('teacherDesk.export.allStudents')}</SelectItem>
                    {groups.map((group) => {
                      const groupId = group.group_id || group.id;
                      const groupName = group.group_name || group.name;
                      if (!groupId) return null; // Skip groups without ID
                      return (
                        <SelectItem key={groupId} value={groupId.toString()}>
                          {groupName || t('teacherDesk.export.unknownGroup')}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Alert>
              <AlertDescription className="text-sm">
                <strong>{t('teacherDesk.export.includes')}</strong>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li><strong>{t('teacherDesk.export.sheetProgress')}</strong> — {t('teacherDesk.export.sheetProgressHint')}</li>
                  <li><strong>{t('teacherDesk.progress.courseOverview')}</strong> — {t('teacherDesk.export.sheetCourseHint')}</li>
                  {selectedGroup === 'all' && <li><strong>{t('teacherDesk.export.sheetGroups')}</strong> — {t('teacherDesk.export.sheetGroupsHint')}</li>}
                  <li><strong>{t('teacherDesk.export.sheetCharts')}</strong> — {t('teacherDesk.export.sheetChartsHint')}</li>
                </ul>
                <p className="mt-3 flex items-center gap-1.5 text-xs">
                  <BarChart3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  {t('teacherDesk.export.chartsNote')}
                </p>
              </AlertDescription>
            </Alert>
          </div>
        ) : exportResult.success ? (
          <div className="space-y-4 py-4">
            <Alert className="border-green-500 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>{t('teacherDesk.export.success')}</strong>
                <p className="mt-2">
                  {t('teacherDesk.export.downloaded')}
                </p>
                <p className="mt-2 flex items-start gap-1.5 text-xs">
                  <Lightbulb className="h-3.5 w-3.5 shrink-0 mt-px" aria-hidden="true" />
                  {t('teacherDesk.export.tip')}
                </p>
              </AlertDescription>
            </Alert>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>{t('teacherDesk.export.failedTitle')}</strong>
                <p className="mt-2">{exportResult.error}</p>
              </AlertDescription>
            </Alert>

            <Button onClick={() => setExportResult(null)} variant="outline" className="w-full">
              {t('teacherDesk.export.tryAgain')}
            </Button>
          </div>
        )}

        <DialogFooter>
          {!exportResult ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isExporting}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('teacherDesk.export.exporting')}
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-4 w-4" />
                    {t('teacherDesk.export.submit')}
                  </>
                )}
              </Button>
            </>
          ) : (
            <Button onClick={handleClose} variant="outline">
              {t('common.close')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
