import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import apiClient from '../../services/api';
import { toast } from '../../components/Toast';
import { ArrowLeft, Mic, Square, RotateCcw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import type { Assignment } from '../../types/index';

type RecorderState = 'idle' | 'requesting' | 'recording' | 'stopped';

const CANDIDATE_MIME_TYPES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/ogg',
];

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return '';
  }
  for (const candidate of CANDIDATE_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(candidate)) {
      return candidate;
    }
  }
  return '';
}

function formatElapsed(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export default function AssignmentRecordPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loadError, setLoadError] = useState<string>('');

  const [isSupported, setIsSupported] = useState(true);
  const [recorderState, setRecorderState] = useState<RecorderState>('idle');
  const [permissionError, setPermissionError] = useState<string>('');
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedUrl, setRecordedUrl] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeTypeRef = useRef<string>('');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!id) return;
    apiClient.getAssignment(id)
      .then((data: Assignment) => setAssignment(data))
      .catch((err: unknown) => {
        console.error('Failed to load assignment:', err);
        setLoadError('Failed to load assignment.');
      });
  }, [id]);

  useEffect(() => {
    const supported = typeof navigator !== 'undefined'
      && !!navigator.mediaDevices
      && typeof navigator.mediaDevices.getUserMedia === 'function'
      && typeof window !== 'undefined'
      && typeof window.MediaRecorder !== 'undefined';
    setIsSupported(supported);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  // Clean up on unmount: stop any active stream/timer and revoke the object URL.
  useEffect(() => {
    return () => {
      stopTimer();
      stopStream();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // Ignore errors while tearing down on unmount.
        }
      }
      if (recordedUrl) {
        URL.revokeObjectURL(recordedUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startRecording = async () => {
    setPermissionError('');
    setRecorderState('requesting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = pickSupportedMimeType();
      mimeTypeRef.current = mimeType;

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalMimeType = mimeTypeRef.current || recorder.mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type: finalMimeType });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setRecordedUrl(url);
        setRecorderState('stopped');
        stopTimer();
        stopStream();
      };

      recorder.start();
      setRecorderState('recording');
      setElapsedSeconds(0);
      timerRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Failed to start recording:', err);
      stopStream();
      setRecorderState('idle');
      if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setPermissionError('Microphone access was denied. Please allow microphone access in your browser settings and try again.');
      } else if (err?.name === 'NotFoundError') {
        setPermissionError('No microphone was found on this device. Please connect a microphone and try again.');
      } else {
        setPermissionError('Could not access the microphone. Please check your device settings and try again.');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const reRecord = () => {
    if (recordedUrl) {
      URL.revokeObjectURL(recordedUrl);
    }
    setRecordedBlob(null);
    setRecordedUrl('');
    setElapsedSeconds(0);
    setRecorderState('idle');
    chunksRef.current = [];
  };

  const handleSubmit = async () => {
    if (!id || !recordedBlob) return;
    setSubmitting(true);
    try {
      const uploadResult = await apiClient.uploadAssignmentAudio(recordedBlob);
      await apiClient.submitAssignment(id, {
        answers: {},
        file_url: uploadResult.url,
        submitted_file_name: uploadResult.filename,
      });
      setSubmitted(true);
      toast('Recording submitted successfully!', 'success');
    } catch (err) {
      console.error('Failed to submit audio recording:', err);
      toast('Failed to submit your recording. Please try again.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-center text-red-800 dark:text-red-400">
          <AlertCircle className="w-5 h-5 mr-2" />
          {loadError}
        </div>
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500 dark:text-gray-400 text-lg">Loading assignment...</div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <Card className="border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-900/20">
          <CardContent className="pt-6 flex flex-col items-center text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-600 dark:text-green-400" />
            <div>
              <h2 className="text-xl font-semibold text-foreground">Recording submitted</h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Your teacher will listen to your recording and grade it soon.
              </p>
            </div>
            <Button onClick={() => navigate(`/homework/${id}`)}>
              Back to Assignment
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <Button variant="outline" onClick={() => navigate(`/homework/${id}`)}>
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Assignment
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{assignment.title}</CardTitle>
          <CardDescription>
            {assignment.content?.question || assignment.description}
          </CardDescription>
        </CardHeader>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Record Your Answer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isSupported && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start text-red-800 dark:text-red-400">
              <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
              <span>
                Audio recording is not supported in this browser. Please try a recent version of Chrome, Safari, or Firefox.
              </span>
            </div>
          )}

          {isSupported && permissionError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start text-red-800 dark:text-red-400">
              <AlertCircle className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p>{permissionError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={startRecording}
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {isSupported && !permissionError && (
            <div className="flex flex-col items-center space-y-4">
              <div className="text-3xl font-mono font-semibold text-foreground">
                {formatElapsed(elapsedSeconds)}
              </div>

              {recorderState === 'idle' && (
                <Button onClick={startRecording} size="lg" className="w-full sm:w-auto">
                  <Mic className="w-5 h-5 mr-2" />
                  Record
                </Button>
              )}

              {recorderState === 'requesting' && (
                <Button disabled size="lg" className="w-full sm:w-auto">
                  Requesting microphone access...
                </Button>
              )}

              {recorderState === 'recording' && (
                <Button onClick={stopRecording} variant="destructive" size="lg" className="w-full sm:w-auto">
                  <Square className="w-5 h-5 mr-2" />
                  Stop
                </Button>
              )}

              {recorderState === 'stopped' && recordedUrl && (
                <div className="w-full space-y-4">
                  <audio controls src={recordedUrl} className="w-full" />
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      onClick={reRecord}
                      variant="outline"
                      className="flex-1"
                      disabled={submitting}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" />
                      Re-record
                    </Button>
                    <Button
                      onClick={handleSubmit}
                      className="flex-1"
                      disabled={!recordedBlob || submitting}
                    >
                      {submitting ? 'Submitting...' : 'Submit'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
        You can re-record as many times as you like before submitting. Once submitted, your teacher
        will grade your recording — you can check back on the{' '}
        <Link to={`/homework/${id}`} className="underline">
          assignment page
        </Link>
        .
      </p>
    </div>
  );
}
