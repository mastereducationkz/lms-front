/**
 * Webinars and office hours on the teacher's payslip — 4000 ₸ an hour whatever the level, Meet as
 * the proof (owner, 2026-10-04). The backend decides what is paid (`src/services/webinar_pay.py`);
 * this card only says it: what is in the total, what an accountant will check, and what is not
 * paid and why — never a webinar that silently vanished.
 */
export interface WebinarPayLine {
  event_id: number
  title: string
  /** Almaty day, YYYY-MM-DD. */
  day: string
  minutes: number
  amount?: number
  evidence: 'meet' | 'no_meet' | 'host_unconfirmed' | 'host_absent' | 'pending'
  evidence_label: string
}

export interface WebinarPay {
  rate_per_hour: number
  count: number
  minutes: number
  amount: number
  items: WebinarPayLine[]
  unpaid: WebinarPayLine[]
}

const dayMonth = (iso: string) => {
  const [, month, day] = iso.split('-')
  return `${day}.${month}`
}

const hours = (minutes: number) => (Math.round((minutes / 60) * 10) / 10).toString().replace('.', ',')

export function WebinarPayCard({ webinars }: { webinars?: WebinarPay | null }) {
  if (!webinars || (webinars.count === 0 && webinars.unpaid.length === 0)) return null
  const flagged = webinars.items.filter((i) => i.evidence !== 'meet')
  return (
    <div className="rounded-md border border-gray-200 p-3 text-sm dark:border-border">
      {webinars.count > 0 && (
        <div className="text-gray-900 dark:text-gray-100">
          Вебинары и office hours: <span className="font-semibold">{webinars.count}</span> · {hours(webinars.minutes)} ч ·{' '}
          <span className="font-semibold">{webinars.amount.toLocaleString()} тг</span>
          <span className="ml-1 text-xs text-muted-foreground">
            ({webinars.rate_per_hour} ₸/час, независимо от уровня)
          </span>
        </div>
      )}
      {webinars.count > 0 && (
        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
          {webinars.items.map((i) => (
            <li key={i.event_id}>
              {dayMonth(i.day)} · {i.title} · {hours(i.minutes)} ч
              {i.evidence !== 'meet' && <span className="text-amber-700 dark:text-amber-400"> · {i.evidence_label}</span>}
            </li>
          ))}
        </ul>
      )}
      {flagged.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          Без подтверждения из Google Meet — оплачиваются, бухгалтер их проверит.
        </p>
      )}
      {webinars.unpaid.length > 0 && (
        <div className="mt-2 text-xs">
          <div className="font-medium text-gray-700 dark:text-gray-300">Вне расчёта:</div>
          <ul className="space-y-0.5 text-muted-foreground">
            {webinars.unpaid.map((i) => (
              <li key={i.event_id}>
                {dayMonth(i.day)} · {i.title} — {i.evidence_label.toLowerCase()}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
