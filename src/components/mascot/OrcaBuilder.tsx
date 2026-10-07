/**
 * «Your orca» on a student's profile: build a look from six layers, or start from a preset.
 * Reward parts (achievements) show locked until earned; their unlock state comes from
 * GET /achievements/me — if that fails, every reward simply stays locked.
 *
 * A locked part can be TRIED ON (owner, 2026-10-04): it goes on the preview with a «Trying on»
 * ribbon, Save turns into «Earn <achievement> to keep it», and «Back to my look» undoes it. A
 * locked part never reaches the saved code, so the avatar everyone sees keeps earned parts only.
 * `?try=h18` (from «Try it on» on an achievement card) opens the builder already wearing it.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Shuffle, RotateCcw, Check, Lock, Undo2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/api';
import { Button } from '../ui/button';
import Orca from './Orca';
import {
  makeRng,
  parseMascot,
  randomMascot,
  seedMascot,
  serializeMascot,
  type LockedParts,
  type MascotCategory,
  type MascotConfig,
} from './config';
import OrcaPartGrid from './OrcaPartGrid';
import { getMyAchievements, type Achievement } from '../../services/api/achievements';
import { PRESETS } from './presets';
import { ORCA_SECTION_ID } from './KasatikSpotlight';
import { nextBaseline, parseTryParam, saveBlock, wearParts } from './tryOn';

const TABS: { key: MascotCategory; label: string }[] = [
  { key: 'hat', label: 'Outfit & hat' },
  { key: 'eyewear', label: 'Eyewear' },
  { key: 'expression', label: 'Expression' },
  { key: 'prop', label: 'Prop' },
  { key: 'background', label: 'Background' },
  { key: 'frame', label: 'Frame' },
];

export default function OrcaBuilder() {
  const { user, updateUser } = useAuth();
  const userId = user?.id ?? 0;
  const automatic = useMemo(() => seedMascot(userId), [userId]);
  const saved = parseMascot(user?.mascot);
  const [config, setConfig] = useState<MascotConfig>(saved ?? automatic);
  // The last look that wore nothing locked — what «Back to my look» restores.
  const [baseline, setBaseline] = useState<MascotConfig>(saved ?? automatic);
  const [tab, setTab] = useState<MascotCategory>('hat');
  const [saving, setSaving] = useState(false);
  const [locked, setLocked] = useState<LockedParts | null>(null);
  const [locksKnown, setLocksKnown] = useState(false);
  const [achievements, setAchievements] = useState<Achievement[] | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const isStudent = user?.role === 'student';

  // Which reward parts this student has earned. On failure (or an older backend) they stay locked.
  useEffect(() => {
    if (!isStudent) return undefined;
    let alive = true;
    getMyAchievements()
      .then((data) => {
        if (!alive) return;
        setLocked(data.locked_parts ?? {});
        setAchievements(data.achievements ?? []);
        setLocksKnown(true);
      })
      .catch(() => {
        if (alive) setLocksKnown(true);
      });
    return () => {
      alive = false;
    };
  }, [isStudent, user?.id]);

  // «Try it on» from an achievement card: ?try=h18 (or h17,f3) puts the rewards on the preview.
  // The param is dropped from the URL so a reload after saving doesn't put them back on.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const parts = parseTryParam(params.get('try'));
    if (parts.length === 0) return;
    setConfig((c) => wearParts(c, parts));
    setTab(parts[0].category);
    params.delete('try');
    const query = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }, []);

  // Arriving from «Meet your Kasatik» → Customize: bring the builder into view.
  useEffect(() => {
    if (window.location.hash !== `#${ORCA_SECTION_ID}`) return undefined;
    const t = window.setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    return () => window.clearTimeout(t);
  }, []);

  if (!user || !isStudent) return null;

  const current = serializeMascot(config);
  const savedCode = saved ? serializeMascot(saved) : serializeMascot(automatic);
  const dirty = current !== savedCode;
  const block = saveBlock(config, locked, achievements);
  // Only call it «trying on» once we know what's unlocked — no flash for a student wearing earned rewards.
  const tryingOn = block !== null && locksKnown;
  const presetName = PRESETS.find((p) => serializeMascot(p.config) === current)?.name;

  const pick = (next: MascotConfig) => {
    setConfig(next);
    setBaseline((b) => nextBaseline(b, next, locked));
  };

  const save = async (code: string | null) => {
    setSaving(true);
    try {
      const updated = await apiClient.updateMyMascot(code);
      updateUser({ ...user, mascot: updated.mascot ?? null });
      if (code === null) setConfig(automatic);
      setBaseline(code === null ? automatic : config);
      toast.success(code === null ? 'Back to your automatic orca' : 'Your orca is saved — looking great!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save your orca');
    } finally {
      setSaving(false);
    }
  };

  const shuffle = () => pick(randomMascot(makeRng(Date.now() ^ Math.floor(Math.random() * 1e9))));

  return (
    <div id={ORCA_SECTION_ID} ref={sectionRef} className="bg-card rounded-2xl shadow-card p-6 max-w-2xl scroll-mt-24">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">Your orca</h2>
        <p className="text-sm text-muted-foreground">
          Dress up your study buddy. It shows next to your name across the LMS.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        <div className="flex flex-col items-center gap-3 sm:w-48 shrink-0">
          <div className="relative">
            <Orca config={config} size={160} className={`drop-shadow-md ${tryingOn ? 'ring-4 ring-amber-300/70 rounded-full' : ''}`} title="Your orca" />
            {tryingOn && (
              <span className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-semibold text-amber-950 shadow">
                <Eye className="mr-1 inline h-3 w-3 align-[-2px]" aria-hidden />Trying on
              </span>
            )}
          </div>
          <p className="text-sm font-medium text-gray-700 dark:text-foreground h-5">
            {tryingOn ? block.partName : presetName ?? (saved ? 'Your own look' : 'Custom look')}
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={shuffle}>
              <Shuffle className="w-4 h-4 mr-1" /> Shuffle
            </Button>
          </div>
          {block ? (
            <Button type="button" size="sm" className="w-full h-auto whitespace-normal py-2 leading-snug" disabled>
              <Lock className="w-4 h-4 mr-1 shrink-0" /> {block.label}
            </Button>
          ) : (
            <Button type="button" size="sm" className="w-full" disabled={!dirty || saving} onClick={() => save(current)}>
              <Check className="w-4 h-4 mr-1" /> {saving ? 'Saving…' : 'Save'}
            </Button>
          )}
          {/* How to earn the part and the progress so far; nothing to show if the achievements didn't load. */}
          {block && (block.howTo || (block.progress && block.progress.target > 0) || block.moreAchievements > 0) && (
            <div className="w-full rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 p-3 text-xs" role="status">
              {block.howTo && <p className="text-foreground">{block.howTo}</p>}
              {block.progress && block.progress.target > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-2 flex-1 rounded-full bg-amber-100 dark:bg-amber-950 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-amber-500"
                      style={{ width: `${Math.min(100, Math.round((block.progress.current / Math.max(1, block.progress.target)) * 100))}%` }}
                    />
                  </div>
                  <span className="font-medium tabular-nums text-gray-700 dark:text-foreground">
                    {Math.min(block.progress.current, block.progress.target)} / {block.progress.target}
                  </span>
                </div>
              )}
              {block.moreAchievements > 0 && (
                <p className="mt-1 text-muted-foreground">
                  This look also needs {block.moreAchievements} more {block.moreAchievements === 1 ? 'achievement' : 'achievements'}.
                </p>
              )}
            </div>
          )}
          {block && (
            <Button type="button" variant="outline" size="sm" className="w-full" onClick={() => setConfig(baseline)}>
              <Undo2 className="w-4 h-4 mr-1" /> Back to my look
            </Button>
          )}
          {saved && !block && (
            <button
              type="button"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
              disabled={saving}
              onClick={() => save(null)}
            >
              <RotateCcw className="w-3 h-3" /> Reset to automatic
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-3" role="tablist" aria-label="Orca parts">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={tab === t.key}
                onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  tab === t.key
                    ? 'bg-brand-solid text-brand-solid-foreground dark:bg-brand-surface dark:text-brand-subtle-foreground dark:shadow-[inset_0_0_0_1px_hsl(var(--brand-border))]'
                    : 'bg-muted text-gray-700 dark:text-foreground hover:bg-gray-200 dark:hover:bg-secondary/70'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <OrcaPartGrid tab={tab} config={config} locked={locked} onPick={pick} />
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-foreground mb-2">Ready-made looks</h3>
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {PRESETS.map((p) => {
            const active = serializeMascot(p.config) === current;
            return (
              <button
                key={p.name}
                type="button"
                title={p.name}
                aria-label={p.name}
                aria-pressed={active}
                onClick={() => pick(p.config)}
                className={`shrink-0 flex flex-col items-center gap-1 w-16 rounded-xl p-1 ${
                  active ? 'bg-brand-surface ring-2 ring-ring' : 'hover:bg-muted'
                }`}
              >
                <Orca config={p.config} size={52} title={p.name} />
                <span className="text-[10px] leading-tight text-center text-muted-foreground line-clamp-2">{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
