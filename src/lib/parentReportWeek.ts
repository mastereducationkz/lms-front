/**
 * Недельное окно в UI отчётов родителям.
 *
 * Считается в локальной дате браузера и отдаётся строкой `YYYY-MM-DD`, а не Date:
 * сервер сам приводит любой день недели к понедельнику по Алматы, и отправлять ему
 * ISO-таймстамп с часовым поясом браузера означало бы иногда попадать в соседнюю неделю.
 */

function iso(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Понедельник недели, в которую попадает `day`, как `YYYY-MM-DD`. */
export function mondayOf(day: Date): string {
  const copy = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  // getDay(): 0 — воскресенье. Сдвигаем так, чтобы неделя начиналась с понедельника.
  const shift = (copy.getDay() + 6) % 7;
  copy.setDate(copy.getDate() - shift);
  return iso(copy);
}

/** '2026-09-14' → '14.09 — 20.09'. */
export function weekLabel(mondayIso: string): string {
  const [y, m, d] = mondayIso.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const end = new Date(y, m - 1, d + 6);
  const fmt = (x: Date) =>
    `${`${x.getDate()}`.padStart(2, '0')}.${`${x.getMonth() + 1}`.padStart(2, '0')}`;
  return `${fmt(start)} — ${fmt(end)}`;
}

/** Смещение на `weeks` недель от переданного понедельника. */
export function shiftWeek(mondayIso: string, weeks: number): string {
  const [y, m, d] = mondayIso.split('-').map(Number);
  return iso(new Date(y, m - 1, d + weeks * 7));
}
