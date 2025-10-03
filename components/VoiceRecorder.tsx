import React, { useState, useRef, useEffect } from 'react';
import { VoiceNote } from '../types';
import { formatDuration, downloadBlob } from '../utils/helpers';
import { useToast } from '../hooks/useToast';

interface VoiceRecorderProps {
  currentVoiceNotes: VoiceNote[];
  newVoiceNotes: {blob: Blob, durationMs: number, id: string}[];
  onNewVoiceNotesChange: (notes: {blob: Blob, durationMs: number, id: string}[]) => void;
  onCurrentVoiceNotesChange: (notes: VoiceNote[]) => void;
  onVoiceNotesToRemoveChange: React.Dispatch<React.SetStateAction<VoiceNote[]>>;
}

const MicIcon: React.FC<{className?: string}> = ({className}) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
);
const StopIcon: React.FC<{className?: string}> = ({className}) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h12v12H6z" /></svg>
);
const PlayIcon: React.FC<{className?: string}> = ({className}) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
);
const PauseIcon: React.FC<{className?: string}> = ({className}) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg>
);


const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ currentVoiceNotes, newVoiceNotes, onNewVoiceNotesChange, onCurrentVoiceNotesChange, onVoiceNotesToRemoveChange }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const currentAudioUrlRef = useRef<string | null>(null);
  const [playingNoteId, setPlayingNoteId] = useState<string | null>(null);
  const { showToast } = useToast();

  useEffect(() => {
    const audio = audioPlayerRef.current;
    if (!audio) return;

    const handleEnded = () => setPlayingNoteId(null);
    const handlePause = () => setPlayingNoteId(null);
    
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('pause', handlePause);
      if (currentAudioUrlRef.current && currentAudioUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
      }
    };
  }, []);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = event => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        onNewVoiceNotesChange([...newVoiceNotes, {blob: audioBlob, durationMs: recordingTime, id: crypto.randomUUID() }]);
        audioChunksRef.current = [];
        stream.getTracks().forEach(track => track.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1000);
      }, 1000);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      showToast("Mikrofona erişilemedi. Lütfen izinleri kontrol edin.", "error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const removeNewVoiceNote = (index: number) => {
    onNewVoiceNotesChange(newVoiceNotes.filter((_, i) => i !== index));
  };

  const removeCurrentVoiceNote = (note: VoiceNote) => {
    if (playingNoteId === note.id) {
        stopPlayback();
    }
    onCurrentVoiceNotesChange(currentVoiceNotes.filter(vn => vn.id !== note.id));
    onVoiceNotesToRemoveChange(prev => [...prev, note]);
  };

  const stopPlayback = () => {
    const audio = audioPlayerRef.current;
    if (audio) {
        audio.pause();
    }
    setPlayingNoteId(null);
  }
  
  const playUrl = (url: string, noteId: string) => {
    const audio = audioPlayerRef.current;
    if (!audio) return;

    if (playingNoteId === noteId) {
        audio.pause();
        return;
    }
    
    if (currentAudioUrlRef.current && currentAudioUrlRef.current.startsWith('blob:')) {
        URL.revokeObjectURL(currentAudioUrlRef.current);
    }

    currentAudioUrlRef.current = url;
    audio.src = url;

    audio.play().catch(e => {
        console.error("Audio playback failed:", e);
        showToast("Ses oynatılamadı.", "error");
        if (url.startsWith('blob:')) URL.revokeObjectURL(url);
        currentAudioUrlRef.current = null;
        setPlayingNoteId(null);
    });
    setPlayingNoteId(noteId);
  }

  const playBlob = (blob: Blob, noteId: string) => {
    const url = URL.createObjectURL(blob);
    playUrl(url, noteId);
  }

  const playCurrentVoiceNote = async (note: VoiceNote) => {
    if (playingNoteId === note.id) {
        stopPlayback();
        return;
    }
    playUrl(note.url, note.id);
  }

  const downloadCurrentVoiceNote = async (note: VoiceNote) => {
    try {
        const response = await fetch(note.url);
        const blob = await response.blob();
        downloadBlob(blob, `seslinot-${note.id}.webm`);
    } catch(err) {
        showToast("Sesli not indirilemedi.", "error");
    }
  }

  return (
    <div>
      <audio ref={audioPlayerRef} style={{ display: 'none' }} />
      <label className="block text-sm font-medium text-gray-700">Sesli Notlar</label>
      <div className="mt-1 flex items-center gap-4">
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          className={`flex items-center justify-center w-12 h-12 rounded-full text-white shadow-md transition-colors ${isRecording ? 'bg-red-500 hover:bg-red-600' : 'bg-blue-500 hover:bg-blue-600'}`}
        >
          {isRecording ? <StopIcon className="w-6 h-6"/> : <MicIcon className="w-6 h-6"/>}
        </button>
        {isRecording && <div className="text-lg font-mono">{formatDuration(recordingTime)}</div>}
      </div>

      {(currentVoiceNotes.length > 0 || newVoiceNotes.length > 0) && (
        <ul className="mt-4 space-y-2">
           {currentVoiceNotes.map(note => (
            <li key={note.id} className="flex items-center justify-between p-2 bg-white rounded border border-gray-200">
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => playCurrentVoiceNote(note)} className="text-blue-500">
                      {playingNoteId === note.id ? <PauseIcon className="w-5 h-5"/> : <PlayIcon className="w-5 h-5"/>}
                    </button>
                    <span>Sesli Not ({formatDuration(note.durationMs)})</span>
                </div>
                <div>
                    <button type="button" onClick={() => downloadCurrentVoiceNote(note)} className="text-blue-500 hover:text-blue-700 mr-2">İndir</button>
                    <button type="button" onClick={() => removeCurrentVoiceNote(note)} className="text-red-500 hover:text-red-700">Kaldır</button>
                </div>
            </li>
          ))}
          {newVoiceNotes.map((note, index) => (
            <li key={note.id} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                 <div className="flex items-center gap-2">
                    <button type="button" onClick={() => playBlob(note.blob, note.id)} className="text-blue-500">
                      {playingNoteId === note.id ? <PauseIcon className="w-5 h-5"/> : <PlayIcon className="w-5 h-5"/>}
                    </button>
                    <span>Yeni Sesli Not ({formatDuration(note.durationMs)})</span>
                 </div>
              <button type="button" onClick={() => removeNewVoiceNote(index)} className="text-red-500 hover:text-red-700">Kaldır</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default VoiceRecorder;
