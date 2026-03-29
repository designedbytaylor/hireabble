import { useState, useRef } from 'react';
import { Video, Upload, X, Play, Pause, Trash2, Mic, Clock, Sparkles } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const ELEVATOR_PITCH_PROMPTS = [
  {
    id: 'introduce',
    label: 'Introduce yourself',
    description: 'Tell recruiters who you are, your background, and what drives you.',
    icon: Mic,
  },
  {
    id: 'achievement',
    label: 'Your biggest win',
    description: 'Share a professional achievement you\'re most proud of.',
    icon: Sparkles,
  },
  {
    id: 'why_hire',
    label: 'Why hire you?',
    description: 'Explain what makes you the right fit and what value you bring.',
    icon: Video,
  },
];

export default function VideoUpload({ token, currentVideoUrl, onVideoChange }) {
  const [uploading, setUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState(currentVideoUrl || '');
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  const getFullVideoUrl = (url) => {
    if (!url) return null;
    // Full URLs are returned as-is; relative paths get the backend URL prepended
    if (url.startsWith('http')) return url;
    return `${BACKEND_URL}${url}`;
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please upload a valid video file (MP4, WebM, or MOV)');
      return;
    }

    // Validate file size (50MB max)
    if (file.size > 50 * 1024 * 1024) {
      toast.error('Video must be under 50MB');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API}/upload/video`, formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      const newVideoUrl = response.data.video_url;
      setVideoUrl(newVideoUrl);
      onVideoChange?.(newVideoUrl);
      toast.success('Elevator pitch uploaded successfully!');
    } catch (error) {
      console.error('Video upload error:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload video');
    } finally {
      setUploading(false);
      setSelectedPrompt(null);
    }
  };

  const handleDelete = async () => {
    try {
      await axios.delete(`${API}/upload/video`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVideoUrl('');
      onVideoChange?.(null);
      toast.success('Video removed');
    } catch (error) {
      toast.error('Failed to remove video');
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handlePromptSelect = (prompt) => {
    setSelectedPrompt(prompt);
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Video className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Elevator Pitch</h3>
        <span className="text-xs text-muted-foreground">(Optional)</span>
      </div>

      <p className="text-sm text-muted-foreground">
        Record a 60-second elevator pitch to stand out to recruiters.
        Candidates with video intros get <strong className="text-foreground">3x more views</strong>.
      </p>

      {videoUrl ? (
        <div className="relative rounded-2xl overflow-hidden bg-black/5 border border-border">
          <video
            ref={videoRef}
            src={getFullVideoUrl(videoUrl)}
            className="w-full aspect-video object-contain"
            onEnded={() => setIsPlaying(false)}
            playsInline
            data-testid="video-preview"
          />

          {/* Video Controls Overlay */}
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
            <button
              onClick={togglePlay}
              className="w-16 h-16 rounded-full bg-white/90 flex items-center justify-center hover:bg-white transition-colors"
              data-testid="video-play-btn"
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 text-gray-800" />
              ) : (
                <Play className="w-8 h-8 text-gray-800 ml-1" />
              )}
            </button>
          </div>

          {/* Delete Button */}
          <button
            onClick={handleDelete}
            className="absolute top-3 right-3 p-2 rounded-full bg-red-500/90 text-white hover:bg-red-600 transition-colors"
            data-testid="video-delete-btn"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Guided Prompts */}
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Choose a prompt to get started</p>
          <div className="grid gap-2">
            {ELEVATOR_PITCH_PROMPTS.map((prompt) => {
              const Icon = prompt.icon;
              return (
                <button
                  key={prompt.id}
                  onClick={() => handlePromptSelect(prompt)}
                  disabled={uploading}
                  className={`flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                    uploading ? 'opacity-50 pointer-events-none' : 'border-border hover:border-primary/50 hover:bg-primary/5'
                  }`}
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{prompt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{prompt.description}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Or plain upload */}
          <div className="relative flex items-center gap-3 my-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <div
            onClick={() => fileInputRef.current?.click()}
            className={`relative rounded-2xl border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer p-6 text-center ${
              uploading ? 'pointer-events-none opacity-60' : ''
            }`}
            data-testid="video-upload-area"
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
                <p className="text-sm text-muted-foreground">Uploading video...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-6 h-6 text-muted-foreground" />
                <p className="text-sm font-medium">Upload an existing video</p>
                <p className="text-xs text-muted-foreground">MP4, WebM or MOV (max 50MB)</p>
              </div>
            )}
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        onChange={handleUpload}
        className="hidden"
        data-testid="video-file-input"
      />

      <div className="flex items-start gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10">
        <Clock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Keep it under 60 seconds.</strong>{' '}
          Be natural, mention your key skills, and share what makes you unique. Recruiters love seeing the person behind the resume!
        </p>
      </div>
    </div>
  );
}
