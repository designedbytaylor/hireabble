import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, Building2, Clock } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import { getPhotoUrl, handleImgError } from '../utils/helpers';
import { SkeletonPageBackground, SkeletonListItem } from '../components/skeletons';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function ProfileViewers() {
  const navigate = useNavigate();
  const { token } = useAuth();
  const [viewers, setViewers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalViews, setTotalViews] = useState(0);

  useEffect(() => {
    fetchViewers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchViewers = async () => {
    try {
      const response = await axios.get(`${API}/profile/viewers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setViewers(response.data.viewers || []);
      setTotalViews(response.data.total_views || 0);

      if (response.data.locked) {
        navigate('/upgrade');
      }
    } catch (error) {
      toast.error('Failed to load profile viewers');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <SkeletonPageBackground />
        <header className="relative z-10 p-6 md:p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-9 h-9 rounded-xl bg-accent animate-pulse" />
            <div className="space-y-2">
              <div className="h-7 w-40 bg-accent rounded animate-pulse" />
              <div className="h-3.5 w-24 bg-accent rounded animate-pulse" />
            </div>
          </div>
        </header>
        <main className="relative z-10 px-6 md:px-8 space-y-3">
          <SkeletonListItem avatarSize="w-12 h-12" avatarShape="rounded-full" lines={2} />
          <SkeletonListItem avatarSize="w-12 h-12" avatarShape="rounded-full" lines={2} />
          <SkeletonListItem avatarSize="w-12 h-12" avatarShape="rounded-full" lines={2} />
        </main>
        <Navigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 md:p-8">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-accent transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold font-['Outfit']">Profile Views</h1>
            <p className="text-muted-foreground text-sm">
              {totalViews} recruiter{totalViews !== 1 ? 's' : ''} viewed your profile
            </p>
          </div>
        </div>
      </header>

      <main className="relative z-10 px-6 md:px-8 space-y-3">
        {viewers.length === 0 ? (
          <div className="glass-card rounded-3xl p-12 text-center">
            <div className="w-20 h-20 rounded-full bg-amber-500/20 flex items-center justify-center mx-auto mb-6">
              <Eye className="w-10 h-10 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold font-['Outfit'] mb-3">No Views Yet</h2>
            <p className="text-muted-foreground">
              Complete your profile and keep swiping to get noticed by recruiters!
            </p>
          </div>
        ) : (
          viewers.map((viewer) => (
            <div
              key={viewer.viewer_id}
              className="glass-card rounded-2xl p-4 hover:border-amber-500/30 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  {viewer.photo_url ? (
                    <img
                      src={getPhotoUrl(viewer.photo_url)}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={handleImgError}
                      loading="lazy"
                    />
                  ) : (
                    <Building2 className="w-6 h-6 text-primary" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-bold font-['Outfit'] truncate">{viewer.name}</h3>
                  {viewer.company && (
                    <p className="text-sm text-muted-foreground">{viewer.company}</p>
                  )}
                </div>

                <span className="text-xs text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                  <Clock className="w-3 h-3" />
                  {timeAgo(viewer.viewed_at)}
                </span>
              </div>
            </div>
          ))
        )}
      </main>

      <Navigation />
    </div>
  );
}
