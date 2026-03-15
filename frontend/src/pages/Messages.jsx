import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle, ArrowLeft, Building2, User } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import { getPhotoUrl, handleImgError } from '../utils/helpers';
import { SkeletonPageBackground, SkeletonListItem } from '../components/skeletons';
import { Skeleton } from '../components/ui/skeleton';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Messages() {
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMatches();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchMatches = async () => {
    try {
      const response = await axios.get(`${API}/matches`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMatches(response.data);
    } catch (error) {
      console.error('Failed to fetch matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d`;
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <SkeletonPageBackground />
        <header className="relative z-10 p-6 md:p-8">
          <Skeleton className="h-7 w-28 rounded mb-2" />
          <Skeleton className="h-4 w-40 rounded" />
        </header>
        <main className="relative z-10 px-6 md:px-8">
          <div className="max-w-lg mx-auto space-y-2">
            <SkeletonListItem avatarSize="w-12 h-12" avatarShape="rounded-xl" lines={3} />
            <SkeletonListItem avatarSize="w-12 h-12" avatarShape="rounded-xl" lines={3} />
            <SkeletonListItem avatarSize="w-12 h-12" avatarShape="rounded-xl" lines={3} />
            <SkeletonListItem avatarSize="w-12 h-12" avatarShape="rounded-xl" lines={3} />
          </div>
        </main>
        <Navigation />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 p-6 md:p-8">
        <h1 className="text-2xl font-bold font-['Outfit']">Messages</h1>
        <p className="text-muted-foreground">Your conversations</p>
      </header>

      <main className="relative z-10 px-6 md:px-8">
        <div className="max-w-lg mx-auto">
          {(() => {
            // Only show matches that have actual messages (not empty "No messages yet")
            const withMessages = matches.filter(m => m.last_message);
            const withoutMessages = matches.filter(m => !m.last_message);

            return (
              <>
                {withMessages.length > 0 ? (
                  <div className="space-y-2">
                    {withMessages.map((match) => {
                      const isSeeker = user?.role === 'seeker';
                      const name = isSeeker ? (match.company || match.recruiter_name) : match.seeker_name;
                      const subtitle = match.job_title;

                      return (
                        <button
                          key={match.id}
                          onClick={() => navigate(`/chat/${match.id}`)}
                          className="w-full glass-card rounded-2xl p-4 hover:border-primary/30 transition-colors text-left flex items-center gap-4"
                        >
                          {isSeeker ? (
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center shrink-0">
                              <Building2 className="w-6 h-6 text-white" />
                            </div>
                          ) : (
                            <img
                              src={getPhotoUrl(match.seeker_photo || match.seeker_avatar, match.seeker_name || match.seeker_id)}
                              alt={match.seeker_name}
                              className="w-12 h-12 rounded-xl object-cover border-2 border-primary/50 shrink-0"
                              onError={handleImgError(match.seeker_name || match.seeker_id)}
                            />
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h3 className="font-semibold truncate">{name}</h3>
                              {match.last_message_at && (
                                <span className="text-xs text-muted-foreground shrink-0 ml-2">
                                  {formatTime(match.last_message_at)}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{subtitle}</p>
                            <p className="text-sm text-muted-foreground truncate mt-1">
                              {match.last_message_sender === user?.id ? 'You: ' : ''}{match.last_message}
                            </p>
                          </div>

                          {match.unread_count > 0 && (
                            <span className="w-6 h-6 rounded-full bg-primary text-xs font-bold flex items-center justify-center shrink-0">
                              {match.unread_count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="glass-card rounded-3xl p-12 text-center">
                    <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
                      <MessageCircle className="w-10 h-10 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold font-['Outfit'] mb-3">No Messages</h2>
                    <p className="text-muted-foreground max-w-xs mx-auto">
                      Messages from chats, interview requests, and reference requests will appear here.
                    </p>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      </main>

      <Navigation />
    </div>
  );
}
