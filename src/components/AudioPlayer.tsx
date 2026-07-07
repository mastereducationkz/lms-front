import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '../lib/utils';

const AUDIO_EXTENSIONS = ['webm', 'ogg', 'mp3', 'm4a', 'wav', 'aac', 'oga', 'opus'];

/**
 * True when the given url/filename (querystring ignored) ends in a common
 * audio extension. Used to decide whether to render an <AudioPlayer> instead
 * of a generic file-download card.
 */
export function isAudioUrl(url?: string | null): boolean {
  if (!url) return false;
  const withoutQuery = url.split('?')[0].split('#')[0];
  const ext = withoutQuery.split('.').pop()?.toLowerCase() || '';
  return AUDIO_EXTENSIONS.includes(ext);
}

function formatTime(seconds: number | null): string {
  if (seconds === null || !isFinite(seconds) || isNaN(seconds) || seconds < 0) {
    return '--:--';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

interface AudioPlayerProps {
  src: string;
  className?: string;
}

/**
 * Compact custom audio player with play/pause, a seek bar, and a
 * current/total time label.
 *
 * Fixes the well-known MediaRecorder-produced .webm bug where
 * `audio.duration` reports as `Infinity`/`NaN` because the file has no
 * duration in its metadata (no seekable index). On `loadedmetadata`, if the
 * duration isn't a usable finite number, we seek to a huge timestamp
 * (`1e101`) which forces the browser to walk the whole stream and compute the
 * real duration; the next `timeupdate` event then reports the correct
 * value, after which we reset playback to the start and drop the one-shot
 * listener.
 */
export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, className }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState<number | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Reset state whenever the source changes.
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(null);

    const applyDurationIfFinite = () => {
      const d = audio.duration;
      if (isFinite(d) && !isNaN(d) && d > 0) {
        setDuration(d);
      }
    };

    // The AUDIBLE player is never seeked (seeking a MediaRecorder .webm to force
    // its missing duration moves the playhead to the end and can't reliably be
    // reset, which made Play produce silence). So playback always starts from 0.
    const handleLoadedMetadata = () => applyDurationIfFinite();
    const handleDurationChange = () => applyDurationIfFinite();

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    // Duration probe: a DETACHED <audio> we CAN safely seek to force the browser
    // to compute a webm's missing duration, without disturbing the audible
    // player's playhead. Once it resolves, the seek bar has a real max and moves.
    let probe: HTMLAudioElement | null = new Audio();
    probe.preload = 'metadata';

    const cleanupProbe = () => {
      if (!probe) return;
      probe.removeEventListener('loadedmetadata', onProbeMeta);
      probe.removeEventListener('timeupdate', onProbeSeek);
      // Deliberately do NOT set `probe.src = ''`: for a same-URL resource that
      // abort can tear down the media the audible player is still using and
      // stall it. Just drop our reference and let it be garbage-collected.
      probe = null;
    };
    const onProbeSeek = () => {
      if (!probe) return;
      probe.removeEventListener('timeupdate', onProbeSeek);
      const d = probe.duration;
      if (isFinite(d) && !isNaN(d) && d > 0) setDuration(d);
      cleanupProbe();
    };
    const onProbeMeta = () => {
      if (!probe) return;
      const d = probe.duration;
      if (isFinite(d) && !isNaN(d) && d > 0) {
        setDuration(d);
        cleanupProbe();
        return;
      }
      probe.addEventListener('timeupdate', onProbeSeek);
      try {
        probe.currentTime = 1e101;
      } catch {
        cleanupProbe();
      }
    };
    probe.addEventListener('loadedmetadata', onProbeMeta);
    // Same URL as the audible player (a cache-buster query breaks S3-signed
    // serving). Safe because we never abort the probe — see cleanupProbe.
    probe.src = src;

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      cleanupProbe();
    };
  }, [src]);

  // Drive the progress thumb from a rAF loop while playing, so it moves
  // smoothly and keeps tracking even if `timeupdate` is throttled.
  useEffect(() => {
    if (!isPlaying) return;
    let raf = 0;
    const tick = () => {
      const audio = audioRef.current;
      if (audio) setCurrentTime(audio.currentTime);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isPlaying]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      void audio.play().catch(() => {
        // Playback can reject (e.g. user gesture requirements); ignore.
      });
    } else {
      audio.pause();
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio || duration === null) return;
    const newTime = parseFloat(e.target.value);
    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const seekMax = duration ?? 0;
  const seekValue = Math.min(currentTime, seekMax);
  const progressPercent = duration ? (seekValue / duration) * 100 : 0;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border border-border bg-white dark:bg-card px-3 py-2',
        className
      )}
    >
      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={togglePlay}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground transition-colors hover:bg-primary/90"
        aria-label={isPlaying ? 'Pause' : 'Play'}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="ml-0.5 h-4 w-4" />}
      </button>

      <input
        type="range"
        min={0}
        max={seekMax}
        step={0.01}
        value={seekValue}
        onChange={handleSeek}
        disabled={duration === null}
        aria-label="Seek"
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full accent-primary disabled:cursor-not-allowed disabled:opacity-50"
        style={{
          background: `linear-gradient(to right, hsl(var(--primary)) ${progressPercent}%, hsl(var(--muted)) ${progressPercent}%)`,
        }}
      />

      <span className="flex-shrink-0 text-xs tabular-nums text-muted-foreground min-w-[70px] text-right">
        {formatTime(currentTime)} / {formatTime(duration)}
      </span>
    </div>
  );
};

export default AudioPlayer;
