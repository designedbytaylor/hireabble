import { useRef, useState, useEffect } from 'react';
import { motion, useMotionValue, useTransform } from 'framer-motion';
import {
  Briefcase, MapPin, GraduationCap, Clock, Building2,
  Sparkles, MessageSquare, BadgeCheck, Video, Brain, Lock, Loader2
} from 'lucide-react';
import { getPhotoUrl, handleImgError } from '../utils/helpers';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import SkillBadges from './SkillBadges';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function CandidateDetailSheet({ item, mode, onClose }) {
  const sheetY = useMotionValue(0);
  const sheetOpacity = useTransform(sheetY, [0, 300], [1, 0]);
  const scrollRef = useRef(null);
  const [canDragDown, setCanDragDown] = useState(true);
  const [aiInsights, setAiInsights] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const { user, token } = useAuth();

  const isEnterprise = user?.subscription?.status === 'active'
    && user?.subscription?.tier_id === 'recruiter_enterprise';
  const seekerId = mode === 'applicants' ? item.seeker_id : item.id;
  const jobId = mode === 'applicants' ? item.job_id : null;

  useEffect(() => {
    if (!isEnterprise || !seekerId || user?.role !== 'recruiter') return;
    setAiLoading(true);
    axios.get(`${API}/applications/candidates/${seekerId}/ai-insights`, {
      params: jobId ? { job_id: jobId } : {},
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(res => setAiInsights(res.data))
      .catch(() => setAiInsights(null))
      .finally(() => setAiLoading(false));
  }, [seekerId, jobId, isEnterprise, token, user?.role]);

  const handleScroll = () => {
    if (scrollRef.current) {
      setCanDragDown(scrollRef.current.scrollTop <= 0);
    }
  };

  // Normalize fields between applicant mode and candidate mode
  const name = mode === 'applicants' ? item.seeker_name : item.name;
  const title = mode === 'applicants' ? (item.seeker_title || 'Job Seeker') : (item.title || 'Job Seeker');
  const photo = mode === 'applicants'
    ? getPhotoUrl(item.seeker_photo || item.seeker_avatar, name || item.seeker_id)
    : getPhotoUrl(item.photo_url || item.avatar, name || item.id);
  const bio = mode === 'applicants' ? item.seeker_bio : item.bio;
  const skills = mode === 'applicants' ? item.seeker_skills : item.skills;
  const experience = mode === 'applicants' ? item.seeker_experience : item.experience;
  const location = mode === 'applicants' ? item.seeker_location : item.location;
  const school = mode === 'applicants' ? item.seeker_school : item.school;
  const employer = mode === 'applicants' ? item.seeker_current_employer : item.current_employer;
  const degree = mode === 'applicants' ? null : item.degree;
  const matchScore = item.match_score;
  const previousEmployers = mode === 'applicants' ? null : item.previous_employers;
  const certifications = mode === 'applicants' ? null : item.certifications;
  const workPreference = mode === 'applicants' ? null : item.work_preference;
  const desiredSalary = mode === 'applicants' ? null : item.desired_salary;
  const videoUrl = mode === 'applicants' ? item.seeker_video : item.video_url;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100]"
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 bg-card rounded-t-3xl overflow-hidden"
        style={{ y: sheetY, opacity: sheetOpacity, maxHeight: '85vh', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        drag={canDragDown ? "y" : false}
        dragConstraints={{ top: 0, bottom: 300 }}
        dragElastic={{ top: 0, bottom: 0.4 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 80 || info.velocity.y > 300) {
            onClose();
          }
        }}
      >
        {/* Drag Handle */}
        <div className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={() => setCanDragDown(true)}
        >
          <div className="w-10 h-1.5 rounded-full bg-muted-foreground/40" />
        </div>

        {/* Scrollable Content */}
        <div ref={scrollRef} onScroll={handleScroll} className="overflow-y-auto px-6 pb-8" style={{ maxHeight: 'calc(85vh - 28px - env(safe-area-inset-bottom, 0px))' }}>
          {/* Photo + Name Header */}
          <div className="flex items-center gap-4 mb-4">
            <img
              src={photo}
              alt={name}
              className="w-16 h-16 rounded-xl object-cover border-2 border-primary/30"
              onError={handleImgError(name || 'default')}
            />
            <div className="flex-1">
              <h2 className="text-xl font-bold font-['Outfit'] flex items-center gap-1.5">
                {name}
                {item.verified && <BadgeCheck className="w-5 h-5 text-blue-400 shrink-0" />}
              </h2>
              <p className="text-primary text-sm">{title}</p>
              {mode === 'applicants' && item.job_title && (
                <p className="text-muted-foreground text-xs mt-0.5">Applied for: {item.job_title}</p>
              )}
            </div>
            {matchScore != null && (
              <span className={`px-3 py-1 rounded-full text-sm font-bold flex items-center gap-1 ${
                matchScore >= 75 ? 'bg-success/20 text-success' :
                matchScore >= 50 ? 'bg-primary/20 text-primary' :
                'bg-muted text-muted-foreground'
              }`}>
                <Sparkles className="w-3.5 h-3.5" />
                Fit Score: {matchScore}%
              </span>
            )}
          </div>

          {/* AI-Powered Insights (Enterprise) */}
          {user?.role === 'recruiter' && (
            <div className="mb-4">
              {aiLoading && (
                <div className="flex items-center gap-2 px-3 py-3 rounded-xl bg-violet-500/5 border border-violet-500/20">
                  <Loader2 className="w-4 h-4 text-violet-500 animate-spin" />
                  <span className="text-sm text-violet-400">Generating AI insights...</span>
                </div>
              )}
              {!aiLoading && aiInsights && (
                <div className="px-3 py-3 rounded-xl bg-violet-500/5 border border-violet-500/20 space-y-2">
                  <p className="text-xs font-medium text-violet-400 flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5" /> AI Candidate Insights
                  </p>
                  <p className="text-sm text-foreground/90">{aiInsights.summary}</p>
                  {aiInsights.strengths?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {aiInsights.strengths.map((s, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20">{s}</span>
                      ))}
                    </div>
                  )}
                  {aiInsights.considerations?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {aiInsights.considerations.map((c, i) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">{c}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!aiLoading && !aiInsights && !isEnterprise && (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-card border border-border">
                  <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Upgrade to Enterprise for AI-powered candidate insights</span>
                </div>
              )}
            </div>
          )}

          {/* Also Applied To */}
          {mode === 'applicants' && item.other_applications?.length > 0 && (
            <div className="mb-4 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
              <p className="text-xs text-primary flex items-center gap-1 font-medium">
                <Briefcase className="w-3 h-3" /> Also applied to your other {item.other_applications.length === 1 ? 'job' : 'jobs'}:
              </p>
              {item.other_applications.map((a, i) => (
                <p key={i} className="text-sm text-foreground/80 ml-4 mt-0.5">{a.job_title}</p>
              ))}
            </div>
          )}

          {/* Priority Apply Note */}
          {item.superlike_note && (
            <div className="mb-4 px-3 py-2 rounded-xl bg-secondary/10 border border-secondary/20">
              <p className="text-xs text-secondary flex items-center gap-1 mb-0.5 font-medium">
                <MessageSquare className="w-3 h-3" /> Note from applicant
              </p>
              <p className="text-sm text-foreground/90 italic">"{item.superlike_note}"</p>
            </div>
          )}

          {/* Other Applications */}
          {item.other_applications?.length > 0 && (
            <div className="mb-4 px-3 py-2 rounded-xl bg-primary/10 border border-primary/20">
              <p className="text-xs text-primary flex items-center gap-1 mb-1 font-medium">
                <Briefcase className="w-3 h-3" /> Also applied to your other {item.other_applications.length === 1 ? 'job' : 'jobs'}
              </p>
              {item.other_applications.map((oa, i) => (
                <p key={i} className="text-sm text-foreground/80 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0" />
                  {oa.job_title}
                  {oa.action === 'superlike' && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary/20 text-secondary font-medium">Priority Apply</span>
                  )}
                </p>
              ))}
            </div>
          )}

          {/* Info Tags */}
          <div className="flex flex-wrap gap-2 mb-5">
            {experience && (
              <span className="px-3 py-1.5 rounded-full bg-primary/20 text-primary text-sm flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {experience}+ yrs
              </span>
            )}
            {location && (
              <span className="px-3 py-1.5 rounded-full bg-secondary/20 text-secondary text-sm flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {location}
              </span>
            )}
            {school && (
              <span className="px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" />
                {school}
              </span>
            )}
            {employer && (
              <span className="px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5" />
                {employer}
              </span>
            )}
            {degree && (
              <span className="px-3 py-1.5 rounded-full bg-accent text-accent-foreground text-sm capitalize flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" />
                {degree}
              </span>
            )}
          </div>

          {/* Elevator Pitch Video — shown first for maximum impact */}
          {videoUrl && (
            <div className="mb-5">
              <h3 className="text-sm font-bold font-['Outfit'] mb-2 text-foreground flex items-center gap-1.5">
                <Video className="w-4 h-4 text-primary" /> Elevator Pitch
              </h3>
              <video
                src={videoUrl}
                controls
                playsInline
                preload="metadata"
                className="w-full rounded-xl border border-border"
                style={{ maxHeight: '240px' }}
              />
            </div>
          )}

          {/* Bio */}
          {bio && (
            <div className="mb-5">
              <h3 className="text-sm font-bold font-['Outfit'] mb-2 text-foreground">About</h3>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{bio}</p>
            </div>
          )}

          {/* Verified Skill Badges */}
          {item.verified_skills?.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-bold font-['Outfit'] mb-2 text-foreground flex items-center gap-1.5">
                <BadgeCheck className="w-4 h-4 text-emerald-400" /> Verified Skills
              </h3>
              <SkillBadges badges={item.verified_skills} size="md" />
            </div>
          )}

          {/* Skills */}
          {skills?.length > 0 && (
            <div className="mb-5">
              <h3 className="text-sm font-bold font-['Outfit'] mb-2 text-foreground">Skills</h3>
              <div className="flex flex-wrap gap-2">
                {skills.map((skill, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-lg bg-white/5 border border-border text-sm text-muted-foreground">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Work Preference & Desired Salary (discover mode) */}
          {(workPreference || desiredSalary) && (
            <div className="flex flex-wrap gap-2 mb-5">
              {workPreference && (
                <span className="px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm capitalize">
                  Prefers {workPreference}
                </span>
              )}
              {desiredSalary && (
                <span className="px-3 py-1.5 rounded-full bg-success/10 text-success text-sm">
                  Desired: ${Number(desiredSalary).toLocaleString()}/yr
                </span>
              )}
            </div>
          )}

          {/* Previous Employers */}
          {previousEmployers && (
            <div className="mb-5">
              <h3 className="text-sm font-bold font-['Outfit'] mb-2 text-foreground">Previous Experience</h3>
              <p className="text-sm text-muted-foreground">{previousEmployers}</p>
            </div>
          )}

          {/* Certifications */}
          {certifications && (
            <div className="mb-5">
              <h3 className="text-sm font-bold font-['Outfit'] mb-2 text-foreground">Certifications</h3>
              <div className="flex flex-wrap gap-2">
                {(Array.isArray(certifications) ? certifications : certifications.split(',').map(c => c.trim()).filter(Boolean)).map((cert, i) => (
                  <span key={i} className="px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400">
                    {cert}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Applied date */}
          {mode === 'applicants' && item.created_at && (
            <div className="text-xs text-muted-foreground">
              Applied {new Date(item.created_at).toLocaleDateString()}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
