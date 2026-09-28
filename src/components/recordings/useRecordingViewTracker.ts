import { useEffect, type RefObject } from 'react';
import { reportRecordingView } from '../../services/api/recordingViews';
import {
  advance, giveBack, HEARTBEAT_MS, newMeter, seeking, takeReport, type WatchMeter,
} from '../../lib/recordingViews';

/**
 * Reports how much of a lesson recording the signed-in viewer plays (owner, 2026-09-28): every 30 s
 * while the video plays, and on pause, end, close and when the page is hidden — never per second.
 * The <video> is looked for inside `box`, like `useVideoClock`, because the player mounts it only
 * once the recording has loaded and may replace it; one mount of the player is one session, one view.
 *
 * Only the LMS's own players use this. The accountants' login-free watch page does not: their opens
 * are logged on the watch link, and they are not students.
 */
export function useRecordingViewTracker(eventId: number | null | undefined, box: RefObject<HTMLElement>, enabled: boolean) {
  useEffect(() => {
    const root = box.current;
    if (!enabled || !root || eventId == null) return undefined;
    const id = eventId;
    let meter: WatchMeter = newMeter();
    let video: HTMLVideoElement | null = null;
    let refused = false; // not (or no longer) this viewer's to watch: stop reporting

    const flush = (keepalive = false) => {
      const taken = refused ? null : takeReport(meter);
      if (!taken) return;
      meter = taken.meter;
      reportRecordingView(id, taken.report, keepalive)
        .then((outcome) => { if (outcome === 'refused') refused = true; })
        .catch(() => { meter = giveBack(meter, taken.report); }); // the next heartbeat carries it
    };
    const read = () => {
      if (video) meter = advance(meter, video.currentTime, !video.paused && !video.ended);
    };
    const onSeeking = () => { meter = seeking(meter); };
    const onStop = () => { read(); flush(); };
    const listeners: [string, () => void][] = [
      ['timeupdate', read], ['seeking', onSeeking], ['pause', onStop], ['ended', onStop],
    ];
    const detach = () => {
      if (video) listeners.forEach(([name, fn]) => video?.removeEventListener(name, fn));
      video = null;
    };
    const attach = () => {
      const found = root.querySelector('video');
      if (found === video) return;
      detach();
      video = found;
      if (video) listeners.forEach(([name, fn]) => video?.addEventListener(name, fn));
    };
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush(true);
    };
    const onPageHide = () => flush(true);

    const observer = new MutationObserver(attach);
    observer.observe(root, { childList: true, subtree: true });
    attach();
    const timer = window.setInterval(() => flush(), HEARTBEAT_MS);
    document.addEventListener('visibilitychange', onHidden);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      observer.disconnect();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onHidden);
      window.removeEventListener('pagehide', onPageHide);
      read();
      detach();
      flush(); // the player closed: what was played since the last heartbeat
    };
  }, [eventId, box, enabled]);
}
