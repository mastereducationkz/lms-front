import { useEffect, useState } from 'react';
import { mediaUrl } from '@/lib/mediaUrl';
import type { ClipSubtitle } from '@/services/api/staffTraining';

export interface SubtitleTrack { lang: 'ru' | 'en'; label: string; src: string; isDefault: boolean }

/**
 * The clip's WebVTT files as `blob:` URLs for `<track>` (CONTRACTS K3): fetched here with plain `fetch`, so the
 * video element never makes a cross-origin track request. The text is handed over untouched, so the cue settings
 * the pipeline wrote (`line:` lifts the subtitle above important UI at the bottom) reach the browser's own renderer.
 */
export function useSubtitleTracks(subtitles: ClipSubtitle[]): { tracks: SubtitleTrack[]; failed: boolean } {
  const [state, setState] = useState<{ tracks: SubtitleTrack[]; failed: boolean }>({ tracks: [], failed: false });

  useEffect(() => {
    let cancelled = false;
    const urls: string[] = [];
    setState({ tracks: [], failed: false });
    Promise.all(subtitles.map(async (sub): Promise<SubtitleTrack | null> => {
      try {
        const href = mediaUrl(sub.url);
        if (!href) return null;
        const response = await fetch(href);
        if (!response.ok) return null;
        const text = await response.text();
        if (cancelled) return null;
        const src = URL.createObjectURL(new Blob([text], { type: 'text/vtt' }));
        urls.push(src);
        return { lang: sub.lang, label: sub.label, src, isDefault: sub.default };
      } catch {
        return null;
      }
    })).then((list) => {
      if (cancelled) return;
      const tracks = list.filter((track): track is SubtitleTrack => track !== null);
      setState({ tracks, failed: subtitles.length > 0 && tracks.length < subtitles.length });
    });
    return () => {
      cancelled = true;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [subtitles]);

  return state;
}
