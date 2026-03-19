import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Briefcase, Clock, ArrowRight, Search, Building2, DollarSign } from 'lucide-react';
import { Button } from '../components/ui/button';
import axios from 'axios';
import useDocumentTitle from '../hooks/useDocumentTitle';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const CATEGORIES = [
  { value: '', label: 'All Categories' },
  { value: 'technology', label: 'Technology' },
  { value: 'design', label: 'Design' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'sales', label: 'Sales' },
  { value: 'finance', label: 'Finance' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'education', label: 'Education' },
];

const JOB_TYPES = [
  { value: '', label: 'All Types' },
  { value: 'remote', label: 'Remote' },
  { value: 'onsite', label: 'On-site' },
  { value: 'hybrid', label: 'Hybrid' },
];

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

export default function BrowseJobs() {
  useDocumentTitle('Browse Jobs');
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('');
  const [jobType, setJobType] = useState('');

  useEffect(() => {
    const fetchJobs = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (category) params.set('category', category);
        if (jobType) params.set('job_type', jobType);
        params.set('limit', '30');
        const res = await axios.get(`${API}/jobs/browse?${params}`);
        setJobs(res.data);
      } catch {
        setJobs([]);
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, [category, jobType]);

  // Add JSON-LD structured data for SEO
  useEffect(() => {
    if (!jobs || jobs.length === 0) return;

    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "itemListElement": jobs.slice(0, 20).map((job, index) => ({
        "@type": "ListItem",
        "position": index + 1,
        "item": {
          "@type": "JobPosting",
          "title": job.title,
          "description": `${job.title} at ${job.company}`,
          "datePosted": job.created_at,
          "hiringOrganization": {
            "@type": "Organization",
            "name": job.company
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
        }
      }))
    };

    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = JSON.stringify(jsonLd);
    script.id = 'jobs-jsonld';

    // Remove existing one if any
    const existing = document.getElementById('jobs-jsonld');
    if (existing) existing.remove();

    document.head.appendChild(script);

    return () => {
      const el = document.getElementById('jobs-jsonld');
      if (el) el.remove();
    };
  }, [jobs]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <img src="/logo.svg" alt="Hireabble" className="w-8 h-8 rounded-lg" />
            <span className="text-lg font-bold font-['Outfit']">hireabble</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">Log in</Button>
            </Link>
            <Link to="/register/seeker">
              <Button size="sm" className="bg-gradient-to-r from-primary to-secondary text-white">
                Sign Up
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-b from-primary/5 to-transparent px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold font-['Outfit'] mb-2">
            Browse <span className="gradient-text">Open Positions</span>
          </h1>
          <p className="text-muted-foreground">
            Explore opportunities from top companies. Sign up to apply and get matched.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-4xl mx-auto px-4 py-4 flex flex-wrap gap-2">
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
        >
          {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select
          value={jobType}
          onChange={e => setJobType(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border bg-background text-sm"
        >
          {JOB_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      {/* Job List */}
      <div className="max-w-4xl mx-auto px-4 pb-12">
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-24 rounded-xl bg-muted/50 animate-pulse" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16">
            <Search className="w-12 h-12 text-muted-foreground/50 mx-auto mb-3" />
            <p className="text-muted-foreground">No jobs found. Try adjusting your filters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map(job => {
              const salary = formatSalary(job.salary_min, job.salary_max);
              return (
                <div key={job.id} className="glass-card rounded-xl p-4 hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base truncate">{job.title}</h3>
                      <div className="flex items-center gap-1.5 text-muted-foreground text-sm mt-1">
                        <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{job.company}</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-xs text-muted-foreground">
                        {job.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {job.location}
                          </span>
                        )}
                        {job.job_type && (
                          <span className="flex items-center gap-1">
                            <Briefcase className="w-3 h-3" /> {job.job_type}
                          </span>
                        )}
                        {salary && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" /> {salary}
                          </span>
                        )}
                        {job.created_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {timeAgo(job.created_at)}
                          </span>
                        )}
                      </div>
                    </div>
                    <Link to={`/register/seeker`}>
                      <Button size="sm" variant="outline" className="shrink-0 text-xs">
                        Apply <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </Link>
                  </div>
                </div>
              );
            })}

            {/* CTA */}
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-3">
                Sign up to see full job details, apply, and get matched with employers.
              </p>
              <Link to="/register/seeker">
                <Button className="bg-gradient-to-r from-primary to-secondary text-white px-8">
                  Create Free Account
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
