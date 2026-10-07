import { useEffect, useState } from 'react';
import { ExternalLink, FileText, Image as ImageIcon, Link2, Loader2, Music } from 'lucide-react';
import { t as translate, type Locale, type MessageKey } from '../../lib/i18n';
import type { MaterialItem } from '../../services/api/classMaterials';
import { ApiError, SessionLost } from '../api';
import { lessons } from '../lessons';
import '@/lib/i18n/catalogs/classLesson';
import '@/lib/i18n/catalogs/materials';

/** What the panel lists: live items only (a moderated-away one is the lesson page's business). */
export function visibleMaterials(items: MaterialItem[]): MaterialItem[] {
  return [...items].filter((item) => !item.removed).sort((a, b) => a.position - b.position);
}

/**
 * «Материалы урока», open-only. Adding and editing stay on the lesson page. Opening goes through
 * the materials' own `open` endpoint (it logs the open and signs a file's URL); the window is
 * opened first, inside the click, so the browser lets it through.
 */
export default function MaterialsCard({ eventId, locale }: { eventId: number; locale: Locale }) {
  const t = (key: MessageKey) => translate(key, undefined, locale);
  const [items, setItems] = useState<MaterialItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [opening, setOpening] = useState<number | null>(null);

  useEffect(() => {
    let live = true;
    setItems(null);
    setFailed(false);
    lessons.materials(eventId)
      .then((data) => { if (live) setItems(visibleMaterials(data.items)); })
      .catch((e) => {
        if (!live) return;
        if (e instanceof ApiError && e.status === 404) setItems([]);
        else setFailed(true);
      });
    return () => { live = false; };
  }, [eventId]);

  const open = async (item: MaterialItem) => {
    const win = window.open('about:blank', '_blank');
    setOpening(item.id);
    try {
      const opened = await lessons.openMaterial(item.id);
      if (win) {
        win.opener = null; // a teacher's link must not reach back into the panel
        win.location.href = opened.url;
      }
      else window.open(opened.url, '_blank', 'noopener');
    } catch (e) {
      win?.close();
      if (!(e instanceof SessionLost)) setFailed(true);
    } finally {
      setOpening(null);
    }
  };

  if (failed) return <p className="text-xs text-muted-foreground">{t('classLesson.panel.materialsFailed')}</p>;
  if (items === null) return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  if (items.length === 0) return <p className="text-xs text-muted-foreground">{t('classLesson.panel.noMaterials')}</p>;
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => void open(item)}
            className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[13px] text-foreground transition hover:bg-muted"
          >
            {opening === item.id ? <Loader2 className="h-4 w-4 flex-none animate-spin text-muted-foreground" /> : <KindIcon item={item} />}
            <span className="min-w-0 flex-1 truncate">{item.title}</span>
            {item.hidden_until_end && <span className="flex-none text-[10px] text-muted-foreground">{t('materials.item.afterClassChip')}</span>}
            <ExternalLink className="h-3 w-3 flex-none text-muted-foreground" aria-hidden />
          </button>
        </li>
      ))}
    </ul>
  );
}

function KindIcon({ item }: { item: MaterialItem }) {
  const cls = 'h-4 w-4 flex-none text-muted-foreground';
  if (item.kind === 'link') return <Link2 className={cls} aria-hidden />;
  if (item.file?.kind === 'image') return <ImageIcon className={cls} aria-hidden />;
  if (item.file?.kind === 'audio') return <Music className={cls} aria-hidden />;
  return <FileText className={cls} aria-hidden />;
}
