import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '../../components/ui/button';
import RecordView from '../../components/offboarding/RecordView';
import { useAuth } from '../../contexts/AuthContext';
import { useOffboardingConfig } from '../../hooks/useOffboardingConfig';
import { getOffboarding, type OffboardingRecord } from '../../services/api/offboarding';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/offboarding';

/** One offboarding record: steps, checklist, Reactivate (SPEC §9). */
export default function OffboardingRecordPage() {
  const t = useT();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const config = useOffboardingConfig(user?.role);
  const viewerId = user?.id != null ? Number(user.id) : null;
  const [record, setRecord] = useState<OffboardingRecord | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRecord(await getOffboarding(Number(id)));
    } catch (e) {
      setError((e instanceof Error && e.message) || t('offboarding.record.loadFailed'));
    }
  }, [id, t]);

  useEffect(() => {
    if (config?.enabled) load();
  }, [config?.enabled, load]);

  if (config && !config.enabled) {
    return <p className="p-6 text-sm text-muted-foreground">{t('offboarding.page.disabled')}</p>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Button variant="ghost" asChild className="-ml-2 w-fit pl-0 text-muted-foreground">
        <Link to="/admin/offboarding"><ChevronLeft className="mr-2 h-4 w-4" aria-hidden="true" />{t('offboarding.record.back')}</Link>
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {record && <RecordView record={record} viewerId={viewerId} onChanged={setRecord} />}
    </div>
  );
}
