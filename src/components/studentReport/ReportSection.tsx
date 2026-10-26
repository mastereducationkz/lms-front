import { formatDate } from '@/lib/i18n';

/** A report block: a titled card. Shared by the student report page and its extracted sections. */
export function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-3">
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  return formatDate(iso, { day: 'numeric', month: 'long', year: 'numeric' }) || '—';
};
