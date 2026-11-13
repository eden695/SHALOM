// Audio & Video MediaRecorder Service for SHALOM
// Reliable capture with live audio level metering and native codec fallback

export interface RecorderState {
  isRecording: boolean;
  isPaused: boolean;
  durationSeconds: number;
  audioLevel: number; // 0 to 100
  mode: 'audio' | 'video';
  error: string | null;
}

export class MediaRecordingManager {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private mediaStream: MediaStream | null = null;
  private timerInterval: number | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private levelAnimFrame: number | null = null;
  private onStateChangeCallback: ((state: RecorderState) => void) | null = null;

  public state: RecorderState = {
    isRecording: false,
    isPaused: false,
    durationSeconds: 0,
    audioLevel: 0,
    mode: 'audio',
    error: null,
  };

  constructor(onStateChange?: (state: RecorderState) => void) {
    if (onStateChange) this.onStateChangeCallback = onStateChange;
  }

  private notify() {
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback({ ...this.state });
    }
  }

  public static isSupported(): { audio: boolean; video: boolean } {
    const hasMediaDevices = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const hasMediaRecorder = typeof window !== 'undefined' && 'MediaRecorder' in window;
    return {
      audio: hasMediaDevices && hasMediaRecorder,
      video: hasMediaDevices && hasMediaRecorder,
    };
  }

  public static getBestMimeType(mode: 'audio' | 'video'): string | undefined {
    if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) {
      return undefined;
    }

    if (mode === 'audio') {
      const audioTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/ogg',
      ];
      for (const t of audioTypes) {
        if (MediaRecorder.isTypeSupported(t)) {
          return t;
        }
      }
      return undefined;
    } else {
      const videoTypes = [
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=vp9,opus',
        'video/webm',
        'video/mp4',
      ];
      for (const t of videoTypes) {
        if (MediaRecorder.isTypeSupported(t)) {
          return t;
        }
      }
      return undefined;
    }
  }

  private startAudioLevelMeter(stream: MediaStream) {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;

      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);

      this.audioContext = ctx;
      this.analyser = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!this.analyser || !this.state.isRecording) return;
        if (this.state.isPaused) {
          this.state.audioLevel = 0;
          this.notify();
          this.levelAnimFrame = requestAnimationFrame(updateLevel);
          return;
        }

        this.analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;
        const normalized = Math.min(100, Math.round((average / 128) * 100));
        this.state.audioLevel = normalized;
        this.notify();
        this.levelAnimFrame = requestAnimationFrame(updateLevel);
      };

      this.levelAnimFrame = requestAnimationFrame(updateLevel);
    } catch {
      // Non-critical if AudioContext unavailable
    }
  }

  private createRecorder(stream: MediaStream, mode: 'audio' | 'video'): MediaRecorder {
    const preferredMime = MediaRecordingManager.getBestMimeType(mode);
    if (preferredMime) {
      try {
        return new MediaRecorder(stream, { mimeType: preferredMime });
      } catch {
        // Fallback to browser default
      }
    }
    return new MediaRecorder(stream);
  }

  public async startAudioRecording(): Promise<MediaStream> {
    this.cleanup();
    this.state = {
      isRecording: false,
      isPaused: false,
      durationSeconds: 0,
      audioLevel: 0,
      mode: 'audio',
      error: null,
    };

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("L'API microphone n'est pas prise en charge sur cet appareil.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('Aucun microphone détecté sur cet appareil.');
      }
      audioTracks.forEach((t) => {
        t.enabled = true;
      });

      this.mediaStream = stream;
      this.recordedChunks = [];
      this.mediaRecorder = this.createRecorder(stream, 'audio');

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.onerror = () => {
        this.state.error = "Erreur pendant l'enregistrement audio.";
        this.notify();
      };

      this.mediaRecorder.start(250);
      this.startTimer();

      this.state.isRecording = true;
      this.state.isPaused = false;
      this.notify();
      this.startAudioLevelMeter(stream);

      return stream;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur d'accès au microphone";
      this.state.error = msg;
      this.notify();
      throw err;
    }
  }

  public async startVideoRecording(
    videoElement?: HTMLVideoElement | null,
    facingMode: 'user' | 'environment' = 'user'
  ): Promise<MediaStream> {
    this.cleanup();
    this.state = {
      isRecording: false,
      isPaused: false,
      durationSeconds: 0,
      audioLevel: 0,
      mode: 'video',
      error: null,
    };

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("L'accès à la caméra n'est pas disponible sur cet appareil.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      stream.getAudioTracks().forEach((t) => {
        t.enabled = true;
      });

      this.mediaStream = stream;
      this.recordedChunks = [];

      if (videoElement) {
        videoElement.srcObject = stream;
        videoElement.muted = true;
        await videoElement.play().catch(() => {});
      }

      this.mediaRecorder = this.createRecorder(stream, 'video');

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          this.recordedChunks.push(e.data);
        }
      };

      this.mediaRecorder.start(500);
      this.startTimer();

      this.state.isRecording = true;
      this.state.isPaused = false;
      this.notify();
      this.startAudioLevelMeter(stream);

      return stream;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur d'accès à la caméra";
      this.state.error = msg;
      this.notify();
      throw err;
    }
  }

  public pause(): void {
    if (this.mediaRecorder && this.state.isRecording && !this.state.isPaused) {
      if (this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.pause();
      }
      this.pauseTimer();
      this.state.isPaused = true;
      this.notify();
    }
  }

  public resume(): void {
    if (this.mediaRecorder && this.state.isRecording && this.state.isPaused) {
      if (this.mediaRecorder.state === 'paused') {
        this.mediaRecorder.resume();
      }
      this.startTimer();
      this.state.isPaused = false;
      this.notify();
    }
  }

  public async stop(): Promise<{ blob: Blob; mimeType: string; duration: number }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('Aucun enregistrement en cours'));
        return;
      }

      const recorder = this.mediaRecorder;
      const fallbackMime = this.state.mode === 'audio' ? 'audio/webm' : 'video/webm';
      const mimeType = recorder.mimeType || this.recordedChunks[0]?.type || fallbackMime;
      const duration = Math.max(1, this.state.durationSeconds);

      if (recorder.state === 'inactive') {
        const finalBlob = new Blob(this.recordedChunks, { type: mimeType });
        this.cleanup();
        this.state.isRecording = false;
        this.state.isPaused = false;
        this.state.audioLevel = 0;
        this.notify();
        resolve({ blob: finalBlob, mimeType, duration });
        return;
      }

      recorder.onstop = () => {
        const finalBlob = new Blob(this.recordedChunks, { type: mimeType });
        this.cleanup();
        this.state.isRecording = false;
        this.state.isPaused = false;
        this.state.audioLevel = 0;
        this.notify();
        resolve({ blob: finalBlob, mimeType, duration });
      };

      try {
        recorder.requestData();
      } catch {
        // Ignore if not supported
      }
      recorder.stop();
    });
  }

  public cancel(): void {
    try {
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.onstop = null;
        this.mediaRecorder.stop();
      }
    } catch {
      // ignore
    }
    this.cleanup();
    this.state = {
      isRecording: false,
      isPaused: false,
      durationSeconds: 0,
      audioLevel: 0,
      mode: 'audio',
      error: null,
    };
    this.notify();
  }

  private startTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    this.timerInterval = window.setInterval(() => {
      this.state.durationSeconds += 1;
      this.notify();
    }, 1000);
  }

  private pauseTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private cleanup() {
    this.pauseTimer();
    if (this.levelAnimFrame) {
      cancelAnimationFrame(this.levelAnimFrame);
      this.levelAnimFrame = null;
    }
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
      this.analyser = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
  }
}
