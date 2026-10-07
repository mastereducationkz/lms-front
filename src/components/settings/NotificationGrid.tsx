import { Checkbox } from '../ui/checkbox';
import { useT } from '../../lib/i18n/react';
import '@/lib/i18n/catalogs/settings';
import type { MessageKey } from '../../lib/i18n';
import { cellFor, columnAvailable, matrixColumns, type ColumnKey } from '../../lib/notificationMatrix';
import type { NotificationSettings } from '../../services/api/notificationCenter';

const channelKey = (column: ColumnKey) => `settings.notifications.channel.${column}` as MessageKey;

/**
 * Events × channels. A table once the panel is wide enough (its own @container); below that each
 * event is a block with its switches in a wrapping row, so nothing scrolls sideways at 390 px.
 */
export default function NotificationGrid({
  settings,
  onToggle,
}: {
  settings: NotificationSettings;
  onToggle: (eventKey: string, column: ColumnKey, on: boolean) => void;
}) {
  const t = useT();
  const columns = matrixColumns(settings);
  const cols = `minmax(0,1fr) repeat(${columns.length}, 5.5rem)`;

  const cell = (eventKey: string, column: ColumnKey, wide: boolean) => {
    const event = settings.events.find((e) => e.key === eventKey)!;
    const c = cellFor(event, column);
    const name = t(channelKey(column));
    if (!c.present) return wide ? <span className="text-muted-foreground/50" aria-hidden>·</span> : null;
    const id = `n-${eventKey}-${column}-${wide ? 'w' : 'n'}`;
    const box = (
      <Checkbox
        id={id}
        checked={c.enabled}
        disabled={c.locked}
        onCheckedChange={(v) => onToggle(eventKey, column, v === true)}
        aria-label={t('settings.notifications.toggle', { event: event.label, channel: name })}
        className="data-[state=checked]:border-brand-solid data-[state=checked]:bg-brand-solid data-[state=checked]:text-brand-solid-foreground disabled:opacity-60"
      />
    );
    if (wide) return box;
    return (
      <label htmlFor={id} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border px-2.5 text-sm text-foreground">
        {box}
        <span>{name}</span>
      </label>
    );
  };

  return (
    <>
      {/* Wide: a real grid with one header row. */}
      <div role="table" aria-label={t('settings.notifications.title')} className="hidden @2xl:block">
        <div role="row" className="grid items-end gap-x-2 border-b border-border px-5 py-3" style={{ gridTemplateColumns: cols }}>
          <div role="columnheader" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {t('settings.notifications.event')}
          </div>
          {columns.map((column) => (
            <div role="columnheader" key={column} className="text-center text-xs font-medium text-muted-foreground">
              <div className="text-foreground">{t(channelKey(column))}</div>
              <div className="mt-0.5 text-[11px] leading-tight">
                {column === 'in_app'
                  ? t('settings.notifications.alwaysOn')
                  : columnAvailable(settings, column)
                    ? '\u00a0'
                    : t('settings.notifications.notConnected')}
              </div>
            </div>
          ))}
        </div>
        {settings.events.map((event) => (
          <div role="row" key={event.key} className="grid items-center gap-x-2 border-t border-border px-5 py-3 first-of-type:border-t-0" style={{ gridTemplateColumns: cols }}>
            <div role="cell" className="min-w-0">
              <div className="text-sm font-medium text-foreground">{event.label}</div>
              <div className="text-sm text-muted-foreground [text-wrap:pretty]">{event.description}</div>
            </div>
            {columns.map((column) => (
              <div role="cell" key={column} className="flex justify-center">
                {cell(event.key, column, true)}
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Narrow: one block per event. */}
      <ul className="divide-y divide-border @2xl:hidden">
        {settings.events.map((event) => (
          <li key={event.key} className="px-4 py-4 sm:px-5">
            <div className="text-sm font-medium text-foreground">{event.label}</div>
            <div className="text-sm text-muted-foreground [text-wrap:pretty]">{event.description}</div>
            {/* In-app is always on (the section says so), so a phone shows only the switchable ones. */}
            <div className="mt-3 flex flex-wrap gap-2">
              {columns
                .filter((column) => column !== 'in_app' && cellFor(event, column).present)
                .map((column) => (
                  <span key={column}>{cell(event.key, column, false)}</span>
                ))}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
