import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GraduationCap, MessageCircle, Users } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.tsx';
import { getMyChildren, type ParentChild } from '../services/api';
import { ChildTargets } from '../components/parents/ChildTargets';
import Skeleton from '../components/Skeleton.tsx';
import { useT } from '../lib/i18n/react';
import '@/lib/i18n/catalogs/parent';

export default function ParentDashboard() {
  const { user } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const [children, setChildren] = useState<ParentChild[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const data = await getMyChildren();
      if (active) {
        setChildren(data);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const firstName = user?.name?.split(' ')[0] || t('parent.dashboard.nameFallback');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground dark:text-foreground">{t('parent.dashboard.greeting', { name: firstName })}</h1>
        <p className="text-muted-foreground mt-1">
          {t('parent.dashboard.subtitle')}
        </p>
      </div>

      <section>
        <h2 className="text-lg font-semibold text-foreground dark:text-foreground mb-4 flex items-center gap-2">
          <Users className="w-5 h-5" /> {t('parent.dashboard.children')}
        </h2>

        {loading ? (
          <div className="grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="card p-5">
                <Skeleton className="h-6 w-40 mb-3" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        ) : children.length > 0 ? (
          <div className="grid grid-cols-1 @2xl:grid-cols-2 @4xl:grid-cols-3 gap-4">
            {children.map((child) => (
              <div key={child.id} className="card p-5">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-brand-subtle flex items-center justify-center text-brand font-bold">
                    {child.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground dark:text-foreground truncate">{child.name}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
                      <GraduationCap className="w-4 h-4 shrink-0" />
                      {child.group_name || t('parent.dashboard.noGroup')}
                    </p>
                  </div>
                </div>
                <ChildTargets studentId={child.id} />
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-6 text-center text-muted-foreground">
            {t('parent.dashboard.noChildren')}
          </div>
        )}
      </section>

      <section>
        <div className="card p-6 flex flex-col @xl:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-full bg-brand-solid flex items-center justify-center text-white shrink-0">
              <MessageCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="font-semibold text-foreground dark:text-foreground">{t('parent.dashboard.contactTitle')}</p>
              <p className="text-sm text-muted-foreground">
                {t('parent.dashboard.contactBody')}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/chat')}
            className="px-4 py-2 bg-brand-solid text-white rounded-lg hover:bg-brand-solid-hover transition-colors shrink-0"
          >
            {t('parent.dashboard.openChat')}
          </button>
        </div>
      </section>
    </div>
  );
}
