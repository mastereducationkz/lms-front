import { useState, useEffect, useRef } from 'react';
import { ExternalLink, RotateCcw, TriangleAlert } from 'lucide-react';
import { validateAndExtractYouTubeInfo } from '../utils/youtube';
import { resumeSecond, youtubeWatchAt } from '../lib/youtubePlayback';
import { Button } from './ui/button';

interface YouTubeVideoPlayerProps {
  url: string;
  title?: string;
  className?: string;
  onError?: (error: string) => void;
  onProgress?: (progress: number) => void;
}

export default function YouTubeVideoPlayer({ 
  url, 
  title = "YouTube Video", // Kept for prop interface compatibility, but marked as unused if needed
  className = "",
  onError,
  onProgress 
}: YouTubeVideoPlayerProps) {
  const [player, setPlayer] = useState<any>(null);
  const [isPlayerActive, setIsPlayerActive] = useState(false);
  // Bumped by «Reload video»: the player is rebuilt (a fresh decoder) and resumes at resumeAtRef.
  const [reloadCount, setReloadCount] = useState(0);
  const [troubleOpen, setTroubleOpen] = useState(false);
  const resumeAtRef = useRef<number>();
  const playerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<number>();
  const playerInstanceRef = useRef<any>(null);
  const playerReadyTimeoutRef = useRef<number>();
  const onProgressRef = useRef<typeof onProgress>();
  const videoInfo = validateAndExtractYouTubeInfo(url);

  if (!videoInfo.is_valid || !videoInfo.video_id) {
    const errorMessage = "Invalid YouTube URL";
    onError?.(errorMessage);
    return (
      <div className={`bg-gray-100 rounded-lg p-4 text-center ${className}`}>
        <div className="text-gray-500 text-sm">
          <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <p>{errorMessage}</p>
          <p className="text-xs mt-1">Please enter a valid YouTube URL</p>
        </div>
      </div>
    );
  }

  const currentSecond = (): number | undefined => {
    try {
      return playerInstanceRef.current?.getCurrentTime?.();
    } catch {
      return undefined;
    }
  };

  const openOnYouTube = () => {
    window.open(youtubeWatchAt(videoInfo.video_id!, currentSecond()), '_blank', 'noopener,noreferrer');
  };

  const reloadPlayer = () => {
    resumeAtRef.current = currentSecond();
    setPlayer(null);
    setReloadCount(count => count + 1);
  };

  // Keep latest onProgress in a ref to avoid effect re-runs
  useEffect(() => {
    onProgressRef.current = onProgress;
  }, [onProgress]);

  // Initialize YouTube Player API
  useEffect(() => {
    if (!videoInfo.is_valid || !videoInfo.video_id || !isPlayerActive) {
      return;
    }

    const loadYouTubeAPI = () => {
      if (window.YT && window.YT.Player) {
        initializePlayer();
      } else {
        // Load YouTube API if not already loaded
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = () => {
          initializePlayer();
        };
      }
    };

    const initializePlayer = () => {
      // Wait for element to be rendered
      if (!playerRef.current) {
        setTimeout(initializePlayer, 100);
        return;
      }
      
      // Avoid creating multiple players
      if (playerInstanceRef.current) {
        return;
      }

      if (playerRef.current && window.YT) {
        try {
          if (playerReadyTimeoutRef.current) {
            clearTimeout(playerReadyTimeoutRef.current);
            playerReadyTimeoutRef.current = undefined;
          }

          playerReadyTimeoutRef.current = window.setTimeout(() => {
            onError?.('Unable to initialize YouTube player. Please try opening the video in a new tab.');
          }, 12000);

          // The API swaps the element it is given for its iframe, so give it one React does not
          // own; the host div stays put and a reload can start over inside it.
          const mountPoint = document.createElement('div');
          playerRef.current.replaceChildren(mountPoint);
          const start = resumeSecond(resumeAtRef.current);

          playerInstanceRef.current = new window.YT.Player(mountPoint as any, {
            videoId: videoInfo.video_id,
            width: '100%',
            height: '100%',
            playerVars: {
              autoplay: 1, // Autoplay when activated
              modestbranding: 1,
              rel: 0,
              ...(start !== undefined ? { start } : {})
            },
            events: {
              onReady: (event: any) => {
                if (playerReadyTimeoutRef.current) {
                  clearTimeout(playerReadyTimeoutRef.current);
                  playerReadyTimeoutRef.current = undefined;
                }
                const iframe = playerRef.current?.querySelector('iframe');
                if (iframe) {
                  iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
                }
                setPlayer(event.target);
              },
              onStateChange: (event: any) => {

                if (event.data === window.YT.PlayerState.PLAYING) {
                  // Clear any existing interval first
                  if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                  }
                  
                  // Start new progress tracking
                  intervalRef.current = window.setInterval(() => {
                    try {
                      if (event.target && event.target.getCurrentTime && event.target.getDuration) {
                        const currentTime = event.target.getCurrentTime();
                        const duration = event.target.getDuration();
                        if (duration > 0) {
                          const progressFraction = Math.min(1, Math.max(0, currentTime / duration));
                          const progressPercent = progressFraction * 100;
                          onProgressRef.current?.(progressFraction);
                        }
                      }
                    } catch (err) {
                    }
                  }, 1000);

                } else if (event.data === window.YT.PlayerState.PAUSED) {
                } else if (event.data === window.YT.PlayerState.ENDED) {
                  if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = undefined;
                  }
                  onProgressRef.current?.(1);
                }
              }
            }
          });

        } catch (error) {
          console.error('YouTubeVideoPlayer: Error creating player', error);
          onError?.('Failed to load YouTube player. Please try again or open the video in a new tab.');
        }
      } else {
      }
    };

    loadYouTubeAPI();

    return () => {
      // Cleanup on unmount
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = undefined;
      }
      if (playerReadyTimeoutRef.current) {
        clearTimeout(playerReadyTimeoutRef.current);
        playerReadyTimeoutRef.current = undefined;
      }
      if (playerInstanceRef.current) {
        try {
          playerInstanceRef.current.destroy();
        } catch (err) {
          console.error('YouTubeVideoPlayer: Error destroying player', err);
        }
        playerInstanceRef.current = null;
      }
      playerRef.current?.replaceChildren();
    };
  }, [videoInfo.video_id, isPlayerActive, reloadCount]);

  return (
    <div className={className}>
      <div className="bg-gray-900 rounded-lg overflow-hidden relative youtube-iframe-container">
        {/* Video player */}
        <div className="aspect-video w-full relative group">
          {!isPlayerActive ? (
            /* Thumbnail and Play Button */
            <div 
              className="w-full h-full relative cursor-pointer"
              onClick={() => setIsPlayerActive(true)}
            >
              <img 
                src={videoInfo.thumbnail_url} 
                alt={title} 
                className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                  <svg className="w-8 h-8 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </div>
          ) : (
            /* Player Container */
            <>
              <div ref={playerRef} className="absolute inset-0 w-full h-full youtube-player-frame" />
            
              {/* Loading spinner while player is initializing */}
              {!player && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-white"></div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Stripes or green/pink frames come from the student's GPU decoding YouTube, not the lesson:
          a fresh player, youtube.com, or Chrome without graphics acceleration are the ways out. */}
      <div className="px-3 py-2 text-sm">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setTroubleOpen(open => !open)}
            aria-expanded={troubleOpen}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <TriangleAlert className="h-3.5 w-3.5" />
            Video glitching or not playing?
          </button>
        </div>
        {troubleOpen && (
          <div className="mt-2 space-y-3 rounded-md border border-gray-200 bg-white p-3 text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            <p>
              Stripes, green or pink blocks, or a frozen picture come from how your computer's graphics
              card plays YouTube video, not from the lesson itself.
            </p>
            <div className="flex flex-wrap gap-2">
              {isPlayerActive && (
                <Button variant="outline" size="sm" onClick={reloadPlayer}>
                  <RotateCcw className="mr-1.5 h-4 w-4" />
                  Reload video
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={openOnYouTube}>
                <ExternalLink className="mr-1.5 h-4 w-4" />
                Open on YouTube
              </Button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Still broken? Update Chrome and your graphics driver, or open Chrome's Settings → System,
              turn off «Use graphics acceleration when available» and relaunch Chrome.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
