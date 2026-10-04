/** «Your orca» on a student's profile: build a look from five layers, or start from a preset. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Shuffle, RotateCcw, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../contexts/AuthContext';
import apiClient from '../../services/api';
import { Button } from '../ui/button';
import Orca from './Orca';
import {
  CATEGORY_PARTS,
  makeRng,
  parseMascot,
  randomMascot,
  seedMascot,
  serializeMascot,
  type MascotCategory,
  type MascotConfig,
} from './config';
import { PRESETS } from './presets';
import { ORCA_SECTION_ID } from './KasatikSpotlight';

const TABS: { key: MascotCategory; label: string }[] = [
  { key: 'hat', label: 'Outfit & hat' },
  { key: 'eyewear', label: 'Eyewear' },
  { key: 'expression', label: 'Expression' },
  { key: 'prop', label: 'Prop' },
  { key: 'background', label: 'Background' },
];

export default function OrcaBuilder() {
  const { user, updateUser } = useAuth();
  const userId = user?.id ?? 0;
  const automatic = useMemo(() => seedMascot(userId), [userId]);
  const saved = parseMascot(user?.mascot);
  const [config, setConfig] = useState<MascotConfig>(saved ?? automatic);
  const [tab, setTab] = useState<MascotCategory>('hat');
  const [saving, setSaving] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  // Arriving from «Meet your Kasatik» → Customize: bring the builder into view.
  useEffect(() => {
    if (window.location.hash !== `#${ORCA_SECTION_ID}`) return undefined;
    const t = window.setTimeout(() => sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    return () => window.clearTimeout(t);
  }, []);

  if (!user || user.role !== 'student') return null;

  const current = serializeMascot(config);
  const savedCode = saved ? serializeMascot(saved) : serializeMascot(automatic);
  const dirty = current !== savedCode;
  const presetName = PRESETS.find((p) => serializeMascot(p.config) === current)?.name;

  const save = async (code: string | null) => {
    setSaving(true);
    try {
      const updated = await apiClient.updateMyMascot(code);
      updateUser({ ...user, mascot: updated.mascot ?? null });
      if (code === null) setConfig(automatic);
      toast.success(code === null ? 'Back to your automatic orca' : 'Your orca is saved — looking great!');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save your orca');
    } finally {
      setSaving(false);
    }
  };

  const shuffle = () => setConfig(randomMascot(makeRng(Date.now() ^ Math.floor(Math.random() * 1e9))));

  return (
    <div id={ORCA_SECTION_ID} ref={sectionRef} className="bg-white dark:bg-card rounded-2xl shadow-card p-6 max-w-2xl scroll-mt-24">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Your orca</h2>
        <p className="text-sm text-muted-foreground">
          Dress up your study buddy. It shows next to your name across the LMS.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-6">
        <div className="flex flex-col items-center gap-3 sm:w-44 shrink-0">
          <Orca config={config} size={160} className="drop-shadow-md" title="Your orca" />
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 h-5">{presetName ?? (saved ? 'Your own look' : 'Custom look')}</p>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={shuffle}>
              <Shuffle className="w-4 h-4 mr-1" /> Shuffle
            </Button>
          </div>
          <Button type="button" size="sm" className="w-full" disabled={!dirty || saving} onClick={() => save(current)}>
            <Check className="w-4 h-4 mr-1" /> {saving ? 'Saving…' : 'Save'}
          </Button>
          {saved && (
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
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-secondary text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-secondary/70'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-2" role="tabpanel">
            {CATEGORY_PARTS[tab].map((part, i) => {
              const option = { ...config, [tab]: i };
              const active = config[tab] === i;
              return (
                <button
                  key={part.key}
                  type="button"
                  title={part.label}
                  aria-label={part.label}
                  aria-pressed={active}
                  onClick={() => setConfig(option)}
                  className={`flex flex-col items-center gap-1 rounded-xl p-1.5 transition-colors ${
                    active ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500' : 'hover:bg-gray-50 dark:hover:bg-secondary'
                  }`}
                >
                  <Orca config={option} size={56} title={part.label} />
                  <span className="text-[10px] leading-tight text-center text-gray-600 dark:text-gray-400 line-clamp-2">{part.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">Ready-made looks</h3>
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
                onClick={() => setConfig(p.config)}
                className={`shrink-0 flex flex-col items-center gap-1 w-16 rounded-xl p-1 ${
                  active ? 'bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-500' : 'hover:bg-gray-50 dark:hover:bg-secondary'
                }`}
              >
                <Orca config={p.config} size={52} title={p.name} />
                <span className="text-[10px] leading-tight text-center text-gray-600 dark:text-gray-400 line-clamp-2">{p.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
