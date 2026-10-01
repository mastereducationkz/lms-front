import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, FolderPlus, Loader2, RotateCcw, Search } from 'lucide-react';
import { Button } from '../ui/button';
import MaterialViewer from '../class-materials/MaterialViewer';
import SectionCard from './SectionCard';
import { SectionNameDialog } from './SectionDialogs';
import type { MaterialItem } from '../../services/api/classMaterials';
import {
  createLibrarySection, getLibrary, getMyLibrary, openLibraryItem, reorderLibrarySections,
  type LibraryProgram, type LibrarySection, type LibraryView, type MyLibrary,
} from '../../services/api/library';
import { t, type Locale } from '../../lib/classMaterials';
import { filterLibrary, filterSection, hasAnyItems, moveId, programLabel, withoutOwnSections } from '../../lib/library';

interface Props {
  locale: Locale;
  role: string | undefined;
}

type NewSectionTarget = { scope: 'teacher' } | { scope: 'program'; program: LibraryProgram };

const SEARCH_CLASS =
  'h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-search-cancel-button]:hidden';

/**
 * «Библиотека» (docs/materials-library/SPEC.md §9): the viewer's whole library from one call —
 * «Мои разделы» for a teacher, the program libraries (stacked for a student, one at a time behind
 * program pills for staff), then the sections teachers shared with the viewer's groups. Search
 * filters titles on the client; every change refetches the library rather than patching it.
 */
