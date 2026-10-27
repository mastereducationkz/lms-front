/**
 * The early statement's «Запланировано» block (owner, 2026-10-27): lessons and webinars of the
 * period's last three Almaty days that are not held yet, or held and waiting for the register.
 * The backend decides and prices them (`src/services/planned_lessons.py`); they are beside the
 * total, never in it, and paid only once taught and marked.
 */
import { formatDate, formatNumber } from '../../lib/i18n'
import { useT } from '../../lib/i18n/react'
import '@/lib/i18n/catalogs/teacher';

export interface PlannedPayItem {
  event_id: number
  kind: 'lesson' | 'webinar'
  title: string
  /** Almaty day, YYYY-MM-DD. */
  day: string
  minutes: number
  amount_tenge: number
  /** Held, but nobody has taken the register yet. */
  awaiting_register: boolean
}

const dayMonth = (iso: string) => formatDate(iso, { day: '2-digit', month: '2-digit' })

export function PlannedPayCard({
  items,
  plannedAmount,
  totalWithPlanned,
}: {
  items?: PlannedPayItem[] | null
  plannedAmount?: number
  totalWithPlanned?: number
}) {
  const t = useT()
  if (!items || items.length === 0) return null
  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <div className="text-foreground">
        {t('teacher.payslip.planned')}{' '}
        <span className="font-semibold">{t('teacher.payslip.amount', { amount: formatNumber(plannedAmount ?? 0) })}</span>
      </div>
      <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        {items.map((i) => (
          <li key={`${i.kind}-${i.event_id}`}>
            {dayMonth(i.day)} · {i.title} · {t('teacher.payslip.plannedMinutes', { minutes: i.minutes })} ·{' '}
            {t('teacher.payslip.amount', { amount: formatNumber(i.amount_tenge) })}
            {i.awaiting_register && (
              <span className="text-amber-700 dark:text-amber-400"> · {t('teacher.payslip.awaitingRegister')}</span>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2 font-semibold text-foreground">
        {t('teacher.payslip.totalWithPlanned', { amount: formatNumber(totalWithPlanned ?? 0) })}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{t('teacher.payslip.plannedNote')}</p>
    </div>
  )
}
