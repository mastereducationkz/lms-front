import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  /** 'strict' = no seeking, limited replays; 'flexible' = full control */
  mode?: 'strict' | 'flexible';
  /** Max number of times audio can be played in strict mode */
  maxPlays?: number;
  /** Callback when audio finishes */
  onEnded?: () => void;
  /** Callback when play count changes */
  onPlayCountChange?: (count: number) => void;
  className?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  src,
  mode = 'flexible',
  maxPlays = 2,
  onEnded,
  onPlayCountChange,
  className = ''
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVolume, setShowVolume] = useState(false);

  const isStrictMode = mode === 'strict';
  const canPlay = !isStrictMode || playCount < maxPlays;

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      // В экзаменационном режиме нельзя ставить на паузу
      if (isStrictMode) return;
      audio.pause();
    } else {
      if (!canPlay) return;
      
      if (isStrictMode && currentTime === 0 && !hasStarted) {
        const newCount = playCount + 1;
        setPlayCount(newCount);
        onPlayCountChange?.(newCount);
      }
      
      setHasStarted(true);
      audio.play().catch(err => {
        console.error('Error playing audio:', err);
        setError('Failed to play audio');
      });
    }
  }, [isPlaying, canPlay, isStrictMode, currentTime, hasStarted, playCount, onPlayCountChange]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration);
    const handlePlay = () => {
      setIsPlaying(true);
      setIsLoading(false);
    };
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setHasStarted(false);
      setCurrentTime(0);
      onEnded?.();
    };
    const handleWaiting = () => setIsLoading(true);
    const handleCanPlayThrough = () => setIsLoading(false);
    const handleError = () => {
      setIsLoading(false);
      setError('Failed to load audio');
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('canplaythrough', handleCanPlayThrough);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('canplaythrough', handleCanPlayThrough);
      audio.removeEventListener('error', handleError);
    };
  }, [onEnded]);

  // Warn user before leaving page in strict mode after audio has started
  useEffect(() => {
    if (!isStrictMode || !hasStarted) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'You are in exam mode. If you leave, your audio plays will be lost. Are you sure?';
      return e.returnValue;
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isStrictMode, hasStarted]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isStrictMode) return;
    
    const audio = audioRef.current;
    const progress = progressRef.current;
    if (!audio || !progress) return;

    const rect = progress.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    audio.currentTime = percent * duration;
  };

  const toggleMute = () => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.volume = volume || 1;
        setIsMuted(false);
      } else {
        audioRef.current.volume = 0;
        setIsMuted(true);
      }
    }
  };

  const handleRestart = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isStrictMode) {
      if (playCount >= maxPlays) return;
      const newCount = playCount + 1;
      setPlayCount(newCount);
      onPlayCountChange?.(newCount);
    }

    audio.currentTime = 0;
    setHasStarted(true);
    audio.play().catch(console.error);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (error) {
    return (
      <div className={`flex items-center gap-3 p-3 bg-destructive/10 rounded-md text-destructive text-sm ${className}`}>
        <span>⚠️ {error}</span>
      </div>
    );
  }

  return (
    <div className={`bg-muted/50 border dark:border-gray-700 rounded-md p-3 space-y-2 ${className}`}>
      <audio ref={audioRef} src={src} preload="metadata" />
      
      <div className="flex items-center gap-3">
        {/* Play/Pause */}
        <button
          onClick={togglePlay}
          disabled={!canPlay && !isPlaying}
          className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
            canPlay || isPlaying
              ? 'bg-primary text-primary-foreground hover:bg-primary/90'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          {isLoading ? (
            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
          ) : isPlaying && isStrictMode ? (
            // В экзаменационном режиме показываем индикатор воспроизведения вместо паузы
            <div className="flex gap-0.5">
              <div className="w-0.5 h-3 bg-primary-foreground rounded-full animate-pulse" />
              <div className="w-0.5 h-3 bg-primary-foreground rounded-full animate-pulse [animation-delay:150ms]" />
              <div className="w-0.5 h-3 bg-primary-foreground rounded-full animate-pulse [animation-delay:300ms]" />
            </div>
          ) : isPlaying ? (
            <Pause className="w-4 h-4" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" />
          )}
        </button>

        {/* Time display */}
        <span className="text-sm text-muted-foreground tabular-nums flex-shrink-0">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Progress bar */}
        <div 
          ref={progressRef}
          className={`flex-1 relative h-1.5 bg-secondary rounded-full overflow-hidden ${
            isStrictMode ? 'cursor-not-allowed opacity-70' : 'cursor-pointer'
          }`}
          onClick={handleSeek}
        >
          <div 
            className="absolute top-0 left-0 h-full bg-primary rounded-full transition-all duration-100"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Restart */}
        <button
          onClick={handleRestart}
          disabled={isStrictMode && playCount >= maxPlays}
          className={`p-2 rounded-md flex-shrink-0 transition-colors ${
            !isStrictMode || playCount < maxPlays
              ? 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              : 'text-muted-foreground/50 cursor-not-allowed'
          }`}
          title="Restart"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Volume */}
        <div className="relative flex-shrink-0">
          <button
            onClick={toggleMute}
            onMouseEnter={() => setShowVolume(true)}
            className="p-2 rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          
          {showVolume && (
            <div 
              className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-3 bg-popover rounded-md shadow-md border dark:border-gray-700"
              onMouseLeave={() => setShowVolume(false)}
            >
              <div 
                className="relative w-1.5 h-24 bg-secondary rounded-full cursor-pointer"
                onClick={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const clickY = e.clientY - rect.top;
                  const newVolume = 1 - (clickY / rect.height);
                  const clampedVolume = Math.max(0, Math.min(1, newVolume));
                  setVolume(clampedVolume);
                  if (audioRef.current) {
                    audioRef.current.volume = clampedVolume;
                  }
                  setIsMuted(clampedVolume === 0);
                }}
              >
                {/* Filled portion */}
                <div 
                  className="absolute bottom-0 left-0 w-full bg-primary rounded-full transition-all duration-100"
                  style={{ height: `${(isMuted ? 0 : volume) * 100}%` }}
                />
                {/* Thumb */}
                <div 
                  className="absolute left-1/2 -translate-x-1/2 w-3 h-3 bg-primary rounded-full shadow-sm transition-all duration-100"
                  style={{ bottom: `calc(${(isMuted ? 0 : volume) * 100}% - 6px)` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AudioPlayer;