export default function LibraryTab({ locale, role }: Props) {
  const [view, setView] = useState<LibraryView | null>(null);
  const [mine, setMine] = useState<MyLibrary | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [query, setQuery] = useState('');
  const [program, setProgram] = useState<LibraryProgram | null>(null);
  const [newSection, setNewSection] = useState<NewSectionTarget | null>(null);
  const [viewerItem, setViewerItem] = useState<MaterialItem | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);

  const isStudent = role === 'student';

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    getLibrary()
      .then(async (next) => {
        const own = next.can_create_teacher_sections ? await getMyLibrary() : null;
        if (cancelled) return;
        setView(next);
        setMine(own);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  const reload = useCallback(() => setReloadKey((n) => n + 1), []);
  const openItem = useCallback((item: MaterialItem) => {
    setViewerItem(item);
    setViewerOpen(true);
  }, []);

  const shown = useMemo(() => (view ? filterLibrary(view, query) : null), [view, query]);
  const ownSections = useMemo(
    () => (mine ? mine.sections.map((s) => filterSection(s, query)).filter((s): s is LibrarySection => s !== null) : []),
    [mine, query],
  );
  const groupBlocks = useMemo(
    () => (shown ? withoutOwnSections(shown.groups, (mine?.sections ?? []).map((s) => s.id)) : []),
    [shown, mine],
  );

  if (failed && !view) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-10 text-center shadow-sm">
        <p className="text-sm text-muted-foreground">{t('loadFailed', locale)}</p>
        <button
          type="button"
          onClick={reload}
          className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-muted"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('retry', locale)}
        </button>
      </div>
    );
  }
  if (!view || !shown) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
      </div>
    );
  }

  const usePills = !isStudent && view.programs.length > 1;
  // Staff land on the first program that has sections, so the pills open on something to read.
  const activeProgram = program ?? (view.programs.find((p) => p.sections.length > 0) ?? view.programs[0])?.program ?? null;
  const searching = query.trim().length > 0;
  // Staff see one program at a time (a search looks through all of them); a student sees every
  // program they study that has something in it.
  const programBlocks = usePills && !searching
    ? shown.programs.filter((p) => p.program === activeProgram)
    : shown.programs.filter((p) => !isStudent || p.sections.length > 0);
  const nothingAtAll = isStudent && !hasAnyItems(view);

  const moveSection = (sections: LibrarySection[], id: number, direction: -1 | 1) => {
    const next = moveId(sections.map((s) => s.id), id, direction);
    if (next) void reorderLibrarySections(next).then(reload, reload);
  };

  const canUnshare = role === 'teacher' || role === 'head_teacher' || role === 'admin';

  const renderSections = (
    sections: LibrarySection[],
    opts: { reorder: boolean; defaultOpen: boolean; unshareFromGroupId?: number },
  ) =>
    sections.map((section, index) => (
      <SectionCard
        key={section.id}
        section={section}
        locale={locale}
        onOpenItem={openItem}
        onChanged={reload}
        defaultOpen={opts.defaultOpen}
        shareableGroups={mine?.shareable_groups}
        onMove={opts.reorder && !searching ? (direction) => moveSection(sections, section.id, direction) : undefined}
        canMoveUp={index > 0}
        canMoveDown={index < sections.length - 1}
        unshareFromGroupId={opts.unshareFromGroupId}
      />
    ));

  return (
    <div className="space-y-5">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('librarySearch', locale)}
          aria-label={t('librarySearch', locale)}
          className={SEARCH_CLASS}
        />
      </div>

      {nothingAtAll && (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-card/60 px-4 py-10 text-center">
          <BookOpen className="h-6 w-6 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">{t('libraryEmpty', locale)}</p>
        </div>
      )}

      {mine && (
        <section className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">{t('mySections', locale)}</h2>
            <Button type="button" variant="outline" size="sm" className="h-11 gap-1.5 sm:h-9" onClick={() => setNewSection({ scope: 'teacher' })}>
              <FolderPlus className="h-4 w-4" aria-hidden />
              {t('newSection', locale)}
            </Button>
          </div>
          {mine.sections.length === 0 && <p className="text-sm text-muted-foreground">{t('mySectionsHint', locale)}</p>}
          {renderSections(ownSections, { reorder: true, defaultOpen: false })}
        </section>
      )}

      {usePills && !searching && (
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="tablist" aria-label={t('tabLibrary', locale)}>
          {view.programs.map((p) => (
            <button
              key={p.program}
              type="button"
              role="tab"
              aria-selected={p.program === activeProgram}
              onClick={() => setProgram(p.program)}
              className={`h-11 flex-none rounded-full border px-4 text-sm font-medium transition sm:h-9 ${
                p.program === activeProgram
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-card text-foreground hover:bg-muted'
              }`}
            >
              {programLabel(p.program)}
            </button>
          ))}
        </div>
      )}

      {programBlocks.map((block) => (
        <section key={block.program} className="space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-foreground">
              {t('libraryOf', locale)} {block.label || programLabel(block.program)}
            </h2>
            {block.can_manage && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-11 gap-1.5 sm:h-9"
                onClick={() => setNewSection({ scope: 'program', program: block.program })}
              >
                <FolderPlus className="h-4 w-4" aria-hidden />
                {t('newSection', locale)}
              </Button>
            )}
          </div>
          {block.sections.length === 0 && !isStudent && (
            <p className="text-sm text-muted-foreground">{searching ? t('searchNothing', locale) : t('programEmpty', locale)}</p>
          )}
          {renderSections(block.sections, { reorder: block.can_manage, defaultOpen: true })}
        </section>
      ))}

      {groupBlocks.map((block) => (
        <section key={block.group_id} className="space-y-2.5">
          <h2 className="break-words text-base font-semibold text-foreground">
            {t('fromTeacher', locale)} — {block.group_name}
            {block.teacher_name && <span className="block text-xs font-normal text-muted-foreground">{block.teacher_name}</span>}
          </h2>
          {renderSections(block.sections, {
            reorder: false,
            defaultOpen: isStudent,
            unshareFromGroupId: canUnshare ? block.group_id : undefined,
          })}
        </section>
      ))}

      {searching && programBlocks.length === 0 && groupBlocks.length === 0 && ownSections.length === 0 && (
        <p className="rounded-xl border border-dashed border-border bg-card/60 px-4 py-10 text-center text-sm text-muted-foreground">
          {t('searchNothing', locale)}
        </p>
      )}

      <SectionNameDialog
        open={newSection !== null}
        onOpenChange={(next) => {
          if (!next) setNewSection(null);
        }}
        locale={locale}
        offerTeachersOnly={newSection?.scope === 'program'}
        onSubmit={async ({ title, teachers_only }) => {
          if (!newSection) return;
          await createLibrarySection(
            newSection.scope === 'program'
              ? { scope: 'program', program_type: newSection.program, title, teachers_only }
              : { scope: 'teacher', title },
          );
          reload();
        }}
      />

      <MaterialViewer
        item={viewerItem}
        open={viewerOpen}
        onOpenChange={(next) => {
          setViewerOpen(next);
          if (!next) setViewerItem(null);
        }}
        locale={locale}
        openItem={openLibraryItem}
      />
    </div>
  );
}
