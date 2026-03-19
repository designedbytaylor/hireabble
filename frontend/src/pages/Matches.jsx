import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart, MessageCircle, Briefcase, Building2, Calendar, ChevronRight,
  X, MapPin, GraduationCap, Clock, User, Mail, ArrowLeft, Star, FileText, Award, Download,
} from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import { getPhotoUrl, handleImgError } from '../utils/helpers';
import { toast } from 'sonner';
import { SkeletonPageBackground, SkeletonListItem } from '../components/skeletons';
import { Skeleton } from '../components/ui/skeleton';
import useDocumentTitle from '../hooks/useDocumentTitle';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function Matches() {
  useDocumentTitle('Matches');
  const navigate = useNavigate();
  const { user, token } = useAuth();
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Profile view state
  const [viewingProfile, setViewingProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const fetchMatches = useCallback(async (retry = 0) => {
    try {
      const response = await axios.get(`${API}/matches`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 15000
      });
      setMatches(response.data);
    } catch (error) {
      // Auto-retry once on timeout/network errors
      if (retry < 1 && (!error.response || error.code === 'ECONNABORTED')) {
        return fetchMatches(retry + 1);
      }
      console.error('Failed to fetch matches:', error);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  // Refetch when page becomes visible (e.g. tab switch, coming back from chat)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchMatches();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchMatches]);

  // Listen for real-time new matches via WebSocket
  useEffect(() => {
    if (!token) return;
    const WS_URL = process.env.REACT_APP_BACKEND_URL?.replace('https://', 'wss://').replace('http://', 'ws://');
    if (!WS_URL) return;
    let ws;
    try {
      ws = new WebSocket(`${WS_URL}/ws`, [`access_token.${token}`]);
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'new_match' && data.match) {
            // Prepend new match immediately so the user sees it without refresh
            setMatches(prev => {
              if (prev.some(m => m.id === data.match.id)) return prev;
              return [data.match, ...prev];
            });
          }
        } catch { /* ignore */ }
      };
    } catch { /* ignore */ }
    return () => { if (ws) ws.close(); };
  }, [token]);

  const handleOpenChat = (matchId) => {
    navigate(`/chat/${matchId}`);
  };

  const handleViewProfile = async (matchId) => {
    setProfileLoading(true);
    try {
      const res = await axios.get(`${API}/matches/${matchId}/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setViewingProfile(res.data);
    } catch (e) {
      toast.error('Failed to load profile');
    } finally {
      setProfileLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <SkeletonPageBackground />
        <header className="relative z-10 p-6 md:p-8">
          <Skeleton className="h-7 w-28 rounded mb-2" />
          <Skeleton className="h-4 w-48 rounded" />
        </header>
        <main className="relative z-10 px-6 md:px-8">
          <div className="max-w-lg mx-auto space-y-4">
            <SkeletonListItem avatarSize="w-14 h-14" avatarShape="rounded-xl" lines={3} actions />
            <SkeletonListItem avatarSize="w-14 h-14" avatarShape="rounded-xl" lines={3} actions />
            <SkeletonListItem avatarSize="w-14 h-14" avatarShape="rounded-xl" lines={3} actions />
            <SkeletonListItem avatarSize="w-14 h-14" avatarShape="rounded-xl" lines={3} actions />
          </div>
        </main>
        <Navigation />
      </div>
    );
  }

  // ==================== PROFILE VIEW ====================
  if (viewingProfile) {
    const p = viewingProfile.profile;
    const m = viewingProfile.match;
    const j = viewingProfile.job;
    const isRecruiterViewing = user?.role === 'recruiter';

    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 left-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-secondary/10 rounded-full blur-3xl" />
        </div>

        <header className="relative z-10 p-6 md:p-8">
          <button
            onClick={() => setViewingProfile(null)}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Matches
          </button>
        </header>

        <main className="relative z-10 px-6 md:px-8">
          <div className="max-w-lg mx-auto space-y-6">
            {/* Profile Header */}
            <div className="glass-card rounded-3xl p-8 text-center">
              {isRecruiterViewing ? (
                (p.photo_url || p.avatar) ? (
                  <img
                    src={getPhotoUrl(p.photo_url, p.name || p.id) || p.avatar}
                    alt={p.name}
                    className="w-24 h-24 rounded-full border-4 border-primary mx-auto object-cover mb-4"
                    onError={handleImgError(p.name || p.id)}
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
                    <User className="w-12 h-12 text-primary" />
                  </div>
                )
              ) : (
                <div className="w-24 h-24 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-12 h-12 text-white" />
                </div>
              )}

              <h1 className="text-2xl font-bold font-['Outfit']">
                {isRecruiterViewing ? p.name : (p.company || p.name)}
              </h1>
              {isRecruiterViewing && p.title && <p className="text-primary mt-1">{p.title}</p>}
              {!isRecruiterViewing && p.name && p.company && (
                <p className="text-primary mt-1">Recruiter: {p.name}</p>
              )}
              <p className="text-muted-foreground text-sm mt-1">
                {isRecruiterViewing ? `Applied for: ${m.job_title}` : `Position: ${m.job_title}`}
              </p>

              {/* Match score */}
              {viewingProfile.match_score != null && (
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-success/10 text-success text-sm font-medium">
                  <Star className="w-4 h-4 fill-success" />
                  {viewingProfile.match_score}% Match
                </div>
              )}

              <div className="flex justify-center gap-3 mt-4">
                <Button
                  onClick={() => handleOpenChat(m.id)}
                  className="rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                >
                  <MessageCircle className="w-4 h-4 mr-2" /> Message
                </Button>
                {isRecruiterViewing && (
                  <Button
                    variant="outline"
                    onClick={() => navigate(`/interviews?match=${m.id}`)}
                    className="rounded-xl border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <Calendar className="w-4 h-4 mr-2" /> Schedule Interview
                  </Button>
                )}
              </div>
            </div>

            {/* Job Details (for seeker viewing) */}
            {!isRecruiterViewing && j && (
              <div className="glass-card rounded-2xl p-6 space-y-3">
                <h2 className="font-bold font-['Outfit'] mb-2">Job Details</h2>
                <div className="flex items-center gap-3 text-sm">
                  <Briefcase className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span className="capitalize">{j.job_type} &middot; {j.experience_level} level</span>
                </div>
                {j.location && (
                  <div className="flex items-center gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span>{j.location}</span>
                  </div>
                )}
                {(j.salary_min || j.salary_max) && (
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-muted-foreground shrink-0">$</span>
                    <span>
                      {j.salary_min ? `$${j.salary_min.toLocaleString()}` : ''}
                      {j.salary_min && j.salary_max ? ' - ' : ''}
                      {j.salary_max ? `$${j.salary_max.toLocaleString()}` : ''}
                    </span>
                  </div>
                )}
                {j.description && (
                  <div className="pt-3 border-t border-border">
                    <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-line">{j.description}</p>
                  </div>
                )}
                {j.requirements?.length > 0 && (
                  <div className="pt-3 border-t border-border">
                    <h3 className="text-sm font-semibold mb-2">Requirements</h3>
                    <div className="flex flex-wrap gap-2">
                      {j.requirements.map((req, i) => (
                        <Badge key={i} className="bg-primary/10 text-primary border-primary/20">{req}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Bio */}
            {p.bio && (
              <div className="glass-card rounded-2xl p-6">
                <h2 className="font-bold font-['Outfit'] mb-2">
                  {isRecruiterViewing ? 'About' : 'About the Recruiter'}
                </h2>
                <p className="text-muted-foreground text-sm leading-relaxed">{p.bio}</p>
              </div>
            )}

            {/* Details */}
            <div className="glass-card rounded-2xl p-6 space-y-3">
              <h2 className="font-bold font-['Outfit'] mb-2">Details</h2>
              {p.location && (
                <div className="flex items-center gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{p.location}</span>
                </div>
              )}
              {(p.current_employer || p.company) && (
                <div className="flex items-center gap-3 text-sm">
                  <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{p.current_employer || p.company}</span>
                </div>
              )}
              {p.experience_years && (
                <div className="flex items-center gap-3 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{p.experience_years} years experience</span>
                </div>
              )}
              {p.school && (
                <div className="flex items-center gap-3 text-sm">
                  <GraduationCap className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{p.school}{p.degree ? ` (${p.degree})` : ''}</span>
                </div>
              )}
              {p.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <span>{p.email}</span>
                </div>
              )}
            </div>

            {/* Skills (mainly for recruiter viewing seeker) */}
            {p.skills?.length > 0 && (
              <div className="glass-card rounded-2xl p-6">
                <h2 className="font-bold font-['Outfit'] mb-3">Skills</h2>
                <div className="flex flex-wrap gap-2">
                  {p.skills.map((skill, i) => (
                    <Badge key={i} className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
                      {skill}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Work History */}
            {p.work_history?.length > 0 && (
              <div className="glass-card rounded-2xl p-6">
                <h2 className="font-bold font-['Outfit'] mb-3">Work Experience</h2>
                <div className="space-y-4">
                  {p.work_history.map((job, i) => (
                    <div key={i} className={`${i > 0 ? 'pt-4 border-t border-border' : ''}`}>
                      <h3 className="font-semibold">{job.position}</h3>
                      <p className="text-primary text-sm">{job.company}</p>
                      <p className="text-muted-foreground text-xs mt-1">
                        {job.start_date}{job.end_date ? ` — ${job.end_date}` : ' — Present'}
                      </p>
                      {job.description && (
                        <p className="text-muted-foreground text-sm mt-2">{job.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Education */}
            {p.education?.length > 0 && (
              <div className="glass-card rounded-2xl p-6">
                <h2 className="font-bold font-['Outfit'] mb-3">Education</h2>
                <div className="space-y-4">
                  {p.education.map((edu, i) => (
                    <div key={i} className={`${i > 0 ? 'pt-4 border-t border-border' : ''}`}>
                      <h3 className="font-semibold">{edu.school}</h3>
                      <p className="text-primary text-sm">{edu.degree}{edu.field ? `, ${edu.field}` : ''}</p>
                      {edu.year && <p className="text-muted-foreground text-xs mt-1">{edu.year}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Certifications */}
            {p.certifications?.length > 0 && (
              <div className="glass-card rounded-2xl p-6">
                <h2 className="font-bold font-['Outfit'] mb-3">Certifications</h2>
                <div className="flex flex-wrap gap-2">
                  {p.certifications.map((cert, i) => (
                    <Badge key={i} variant="outline" className="border-secondary/30 text-secondary">
                      {cert}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* References */}
            {isRecruiterViewing && p.references?.length > 0 && (
              <div className="glass-card rounded-2xl p-6">
                <h2 className="font-bold font-['Outfit'] mb-3">References</h2>
                <div className="space-y-4">
                  {p.references.map((ref, i) => (
                    <div key={i} className={`${i > 0 ? 'pt-4 border-t border-border' : ''}`}>
                      <h3 className="font-semibold">{ref.name}</h3>
                      {ref.title && <p className="text-primary text-sm">{ref.title}{ref.company ? ` at ${ref.company}` : ''}</p>}
                      {ref.email && (
                        <p className="text-muted-foreground text-xs mt-1 flex items-center gap-1">
                          <Mail className="w-3 h-3" /> {ref.email}
                        </p>
                      )}
                      {ref.phone && (
                        <p className="text-muted-foreground text-xs mt-0.5">{ref.phone}</p>
                      )}
                      {ref.relationship && (
                        <p className="text-muted-foreground text-xs mt-0.5 italic">{ref.relationship}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Download Resume PDF button for recruiters */}
            {isRecruiterViewing && (
              <button
                onClick={async () => {
                  try {
                    const response = await axios.get(`${API}/applicant/${p.id}/resume/pdf`, {
                      headers: { Authorization: `Bearer ${token}` },
                      responseType: 'blob'
                    });
                    const url = window.URL.createObjectURL(new Blob([response.data]));
                    const link = document.createElement('a');
                    link.href = url;
                    link.setAttribute('download', `${p.name?.replace(' ', '_') || 'resume'}_Resume.pdf`);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                    window.URL.revokeObjectURL(url);
                    toast.success('Resume downloaded!');
                  } catch {
                    toast.error('Failed to download resume');
                  }
                }}
                className="glass-card rounded-2xl p-4 flex items-center justify-center gap-2 text-primary hover:bg-primary/10 transition-colors cursor-pointer w-full"
              >
                <Download className="w-4 h-4" />
                <span className="font-semibold text-sm">Download Resume PDF</span>
              </button>
            )}
          </div>
        </main>

        <Navigation />
      </div>
    );
  }

  // ==================== MATCHES LIST ====================
  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 p-6 md:p-8">
        <h1 className="text-2xl font-bold font-['Outfit']">Matches</h1>
        <p className="text-muted-foreground">Your successful connections</p>
      </header>

      <main className="relative z-10 px-6 md:px-8">
        <div className="max-w-lg mx-auto">
          {matches.length > 0 ? (
            <div className="space-y-4">
              {matches.map((match) => (
                <div
                  key={match.id}
                  className="glass-card rounded-2xl p-5 hover:border-primary/30 transition-colors"
                  data-testid={`match-${match.id}`}
                >
                  <div className="flex items-start gap-4">
                    {/* Avatar or Logo */}
                    <div
                      className="relative cursor-pointer"
                      onClick={() => handleViewProfile(match.id)}
                    >
                      {user?.role === 'seeker' ? (
                        (match.listing_photo || match.company_logo) ? (
                          <img
                            src={getPhotoUrl(match.listing_photo || match.company_logo)}
                            alt={match.company}
                            className="w-14 h-14 rounded-xl object-cover border-2 border-primary/50"
                            onError={handleImgError(match.company || match.recruiter_name)}
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                            <Building2 className="w-7 h-7 text-white" />
                          </div>
                        )
                      ) : (
                        <img
                          src={getPhotoUrl(match.seeker_photo || match.seeker_avatar, match.seeker_name || match.seeker_id)}
                          alt={match.seeker_name}
                          className="w-14 h-14 rounded-xl object-cover border-2 border-primary/50"
                          onError={handleImgError(match.seeker_name || match.seeker_id)}
                        />
                      )}
                      <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-success flex items-center justify-center">
                        <Heart className="w-3 h-3 text-white fill-white" />
                      </div>
                    </div>

                    {/* Match Info */}
                    <div
                      className="flex-1 min-w-0 cursor-pointer"
                      onClick={() => handleViewProfile(match.id)}
                    >
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

                    {/* Actions */}
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewProfile(match.id)}
                        className="p-3 rounded-xl bg-secondary/10 text-secondary hover:bg-secondary/20 transition-colors"
                        title={user?.role === 'recruiter' ? 'View profile' : 'View details'}
                      >
                        {user?.role === 'recruiter' ? <User className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
                      </button>
                      <button
                        onClick={() => handleOpenChat(match.id)}
                        className="p-3 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        title="Open chat"
                      >
                        <MessageCircle className="w-5 h-5" />
                      </button>
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

      {/* Profile loading overlay */}
      {profileLoading && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
