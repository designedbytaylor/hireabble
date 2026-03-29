import { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { MapPin, Briefcase, Clock, DollarSign, Building2, ArrowLeft, ChevronRight, GraduationCap, Download, Share2, Copy, Check } from 'lucide-react';
import { Button } from '../components/ui/button';
import { useAuth } from '../context/AuthContext';
import useDocumentTitle from '../hooks/useDocumentTitle';
import axios from 'axios';
import { getPhotoUrl, handleImgError, handleBgImgError } from '../utils/helpers';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function getPlatform() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

const STORE_URLS = {
  ios: process.env.REACT_APP_APP_STORE_URL || null,
  android: process.env.REACT_APP_PLAY_STORE_URL || null,
};

function formatSalary(min, max) {
  const fmt = (n) => n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${n}`;
  if (min && max) return `${fmt(min)} - ${fmt(max)}`;
  if (min) return `${fmt(min)}+`;
  if (max) return `Up to ${fmt(max)}`;
  return null;
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function PublicJobDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const platform = getPlatform();
  const [copied, setCopied] = useState(false);

  useDocumentTitle(job ? `${job.title} at ${job.company}` : 'Job Detail');

  const handleShare = useCallback(async () => {
    const url = window.location.href;
    const text = job ? `${job.title} at ${job.company} — Apply now on Hireabble` : 'Check out this job on Hireabble';
    if (navigator.share) {
      try { await navigator.share({ title: text, url }); } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {}
    }
  }, [job]);

  // Fetch public job data
  useEffect(() => {
    if (!id) return;
    axios.get(`${API}/jobs/${id}/public`)
      .then(res => setJob(res.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [id]);

  // SEO JSON-LD
  useEffect(() => {
    if (!job) return;
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      "title": job.title,
      "description": job.description || `${job.title} at ${job.company}`,
      "datePosted": job.created_at,
      "hiringOrganization": {
        "@type": "Organization",
        "name": job.company,
        ...(job.company_logo && { "logo": job.company_logo })
      },
      "jobLocation": {
        "@type": "Place",
        "address": job.location || "Remote"
      },
      "employmentType": (job.employment_type || "full-time").toUpperCase().replace("-", "_"),
      ...(job.salary_min && {
        "baseSalary": {
          "@type": "MonetaryAmount",
          "currency": "USD",
          "value": {
            "@type": "QuantitativeValue",
            "minValue": job.salary_min,
            ...(job.salary_max && { "maxValue": job.salary_max }),
            "unitText": "YEAR"
          }
        }
      })
    };
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(jsonLd);
    script.id = 'job-detail-jsonld';
    const existing = document.getElementById('job-detail-jsonld');
    if (existing) existing.remove();
    document.head.appendChild(script);
    return () => {
      const el = document.getElementById('job-detail-jsonld');
      if (el) el.remove();
    };
  }, [job]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const salary = job ? formatSalary(job.salary_min, job.salary_max) : null;
  const storeUrl = platform === 'ios' ? STORE_URLS.ios : platform === 'android' ? STORE_URLS.android : null;

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/browse" className="flex items-center gap-2">
            <img src="/logo.svg" alt="Hireabble" className="w-8 h-8 rounded-lg" />
            <span className="text-lg font-bold font-['Outfit']">hireabble</span>
          </Link>
          <div className="flex items-center gap-2">
            {user ? (
              <Link to="/dashboard">
                <Button size="sm" className="bg-gradient-to-r from-primary to-secondary text-white">
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <>
                <Link to="/login">
                  <Button variant="ghost" size="sm">Log in</Button>
                </Link>
                <Link to="/register/seeker">
                  <Button size="sm" className="bg-gradient-to-r from-primary to-secondary text-white">
                    Sign Up
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Back link */}
      <div className="max-w-3xl mx-auto px-4 pt-4">
        <Link to={user ? '/search' : '/browse'} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> {user ? 'Back to search' : 'Browse all jobs'}
        </Link>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {loading ? (
          <div className="space-y-4">
            <div className="h-8 w-2/3 rounded-lg bg-muted/50 animate-pulse" />
            <div className="h-5 w-1/3 rounded-lg bg-muted/50 animate-pulse" />
            <div className="h-40 rounded-xl bg-muted/50 animate-pulse mt-6" />
          </div>
        ) : error || !job ? (
          <div className="text-center py-16">
            <Briefcase className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <h2 className="text-xl font-semibold mb-2">Job not found</h2>
            <p className="text-muted-foreground mb-4">This job may have been removed or is no longer active.</p>
            <Link to="/browse">
              <Button variant="outline">Browse all jobs <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Listing photo */}
            {job.listing_photo && (
              <div className="rounded-xl overflow-hidden">
                <img src={getPhotoUrl(job.listing_photo)} alt={job.title} className="w-full h-48 object-cover" onError={handleBgImgError} />
              </div>
            )}

            {/* Job header */}
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold font-['Outfit']">{job.title}</h1>
                <div className="flex items-center gap-2 mt-2">
                  {job.company_logo && (
                    <img src={getPhotoUrl(job.company_logo, job.company)} alt={job.company} className="w-6 h-6 rounded-full object-cover" onError={handleImgError(job.company)} />
                  )}
                  <span className="text-muted-foreground font-medium">{job.company}</span>
                </div>
              </div>
              <button
                onClick={handleShare}
                className="shrink-0 mt-1 p-2.5 rounded-xl border border-border/50 hover:bg-accent transition-colors"
                title={copied ? 'Copied!' : 'Share this job'}
              >
                {copied ? <Check className="w-4.5 h-4.5 text-green-500" /> : <Share2 className="w-4.5 h-4.5 text-muted-foreground" />}
              </button>
            </div>

            {/* Metadata badges */}
            <div className="flex flex-wrap gap-2">
              {job.location && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-sm">
                  <MapPin className="w-3.5 h-3.5 text-muted-foreground" /> {job.location}
                </span>
              )}
              {job.job_type && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-sm">
                  <Briefcase className="w-3.5 h-3.5 text-muted-foreground" /> {job.job_type}
                </span>
              )}
              {job.employment_type && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-sm">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground" /> {job.employment_type}
                </span>
              )}
              {job.experience_level && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted/50 text-sm">
                  <GraduationCap className="w-3.5 h-3.5 text-muted-foreground" /> {job.experience_level}
                </span>
              )}
              {salary && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-sm font-medium text-primary">
                  <DollarSign className="w-3.5 h-3.5" /> {salary}
                </span>
              )}
            </div>

            {job.created_at && (
              <p className="text-xs text-muted-foreground">Posted {timeAgo(job.created_at)}</p>
            )}

            {/* Description */}
            {job.description && (
              <div>
                <h2 className="text-lg font-semibold mb-3">About This Role</h2>
                <div className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {job.description}
                </div>
              </div>
            )}

            {/* Requirements */}
            {job.requirements && job.requirements.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-3">Requirements</h2>
                <ul className="space-y-2">
                  {job.requirements.map((req, i) => (
                    <li key={i} className="flex items-start gap-2 text-muted-foreground">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* CTA card */}
            <div className="glass-card rounded-xl p-6 text-center space-y-3 mt-8">
              <Building2 className="w-8 h-8 text-primary mx-auto" />
              <h3 className="font-semibold">Interested in this role?</h3>
              {user ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Head to your dashboard to find and apply for this job.
                  </p>
                  <Link to="/dashboard">
                    <Button className="bg-gradient-to-r from-primary to-secondary text-white px-8 mt-2">
                      Open Dashboard <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Sign up on Hireabble to apply and get matched with employers.
                  </p>
                  <Link to="/register/seeker">
                    <Button className="bg-gradient-to-r from-primary to-secondary text-white px-8 mt-2">
                      Create Free Account <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sticky bottom CTA */}
      {job && (
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border/50 z-30">
          <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
            {user ? (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">Apply on Hireabble</p>
                  <p className="text-xs text-muted-foreground">Find this job in your dashboard</p>
                </div>
                <Link to="/dashboard">
                  <Button size="sm" className="bg-gradient-to-r from-primary to-secondary text-white shrink-0">
                    Open Dashboard
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">Download Hireabble to Apply</p>
                  <p className="text-xs text-muted-foreground">Available on iOS and Android</p>
                </div>
                {storeUrl ? (
                  <a
                    href={storeUrl}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-secondary text-white font-semibold text-sm hover:opacity-90 transition-opacity shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    Get App
                  </a>
                ) : (
                  <Link to="/register/seeker">
                    <Button size="sm" className="bg-gradient-to-r from-primary to-secondary text-white shrink-0">
                      Sign Up to Apply
                    </Button>
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
