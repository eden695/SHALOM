import React, { useState, useRef, useEffect } from 'react';
import {
  Mic,
  Video,
  Play,
  Pause,
  Square,
  Volume2,
  Trash2,
  Search,
  User,
  Layers,
  HardDrive,
  Upload,
  Download,
  AlertCircle,
  CheckCircle2,
  Plus,
} from 'lucide-react';
import { MediaRecordingManager, RecorderState } from '../../services/audioVideoRecorder';
import { dbService, STORES } from '../../services/db';
import { useShalomDB } from '../../hooks/useShalomDB';
import { RecordedParole, ParoleType, ActivityGenre } from '../../types';
import { Modal } from '../common/Modal';
import { ConfirmDialog } from '../common/ConfirmDialog';

export const ParoleModule: React.FC = () => {
  const { recordings, reloadData } = useShalomDB();
  const [activeFilterType, setActiveFilterType] = useState<string>('all');
  const [selectedActivity, setSelectedActivity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Recorder & Import states
  const [isRecordingModalOpen, setIsRecordingModalOpen] = useState(false);
  const [captureMethod, setCaptureMethod] = useState<'mic' | 'video' | 'import'>('mic');
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [recorderState, setRecorderState] = useState<RecorderState>({
    isRecording: false,
    isPaused: false,
    durationSeconds: 0,
    audioLevel: 0,
    mode: 'audio',
    error: null,
  });

  const [recordedResult, setRecordedResult] = useState<{
    blob: Blob;
    mimeType: string;
    duration: number;
    mediaType: 'audio' | 'video';
    previewUrl: string;
  } | null>(null);

  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form Metadata
  const [formData, setFormData] = useState<{
    title: string;
    type: ParoleType;
    speaker: string;
    moderator: string;
    activityGenre: ActivityGenre;
    bibleVerse: string;
    notes: string;
  }>({
    title: '',
    type: 'predication',
    speaker: '',
    moderator: '',
    activityGenre: 'culte_dominical',
    bibleVerse: '',
    notes: '',
  });

  // Playback modal
  const [playingParole, setPlayingParole] = useState<RecordedParole | null>(null);
  const [playingBlobUrl, setPlayingBlobUrl] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);

  // Delete modal
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Storage info
  const [storageInfo, setStorageInfo] = useState<{ usageMB: number; quotaMB: number }>({
    usageMB: 0,
    quotaMB: 0,
  });

  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const recorderManagerRef = useRef<MediaRecordingManager | null>(null);

  useEffect(() => {
    recorderManagerRef.current = new MediaRecordingManager((state) => {
      setRecorderState(state);
    });

    dbService.getStorageEstimate().then((info) => {
      setStorageInfo({ usageMB: info.usageMB, quotaMB: info.quotaMB });
    });

    return () => {
      if (recorderManagerRef.current) {
        recorderManagerRef.current.cancel();
      }
    };
  }, []);

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const resetFormAndPreview = () => {
    if (recordedResult?.previewUrl) {
      URL.revokeObjectURL(recordedResult.previewUrl);
    }
    setRecordedResult(null);
    setSaveError(null);
    setFormData({
      title: '',
      type: 'predication',
      speaker: '',
      moderator: '',
      activityGenre: 'culte_dominical',
      bibleVerse: '',
      notes: '',
    });
  };

  const handleStartRecording = async () => {
    if (!recorderManagerRef.current) return;
    setSaveError(null);
    try {
      if (recordedResult?.previewUrl) {
        URL.revokeObjectURL(recordedResult.previewUrl);
        setRecordedResult(null);
      }

      if (captureMethod === 'mic') {
        await recorderManagerRef.current.startAudioRecording();
      } else if (captureMethod === 'video') {
        await recorderManagerRef.current.startVideoRecording(videoPreviewRef.current, facingMode);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Impossible d'accéder au microphone/caméra.";
      setSaveError(msg);
    }
  };

  const handlePauseResume = () => {
    if (!recorderManagerRef.current) return;
    if (recorderState.isPaused) {
      recorderManagerRef.current.resume();
    } else {
      recorderManagerRef.current.pause();
    }
  };

  const handleStopRecording = async () => {
    if (!recorderManagerRef.current) return;
    try {
      const result = await recorderManagerRef.current.stop();
      if (!result.blob || result.blob.size === 0) {
        setSaveError(
          "L'enregistrement est vide (0 octet). Vérifiez que le microphone n'est pas coupé et autorisez l'accès."
        );
        return;
      }
      const url = URL.createObjectURL(result.blob);
      setRecordedResult({
        blob: result.blob,
        mimeType: result.mimeType,
        duration: result.duration,
        mediaType: captureMethod === 'video' ? 'video' : 'audio',
        previewUrl: url,
      });
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : "Erreur à l'arrêt de l'enregistrement.");
    }
  };

  const handleImportMediaFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaveError(null);

    if (recordedResult?.previewUrl) {
      URL.revokeObjectURL(recordedResult.previewUrl);
    }

    const mediaType: 'audio' | 'video' = file.type.startsWith('video/') ? 'video' : 'audio';
    const previewUrl = URL.createObjectURL(file);

    // Probe duration cleanly
    const mediaEl = document.createElement(mediaType);
    mediaEl.preload = 'metadata';
    mediaEl.src = previewUrl;
    mediaEl.onloadedmetadata = () => {
      const duration = isFinite(mediaEl.duration) ? Math.round(mediaEl.duration) : 60;
      setRecordedResult({
        blob: file,
        mimeType: file.type || (mediaType === 'video' ? 'video/mp4' : 'audio/mpeg'),
        duration,
        mediaType,
        previewUrl,
      });
    };
    mediaEl.onerror = () => {
      setRecordedResult({
        blob: file,
        mimeType: file.type || (mediaType === 'video' ? 'video/mp4' : 'audio/mpeg'),
        duration: 60,
        mediaType,
        previewUrl,
      });
    };
  };

  const handleCancelRecording = () => {
    if (recorderManagerRef.current) {
      recorderManagerRef.current.cancel();
    }
    resetFormAndPreview();
    setIsRecordingModalOpen(false);
  };

  const handleSaveParole = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!formData.title.trim() || !formData.speaker.trim()) {
      setSaveError('Veuillez renseigner le titre et le prédicateur.');
      return;
    }

    setIsSaving(true);
    try {
      let finalResult = recordedResult;

      // Auto-stop if user clicked save while recording is still running
      if (recorderState.isRecording && recorderManagerRef.current) {
        const stopped = await recorderManagerRef.current.stop();
        if (stopped.blob && stopped.blob.size > 0) {
          finalResult = {
            blob: stopped.blob,
            mimeType: stopped.mimeType,
            duration: stopped.duration,
            mediaType: captureMethod === 'video' ? 'video' : 'audio',
            previewUrl: URL.createObjectURL(stopped.blob),
          };
        }
      }

      if (!finalResult || !finalResult.blob || finalResult.blob.size === 0) {
        setSaveError(
          "Veuillez enregistrer ou importer un fichier audio/vidéo avant de sauvegarder la parole."
        );
        setIsSaving(false);
        return;
      }

      const id = `parole_${Date.now()}`;
      const blobKey = `blob_${id}`;
      await dbService.saveMediaBlob(blobKey, finalResult.blob, finalResult.mimeType);

      const sizeKB = finalResult.blob.size / 1024;
      const sizeFormatted =
        sizeKB >= 1024 ? `${(sizeKB / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(sizeKB))} Ko`;

      const newParole: RecordedParole = {
        id,
        title: formData.title.trim(),
        type: formData.type,
        speaker: formData.speaker.trim(),
        moderator: formData.moderator.trim() || undefined,
        activityGenre: formData.activityGenre,
        bibleVerse: formData.bibleVerse.trim() || undefined,
        notes: formData.notes.trim() || undefined,
        date: new Date().toISOString().split('T')[0],
        durationSeconds: finalResult.duration,
        mediaType: finalResult.mediaType,
        mimeType: finalResult.mimeType,
        blobKey,
        fileSizeFormatted: sizeFormatted,
        createdAt: new Date().toISOString(),
      };

      await dbService.put(STORES.RECORDINGS, newParole);
      const info = await dbService.getStorageEstimate();
      setStorageInfo({ usageMB: info.usageMB, quotaMB: info.quotaMB });

      resetFormAndPreview();
      setIsRecordingModalOpen(false);
      await reloadData();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePlayParole = async (parole: RecordedParole) => {
    setPlaybackError(null);
    if (playingBlobUrl) {
      URL.revokeObjectURL(playingBlobUrl);
      setPlayingBlobUrl(null);
    }
    setPlayingParole(parole);

    if (!parole.blobKey) {
      setPlaybackError('Aucun fichier audio ou vidéo associé à cette fiche.');
      return;
    }

    try {
      const blob = await dbService.getMediaBlob(parole.blobKey);
      if (!blob || blob.size === 0) {
        setPlaybackError("Le fichier média n'a pas été trouvé dans le stockage local.");
        return;
      }
      const typedBlob = blob.type ? blob : new Blob([blob], { type: parole.mimeType || 'audio/webm' });
      const url = URL.createObjectURL(typedBlob);
      setPlayingBlobUrl(url);
    } catch {
      setPlaybackError('Erreur lors du chargement du fichier média.');
    }
  };

  const handleDownloadParole = () => {
    if (!playingBlobUrl || !playingParole) return;
    const ext = playingParole.mediaType === 'video' ? 'webm' : 'webm';
    const a = document.createElement('a');
    a.href = playingBlobUrl;
    a.download = `${playingParole.title.replace(/[^a-z0-9]/gi, '_')}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleConfirmDelete = async () => {
    if (!deletingId) return;
    const item = recordings.find((r) => r.id === deletingId);
    if (item && item.blobKey) {
      await dbService.deleteItem(STORES.MEDIA_BLOBS, item.blobKey);
    }
    await dbService.deleteItem(STORES.RECORDINGS, deletingId);
    setDeletingId(null);
    if (playingParole?.id === deletingId) {
      setPlayingParole(null);
    }
    reloadData();
  };

  const ACTIVITY_GENRES: { id: ActivityGenre; label: string }[] = [
    { id: 'culte_dominical', label: 'Culte Dominical' },
    { id: 'culte_enseignement', label: 'Culte d’Enseignement' },
    { id: 'reunion_priere', label: 'Réunion de Prière' },
    { id: 'seminaire', label: 'Séminaire' },
    { id: 'veillee', label: 'Veillée de Prière' },
    { id: 'convention', label: 'Convention' },
    { id: 'conference', label: 'Conférence' },
    { id: 'formation', label: 'Formation des Disciples' },
    { id: 'reunion_speciale', label: 'Réunion Spéciale' },
    { id: 'autre', label: 'Autre' },
  ];

  const filteredRecordings = recordings.filter((r) => {
    const matchesSearch =
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.speaker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.bibleVerse && r.bibleVerse.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesType = activeFilterType === 'all' || r.type === activeFilterType;
    const matchesActivity = selectedActivity === 'all' || r.activityGenre === selectedActivity;
    return matchesSearch && matchesType && matchesActivity;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight font-display">
            Parole Divine & Enregistrements
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Enregistrez, écoutez et archivez vos prédications, exhortations et enseignements hors-ligne
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            resetFormAndPreview();
            setIsRecordingModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs active:scale-[0.98] transition self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle Parole</span>
        </button>
      </div>

      {/* Storage bar */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
        <div className="flex items-center gap-2">
          <HardDrive className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          <span>
            Stockage local utilisé : <strong className="tabular-nums">{storageInfo.usageMB} Mo</strong> · Quota estimé : <strong className="tabular-nums">{storageInfo.quotaMB} Mo</strong>
          </span>
        </div>
        <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">
          Garder l’écran ouvert au premier plan durant l’enregistrement.
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center justify-between">
        <div className="flex flex-1 gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Rechercher par thème, prédicateur, verset..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-white dark:bg-[#0c1631] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-600 focus:outline-hidden"
            />
          </div>

          <select
            value={selectedActivity}
            onChange={(e) => setSelectedActivity(e.target.value)}
            className="text-xs px-3 py-2 rounded-xl bg-white dark:bg-[#0c1631] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="all">Toutes activités</option>
            {ACTIVITY_GENRES.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/80 self-start sm:self-auto">
          {[
            { id: 'all', label: 'Tout' },
            { id: 'predication', label: 'Prédications' },
            { id: 'enseignement', label: 'Enseignements' },
            { id: 'exhortation', label: 'Exhortations' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveFilterType(item.id)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                activeFilterType === item.id
                  ? 'bg-white dark:bg-[#0f2b5c] text-blue-700 dark:text-blue-200 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Recordings List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredRecordings.map((parole) => {
          const activityObj = ACTIVITY_GENRES.find((a) => a.id === parole.activityGenre);

          return (
            <div
              key={parole.id}
              className="p-5 rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80 flex flex-col justify-between space-y-4 hover:border-slate-300 dark:hover:border-slate-700 transition"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-blue-700 dark:text-blue-400 capitalize">
                    {parole.type} · {parole.mediaType === 'video' ? 'Vidéo' : 'Audio'}
                  </span>
                  <span className="tabular-nums">{parole.date}</span>
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white line-clamp-2">
                  {parole.title}
                </h3>

                <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                  <div className="flex items-center gap-1.5 font-medium text-slate-800 dark:text-slate-200">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span>{parole.speaker}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    <span>{activityObj?.label || 'Culte'}</span>
                  </div>
                  {parole.bibleVerse && (
                    <p className="text-xs text-amber-700 dark:text-amber-400 font-serif italic">
                      {parole.bibleVerse}
                    </p>
                  )}
                  {parole.notes && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 pt-1">
                      {parole.notes}
                    </p>
                  )}
                </div>
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => handlePlayParole(parole)}
                    className="px-3.5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{parole.mediaType === 'video' ? 'Lire vidéo' : 'Écouter'}</span>
                  </button>
                  <span className="text-xs text-slate-500 tabular-nums">
                    {formatSeconds(parole.durationSeconds)}
                    {parole.fileSizeFormatted ? ` · ${parole.fileSizeFormatted}` : ''}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => setDeletingId(parole.id)}
                  aria-label="Supprimer"
                  className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}

        {filteredRecordings.length === 0 && (
          <div className="col-span-full py-14 text-center rounded-2xl bg-white dark:bg-[#0c1631] border border-slate-200/80 dark:border-slate-800/80">
            <Mic className="w-10 h-10 text-slate-400 mx-auto mb-3" />
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Aucune parole enregistrée pour le moment
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              Enregistrez un message audio ou vidéo directement avec votre micro/caméra ou importez un fichier depuis votre appareil.
            </p>
            <button
              type="button"
              onClick={() => {
                resetFormAndPreview();
                setIsRecordingModalOpen(true);
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-bold"
            >
              Enregistrer une première parole
            </button>
          </div>
        )}
      </div>

      {/* Modal: New Parole */}
      <Modal
        isOpen={isRecordingModalOpen}
        onClose={handleCancelRecording}
        title="Nouvelle Parole Divine"
        subtitle="Capture audio/vidéo directe ou importation de fichier média"
        maxWidth="xl"
      >
        <div className="space-y-4">
          {!recorderState.isRecording && (
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setCaptureMethod('mic')}
                className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
                  captureMethod === 'mic'
                    ? 'bg-white dark:bg-[#0f2b5c] text-blue-700 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Mic className="w-3.5 h-3.5" />
                <span>Audio Micro</span>
              </button>
              <button
                type="button"
                onClick={() => setCaptureMethod('video')}
                className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
                  captureMethod === 'video'
                    ? 'bg-white dark:bg-[#0f2b5c] text-blue-700 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Video className="w-3.5 h-3.5" />
                <span>Vidéo Caméra</span>
              </button>
              <button
                type="button"
                onClick={() => setCaptureMethod('import')}
                className={`py-2 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 transition ${
                  captureMethod === 'import'
                    ? 'bg-white dark:bg-[#0f2b5c] text-blue-700 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Importer Fichier</span>
              </button>
            </div>
          )}

          {/* Capture Studio Panel */}
          <div className="p-5 rounded-2xl bg-[#0b1736] text-white flex flex-col items-center justify-center min-h-[190px] relative overflow-hidden">
            {captureMethod === 'video' && (
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                className={`w-full max-h-48 object-cover rounded-xl mb-3 ${
                  recorderState.isRecording ? 'block' : 'hidden'
                }`}
              />
            )}

            {recorderState.isRecording ? (
              <div className="space-y-3 text-center w-full max-w-xs">
                <div className="flex items-center justify-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-bold tracking-wide text-red-300">
                    {recorderState.isPaused ? 'En pause' : 'Capture en cours...'}
                  </span>
                </div>

                <div className="text-4xl font-extrabold tabular-nums font-mono">
                  {formatSeconds(recorderState.durationSeconds)}
                </div>

                {/* Real-time Audio Level Meter */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-blue-200">
                    <span>Signal Microphone</span>
                    <span className="tabular-nums">{recorderState.audioLevel}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-emerald-400 transition-all duration-75 rounded-full"
                      style={{ width: `${Math.max(4, recorderState.audioLevel)}%` }}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handlePauseResume}
                    className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 text-white transition"
                    title={recorderState.isPaused ? 'Reprendre' : 'Pause'}
                  >
                    {recorderState.isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
                  </button>

                  <button
                    type="button"
                    onClick={handleStopRecording}
                    className="px-5 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs flex items-center gap-2 transition"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    <span>Terminer & Pré-écouter</span>
                  </button>
                </div>
              </div>
            ) : recordedResult ? (
              <div className="space-y-3 text-center w-full max-w-sm">
                <div className="flex items-center justify-center gap-2 text-emerald-400 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Média prêt ({formatSeconds(recordedResult.duration)} ·{' '}
                    {(recordedResult.blob.size / 1024).toFixed(0)} Ko)
                  </span>
                </div>

                {recordedResult.mediaType === 'video' ? (
                  <video
                    src={recordedResult.previewUrl}
                    controls
                    playsInline
                    className="w-full rounded-xl max-h-44 bg-black"
                  />
                ) : (
                  <audio src={recordedResult.previewUrl} controls className="w-full" />
                )}

                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(recordedResult.previewUrl);
                    setRecordedResult(null);
                  }}
                  className="text-xs text-slate-300 hover:text-white underline"
                >
                  Recommencer ou remplacer le média
                </button>
              </div>
            ) : captureMethod === 'import' ? (
              <div className="space-y-3 text-center">
                <Upload className="w-8 h-8 text-blue-300 mx-auto" />
                <p className="text-xs text-slate-300 max-w-xs">
                  Sélectionnez un enregistrement audio (.mp3, .m4a, .wav, .webm) ou vidéo (.mp4, .webm) déjà présent sur votre téléphone.
                </p>
                <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold cursor-pointer transition">
                  <Upload className="w-4 h-4" />
                  <span>Choisir un fichier</span>
                  <input
                    type="file"
                    accept="audio/*,video/*"
                    onChange={handleImportMediaFile}
                    className="hidden"
                  />
                </label>
              </div>
            ) : (
              <div className="space-y-3 text-center">
                <div className="w-12 h-12 rounded-full bg-blue-600/30 text-blue-300 flex items-center justify-center mx-auto">
                  {captureMethod === 'mic' ? <Mic className="w-6 h-6" /> : <Video className="w-6 h-6" />}
                </div>
                {captureMethod === 'video' && (
                  <div className="flex items-center justify-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setFacingMode('user')}
                      className={`px-2.5 py-1 rounded-lg ${facingMode === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                    >
                      Caméra avant
                    </button>
                    <button
                      type="button"
                      onClick={() => setFacingMode('environment')}
                      className={`px-2.5 py-1 rounded-lg ${facingMode === 'environment' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}
                    >
                      Caméra arrière
                    </button>
                  </div>
                )}
                <p className="text-xs text-slate-300 max-w-xs">
                  Accordez l’accès au microphone pour capter clairement la voix du prédicateur.
                </p>
                <button
                  type="button"
                  onClick={handleStartRecording}
                  className="px-6 py-2.5 rounded-full bg-red-600 hover:bg-red-500 text-white font-bold text-xs inline-flex items-center gap-2 transition"
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-white" />
                  <span>Démarrer l’enregistrement</span>
                </button>
              </div>
            )}
          </div>

          {saveError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{saveError}</span>
            </div>
          )}

          {/* Metadata Form */}
          <form onSubmit={handleSaveParole} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Titre / Thème de la parole *
              </label>
              <input
                type="text"
                required
                placeholder="Ex: La paix qui surpasse toute intelligence..."
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Type *
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as ParoleType })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="predication">Prédication</option>
                  <option value="enseignement">Enseignement</option>
                  <option value="exhortation">Exhortation</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Prédicateur / Enseignant *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Pasteur David..."
                  value={formData.speaker}
                  onChange={(e) => setFormData({ ...formData, speaker: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Modérateur
                </label>
                <input
                  type="text"
                  placeholder="Ex: Frère Thomas..."
                  value={formData.moderator}
                  onChange={(e) => setFormData({ ...formData, moderator: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Genre d’activité
                </label>
                <select
                  value={formData.activityGenre}
                  onChange={(e) => setFormData({ ...formData, activityGenre: e.target.value as ActivityGenre })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                >
                  {ACTIVITY_GENRES.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Référence biblique
                </label>
                <input
                  type="text"
                  placeholder="Ex: Jean 14:27"
                  value={formData.bibleVerse}
                  onChange={(e) => setFormData({ ...formData, bibleVerse: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Notes & Points clés
              </label>
              <textarea
                rows={2}
                placeholder="Résumé du message..."
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={handleCancelRecording}
                className="px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 disabled:opacity-50 rounded-xl"
              >
                {isSaving ? 'Enregistrement...' : 'Sauvegarder la Parole'}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Playback Modal */}
      {playingParole && (
        <Modal
          isOpen={!!playingParole}
          onClose={() => {
            setPlayingParole(null);
            if (playingBlobUrl) URL.revokeObjectURL(playingBlobUrl);
            setPlayingBlobUrl(null);
          }}
          title={playingParole.title}
          subtitle={`Par ${playingParole.speaker} · ${playingParole.date}`}
        >
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-[#0b1736] text-white flex flex-col items-center justify-center">
              {playingBlobUrl ? (
                playingParole.mediaType === 'video' ? (
                  <video
                    src={playingBlobUrl}
                    controls
                    autoPlay
                    playsInline
                    className="w-full rounded-xl max-h-64 bg-black"
                  />
                ) : (
                  <div className="w-full space-y-3">
                    <div className="flex items-center justify-center gap-2 text-blue-300 text-xs">
                      <Volume2 className="w-5 h-5" />
                      <span>Lecture audio haute fidélité</span>
                    </div>
                    <audio src={playingBlobUrl} controls autoPlay className="w-full" />
                  </div>
                )
              ) : (
                <div className="py-6 text-center text-red-300 text-xs space-y-1">
                  <AlertCircle className="w-7 h-7 mx-auto mb-1" />
                  <p>{playbackError || 'Chargement du média...'}</p>
                </div>
              )}
            </div>

            <div className="space-y-2 text-xs text-slate-700 dark:text-slate-300">
              {playingParole.bibleVerse && (
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-amber-900 dark:text-amber-200 font-serif italic">
                  {playingParole.bibleVerse}
                </div>
              )}
              {playingParole.notes && (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                  <span className="font-bold block mb-1">Notes :</span>
                  <p className="leading-relaxed whitespace-pre-wrap">{playingParole.notes}</p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
              {playingBlobUrl ? (
                <button
                  type="button"
                  onClick={handleDownloadParole}
                  className="px-3.5 py-2 text-xs font-semibold text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-xl flex items-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger le fichier</span>
                </button>
              ) : (
                <div />
              )}
              <button
                type="button"
                onClick={() => {
                  setPlayingParole(null);
                  if (playingBlobUrl) URL.revokeObjectURL(playingBlobUrl);
                  setPlayingBlobUrl(null);
                }}
                className="px-4 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 rounded-xl"
              >
                Fermer
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={!!deletingId}
        title="Supprimer cet enregistrement ?"
        message="Cette action supprimera définitivement le fichier audio/vidéo et sa fiche du stockage local."
        confirmLabel="Supprimer définitivement"
        isDestructive
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeletingId(null)}
      />
    </div>
  );
};
