import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import { mediaUrl } from '@/lib/mediaUrl';
import { useT } from '@/lib/i18n/react';
import { reasonCodeOf } from '@/services/api/apiError';
import { sendBeat, sendBeatOnExit, type BeatBody, type BeatResult, type ClipDetail } from '@/services/api/staffTraining';
import Segmented from './Segmented';
import SegmentList from './SegmentList';
import { useSubtitleTracks } from './useSubtitleTracks';
import { WatchTracker, beatEveryMs, resumeAtMs, type Interval } from './watchTracker';
import { formatClock } from './model';
import '@/lib/i18n/catalogs/staffTraining';

export interface PlayerHandle {
  /** Jump to `ms` and play (a wrong answer's «Показать момент»). The jump itself is never counted as watched. */
  seekTo(ms: number): void;
}

interface Props {
  clip: ClipDetail;
  locale: 'ru' | 'en';
  /** A beat came back: the page unlocks the questions on `watched`. */
  onBeat: (result: BeatResult) => void;
  /** The clip changed under the viewer (409): the page loads it again. */
  onChanged: () => void;
}

type SubChoice = 'off' | 'ru' | 'en';
const SUBS_KEY = 'st:subtitles';
const RATES = [1, 1.25, 1.5] as const;

function storedChoice(): SubChoice | null {
  try {
    const value = localStorage.getItem(SUBS_KEY);
    return value === 'off' || value === 'ru' || value === 'en' ? value : null;
  } catch {
    return null;
  }
}

/**
 * The clip player (CONTRACTS §8): a plain <video> on the MP4, the two subtitle tracks as blobs, resume from the
 * saved position, and the watched seconds reported as beats. What counts is only what played: a seek, however far,
 * starts a new interval and adds nothing to the one before it.
 */
