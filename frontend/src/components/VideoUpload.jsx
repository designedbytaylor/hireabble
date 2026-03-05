import { useState, useRef } from 'react';
import { Video, Upload, X, Play, Pause, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

export default function VideoUpload({ token, currentVideoUrl, onVideoChange }) {
  const [uploading, setUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState(currentVideoUrl || '');
  const [isPlaying, setIsPlaying] = useState(false);
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);

  const getFullVideoUrl = (url) => {
    if (!url) return null;
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
      toast.success('Video intro uploaded successfully!');
    } catch (error) {
      console.error('Video upload error:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload video');
    } finally {
      setUploading(false);
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

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Video className="w-5 h-5 text-primary" />
        <h3 className="font-semibold">Video Introduction</h3>
        <span className="text-xs text-muted-foreground">(Optional)</span>
      </div>
      
      <p className="text-sm text-muted-foreground">
        Record a short video (30-60 seconds) to introduce yourself to recruiters. 
        This helps you stand out and show your personality!
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
        <div
          onClick={() => fileInputRef.current?.click()}
          className={`relative rounded-2xl border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer p-8 text-center ${
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
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Upload className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="font-medium">Click to upload video</p>
                <p className="text-sm text-muted-foreground mt-1">MP4, WebM or MOV (max 50MB)</p>
              </div>
            </div>
          )}
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
        <Video className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground">
          <strong className="text-foreground">Tip:</strong> Keep it brief and professional. 
          Mention your key skills, what you're looking for, and what makes you unique!
        </p>
      </div>
    </div>
  );
}
