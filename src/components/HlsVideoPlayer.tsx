import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface HlsVideoPlayerProps {
  /** Stored HLS path (e.g. /uploads/videos/123/ru/master.m3u8) or absolute URL. */
  url: string;
  title?: string;
  className?: string;
  onError?: (error: string) => void;
  onProgress?: (progress: number) => void;
}

/**
 * Plays self-hosted adaptive HLS. Drop-in replacement for YouTubeVideoPlayer:
 * same onProgress(fraction 0..1) contract, so the lesson's 90%-watched → complete
 * logic keeps working. Uses hls.js where MSE is available, native HLS on Safari/iOS.
 */
export default function HlsVideoPlayer({
  url,
  title = 'Lesson Video',
  className = '',
  onError,
  onProgress,
}: HlsVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onProgressRef = useRef<typeof onProgress>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
  const src = url.startsWith('http') ? url : `${backendUrl}${url}`;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;
    setFailed(false);

    let hls: Hls | null = null;

    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: false });
      hls.loadSource(src);
      hls.attachMedia(video);
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          // Try to recover network/media errors once before giving up.
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls?.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls?.recoverMediaError();
          } else {
            setFailed(true);
            onError?.('Unable to play the video. Please try again.');
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari / iOS: native HLS.
      video.src = src;
    } else {
      setFailed(true);
      onError?.('This browser cannot play the video.');
    }

    return () => {
      if (hls) hls.destroy();
    };
  }, [src]);

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration || !isFinite(v.duration) || v.duration <= 0) return;
    const fraction = Math.min(1, Math.max(0, v.currentTime / v.duration));
    onProgressRef.current?.(fraction);
  };

  const handleEnded = () => onProgressRef.current?.(1);

  if (failed) {
    return (
      <div className={`bg-gray-100 dark:bg-gray-800 rounded-lg p-6 text-center ${className}`}>
        <p className="text-sm text-gray-600 dark:text-gray-300">Video is temporarily unavailable.</p>
      </div>
    );
  }

  return (
    <div className={`bg-gray-900 rounded-lg overflow-hidden relative ${className}`}>
      <div className="aspect-video w-full">
        <video
          ref={videoRef}
          controls
          playsInline
          preload="metadata"
          title={title}
          className="w-full h-full"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
        />
      </div>
    </div>
  );
}
