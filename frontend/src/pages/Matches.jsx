import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MessageCircle, Briefcase, Building2, Calendar, ChevronRight } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import { getPhotoUrl } from '../utils/helpers';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Matches() {
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

  const handleOpenChat = (matchId) => {
    navigate(`/chat/${matchId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 md:p-8">
        <h1 className="text-2xl font-bold font-['Outfit']">Matches</h1>
        <p className="text-muted-foreground">Your successful connections</p>
      </header>

      {/* Matches List */}
      <main className="relative z-10 px-6 md:px-8">
        <div className="max-w-lg mx-auto">
          {matches.length > 0 ? (
            <div className="space-y-4">
              {matches.map((match) => (
                <div 
                  key={match.id}
                  onClick={() => handleOpenChat(match.id)}
                  className="glass-card rounded-2xl p-5 hover:border-primary/30 transition-colors cursor-pointer"
                  data-testid={`match-${match.id}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar or Logo */}
                    <div className="relative">
                      {user?.role === 'seeker' ? (
                        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                          <Building2 className="w-7 h-7 text-white" />
                        </div>
                      ) : (
                        <img 
                          src={getPhotoUrl(match.seeker_avatar, match.seeker_id)}
                          alt={match.seeker_name}
                          className="w-14 h-14 rounded-xl object-cover border-2 border-primary/50"
                        />
                      )}
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-success flex items-center justify-center">
                        <Heart className="w-3 h-3 text-white fill-white" />
                      </div>
                    </div>

                    {/* Match Info */}
                    <div className="flex-1 min-w-0">
                      {user?.role === 'seeker' ? (
                        <>
                          <h3 className="font-bold font-['Outfit'] text-lg">{match.job_title}</h3>
                          <p className="text-muted-foreground text-sm">{match.company}</p>
                        </>
                      ) : (
                        <>
                          <h3 className="font-bold font-['Outfit'] text-lg">{match.seeker_name}</h3>
                          <p className="text-muted-foreground text-sm">Applied for: {match.job_title}</p>
                        </>
                      )}
                      
                      {/* Last message preview */}
                      {match.last_message && (
                        <p className="text-sm text-muted-foreground mt-2 truncate">
                          {match.last_message_sender === user?.id ? 'You: ' : ''}{match.last_message}
                        </p>
                      )}
                      
                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" />
                        Matched {new Date(match.created_at).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex items-center gap-2">
                      <div className="p-3 rounded-xl bg-primary/10 text-primary">
                        <MessageCircle className="w-5 h-5" />
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-card rounded-3xl p-12 text-center">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
                <Heart className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold font-['Outfit'] mb-3">No Matches Yet</h2>
              <p className="text-muted-foreground max-w-xs mx-auto">
                {user?.role === 'seeker' 
                  ? "Keep swiping! When a recruiter likes you back, you'll see your matches here."
                  : "Accept applications from job seekers to create matches and start conversations."}
              </p>
            </div>
          )}
        </div>
      </main>

      <Navigation />
    </div>
  );
}