const ClipPlayer = forwardRef<PlayerHandle, Props>(function ClipPlayer({ clip, locale, onBeat, onChanged }, ref) {
  const t = useT();
  const video = useRef<HTMLVideoElement>(null);
  const tracker = useRef(new WatchTracker());
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const latest = useRef({ clip, onBeat, onChanged });
  const sentPosition = useRef(clip.progress.last_position_ms);
  latest.current = { clip, onBeat, onChanged };

  const { tracks, failed: subsFailed } = useSubtitleTracks(clip.subtitles);
  const [choice, setChoice] = useState<SubChoice>(() => storedChoice() ?? clip.subtitles.find((s) => s.default)?.lang ?? 'ru');
  const [rate, setRate] = useState<number>(1);
  const [nowMs, setNowMs] = useState(0);
  const [pct, setPct] = useState(clip.progress.watch_pct);
  const [resumedAt, setResumedAt] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);

  useImperativeHandle(ref, () => ({
    seekTo(ms: number) {
      const el = video.current;
      if (!el) return;
      el.currentTime = ms / 1000;
      void el.play()?.catch(() => undefined);
      el.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    },
  }), []);

  /** Sends what played since the last beat. `always` also sends the position when nothing played (pause, seek, end). */
  const beat = useCallback((always: boolean, exit = false) => {
    const el = video.current;
    if (!el) return;
    const { clip: current } = latest.current;
    if (tracker.current.playing && !el.paused && !el.seeking) tracker.current.tick(el.currentTime * 1000);
    const played = tracker.current.collect();
    const position = Math.round(el.currentTime * 1000);
    if (!played.length && !(always && position !== sentPosition.current)) return;
    sentPosition.current = position;
    const body: BeatBody = { content_version: current.content_version, played, position_ms: position };
    if (exit) {
      sendBeatOnExit(current.id, body);
      return;
    }
    queue.current = queue.current.then(async () => {
      try {
        const result = await sendBeat(current.id, body);
        setPct(result.watch_pct);
        latest.current.onBeat(result);
      } catch (error) {
        if (reasonCodeOf(error) === 'staff_training_clip_changed') latest.current.onChanged();
        else tracker.current.restore(played as Interval[]);
      }
    });
  }, []);

  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const at = () => el.currentTime * 1000;
    const on: Record<string, () => void> = {
      loadedmetadata: () => {
        const start = resumeAtMs(latest.current.clip.progress.last_position_ms, latest.current.clip.duration_ms);
        if (start > 0) {
          el.currentTime = start / 1000;
          setResumedAt(start);
        }
      },
      play: () => tracker.current.begin(at()),
      timeupdate: () => { setNowMs(at()); tracker.current.tick(at()); },
      pause: () => { tracker.current.stop(at()); beat(true); },
      seeking: () => { const was = tracker.current.playing; tracker.current.stop(); if (was) beat(true); },
      seeked: () => { setNowMs(at()); if (!el.paused) tracker.current.begin(at()); },
      ended: () => { tracker.current.stop(Number.isFinite(el.duration) ? el.duration * 1000 : undefined); beat(true); },
      ratechange: () => { beat(false); setRate(el.playbackRate); },
      error: () => setFailed(true),
    };
    Object.entries(on).forEach(([name, handler]) => el.addEventListener(name, handler));
    return () => Object.entries(on).forEach(([name, handler]) => el.removeEventListener(name, handler));
  }, [beat, clip.id]);

  // Beats while it plays, faster at a higher speed (the server limits what one beat may cover).
  useEffect(() => {
    const id = window.setInterval(() => beat(false), beatEveryMs(rate));
    return () => window.clearInterval(id);
  }, [beat, rate]);

  // The last beat when the page goes away (hidden tab, closed tab) or the player is replaced.
  useEffect(() => {
    const hide = () => { if (document.visibilityState === 'hidden') beat(false, true); };
    const leave = () => beat(true, true);
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', leave);
    return () => {
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', leave);
    };
  }, [beat]);
  // A layout cleanup runs before the <video> is detached, so the element can still be read.
  useLayoutEffect(() => () => beat(true, true), [beat]);

  // Which subtitle track shows: ours and the browser's own menu stay in step.
  useEffect(() => {
    const list = video.current?.textTracks;
    if (!list || typeof list.length !== 'number') return;
    Array.from(list).forEach((track) => { track.mode = track.language === choice ? 'showing' : 'hidden'; });
  }, [choice, tracks]);
  useEffect(() => {
    const list = video.current?.textTracks;
    if (!list || typeof list.addEventListener !== 'function') return;
    const onChange = () => {
      const showing = Array.from(list).find((track) => track.mode === 'showing');
      const next: SubChoice = showing ? (showing.language as SubChoice) : 'off';
      setChoice((was) => (was === next ? was : next));
    };
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [tracks]);

  const pickSubs = (next: SubChoice) => {
    setChoice(next);
    try { localStorage.setItem(SUBS_KEY, next); } catch { /* storage blocked: the choice lasts until the page closes */ }
  };
  const pickRate = (next: number) => {
    if (video.current) video.current.playbackRate = next;
    setRate(next);
  };
  const seekToSegment = (ms: number) => {
    const el = video.current;
    if (!el) return;
    el.currentTime = ms / 1000;
    void el.play()?.catch(() => undefined);
  };

  return (
    <div className="@container space-y-3">
      <div className="overflow-hidden rounded-2xl bg-black shadow-sm ring-1 ring-border">
        <video
          ref={video}
          data-clip-video
          className="aspect-video w-full bg-black"
          src={mediaUrl(clip.video_url) ?? undefined}
          poster={mediaUrl(clip.poster_url) ?? undefined}
          controls
          playsInline
          preload="metadata"
        >
          {tracks.map((track) => (
            <track key={track.lang} kind="subtitles" srcLang={track.lang} label={track.label} src={track.src} />
          ))}
        </video>
      </div>

      {failed && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-300">{t('staffTraining.clip.failed')}</p>}
      {resumedAt !== null && <p className="text-xs text-muted-foreground">{t('staffTraining.clip.resumed', { time: formatClock(resumedAt) })}</p>}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        {tracks.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">{t('staffTraining.clip.subtitles')}</span>
            <Segmented<SubChoice>
              label={t('staffTraining.clip.subtitles')}
              value={choice}
              onChange={pickSubs}
              options={[
                { value: 'off', label: t('staffTraining.clip.subtitlesOff') },
                ...tracks.map((track) => ({ value: track.lang, label: track.label })),
              ]}
            />
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">{t('staffTraining.clip.speed')}</span>
          <Segmented<string>
            label={t('staffTraining.clip.speed')}
            value={String(RATES.includes(rate as (typeof RATES)[number]) ? rate : 1)}
            onChange={(next) => pickRate(Number(next))}
            options={RATES.map((r) => ({ value: String(r), label: t('staffTraining.clip.speedValue', { rate: r }) }))}
          />
        </div>
        <span className="ml-auto text-xs text-muted-foreground" data-watch-pct={pct}>
          {t('staffTraining.clip.watchedPct', { pct })}
        </span>
      </div>
      {subsFailed && <p className="text-xs text-muted-foreground">{t('staffTraining.clip.subsFailed')}</p>}

      <SegmentList segments={clip.segments} locale={locale} nowMs={nowMs} onJump={seekToSegment} />
    </div>
  );
});

export default ClipPlayer;
