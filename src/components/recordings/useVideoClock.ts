import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

const EVENTS = ['timeupdate', 'seeked', 'play', 'pause', 'loadedmetadata', 'emptied'] as const;

/**
 * The time of the <video> somewhere inside `box` — what a transcript follows. The player mounts
 * its video only once the recording has loaded, and may replace it, so the element is looked for
 * again whenever the box's contents change. `timeupdate` arrives a few times a second, which is
 * as often as a transcript line can change.
 *
 * `seek` jumps the same video and plays from there.
 */
export function useVideoClock(box: RefObject<HTMLElement>, enabled: boolean) {
  const [time, setTime] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const video = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const root = box.current;
    if (!enabled || !root) return undefined;
    const update = () => {
      const v = video.current;
      if (!v) return;
      setTime(Number.isFinite(v.currentTime) ? v.currentTime : null);
      setPlaying(!v.paused && !v.ended);
    };
    const detach = () => {
      const v = video.current;
      if (v) EVENTS.forEach((name) => v.removeEventListener(name, update));
      video.current = null;
    };
    const attach = () => {
      const found = root.querySelector('video');
      if (found === video.current) return;
      detach();
      video.current = found;
      if (!found) {
        setTime(null);
        setPlaying(false);
        return;
      }
      EVENTS.forEach((name) => found.addEventListener(name, update));
      update();
    };
    const observer = new MutationObserver(attach);
    observer.observe(root, { childList: true, subtree: true });
    attach();
    return () => {
      observer.disconnect();
      detach();
    };
  }, [box, enabled]);

  const seek = useCallback((seconds: number) => {
    const v = video.current ?? box.current?.querySelector('video') ?? null;
    if (!v) return;
    v.currentTime = Math.max(0, seconds);
    v.play().catch(() => { /* blocked by the browser: the controls remain */ });
  }, [box]);

  return { time, playing, seek };
}
