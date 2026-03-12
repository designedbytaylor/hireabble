import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MapPin, Briefcase, Smartphone } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function getPlatform() {
  const ua = navigator.userAgent || '';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'desktop';
}

// Store URLs — configure via env vars, fall back to placeholders
const STORE_URLS = {
  ios: process.env.REACT_APP_APP_STORE_URL || 'https://apps.apple.com/app/hireabble/id0000000000',
  android: process.env.REACT_APP_PLAY_STORE_URL || 'https://play.google.com/store/apps/details?id=com.hireabble.app',
};

export default function Download() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const jobId = params.get('job');
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(!!jobId);
  const platform = getPlatform();

  // If logged in, redirect straight to the job
  useEffect(() => {
    if (!authLoading && user && jobId) {
      navigate(`/dashboard`, { replace: true });
    }
  }, [authLoading, user, jobId, navigate]);

  // Fetch public job info
  useEffect(() => {
    if (!jobId) return;
    axios.get(`${API}/jobs/${jobId}/public`)
      .then(res => setJob(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [jobId]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // If logged in without a jobId, just go to dashboard
  if (user && !jobId) {
    navigate('/', { replace: true });
    return null;
  }

  const signInUrl = jobId
    ? `/login?redirect=${encodeURIComponent(`/download?job=${jobId}`)}`
    : '/login';

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* Green gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#2dd4a8] to-[#1a8a7a]" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 -right-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 flex-1 flex flex-col items-center px-6 py-12">
        {/* Logo + branding */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <img src="/logo-white.png" alt="Hireabble" className="w-14 h-14 drop-shadow-lg" />
          </div>
          <h1 className="text-4xl font-bold font-['Outfit'] text-white tracking-tight">
            hireabble
          </h1>
          <p className="text-white/70 text-sm mt-1">Swipe right on your next career move</p>
        </div>

        {/* Main card */}
        <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-5">
          {/* Job preview */}
          {loading ? (
            <div className="flex justify-center py-4">
              <div className="w-6 h-6 border-2 border-[#2dd4a8] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : job ? (
            <div className="text-center space-y-2 pb-4 border-b border-gray-100">
              <p className="text-xs font-medium text-[#1a8a7a] uppercase tracking-wide">Now Hiring</p>
              <h2 className="text-xl font-bold text-gray-900">{job.title}</h2>
              {job.company && (
                <p className="text-gray-500 text-sm">{job.company}</p>
              )}
              <div className="flex items-center justify-center gap-3 text-gray-400 text-xs">
                {job.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {job.location}
                  </span>
                )}
                {job.job_type && (
                  <span className="flex items-center gap-1">
                    <Briefcase className="w-3 h-3" /> {job.job_type.replace('_', ' ')}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center pb-4 border-b border-gray-100">
              <Smartphone className="w-10 h-10 text-[#2dd4a8] mx-auto mb-2" />
              <h2 className="text-xl font-bold text-gray-900">Get Hireabble</h2>
              <p className="text-gray-500 text-sm">Find your dream job with a swipe</p>
            </div>
          )}

          {/* Download buttons */}
          <div className="space-y-3">
            {(platform === 'ios' || platform === 'desktop') && (
              <a
                href={STORE_URLS.ios}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-black text-white font-semibold text-sm hover:bg-gray-800 transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                </svg>
                Download on the App Store
              </a>
            )}
            {(platform === 'android' || platform === 'desktop') && (
              <a
                href={STORE_URLS.android}
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-xl bg-[#2dd4a8] text-white font-semibold text-sm hover:bg-[#1a8a7a] transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.523 2.246l-1.997 3.46A7.953 7.953 0 0012 4.5a7.95 7.95 0 00-3.526 1.206L6.477 2.246a.5.5 0 10-.866.5l1.97 3.412A8.473 8.473 0 003.5 13h17a8.473 8.473 0 00-4.08-6.842l1.97-3.412a.5.5 0 10-.867-.5zM8.5 10.5a1 1 0 110-2 1 1 0 010 2zm7 0a1 1 0 110-2 1 1 0 010 2zM3.5 14v6.5A1.5 1.5 0 005 22h1.5v-8H3.5zm14 0v8H19a1.5 1.5 0 001.5-1.5V14h-3zM6.5 22v-8h11v8h-11z"/>
                </svg>
                Get it on Google Play
              </a>
            )}
          </div>

          {/* Sign in link */}
          <div className="text-center pt-2">
            <p className="text-gray-400 text-xs">Already have an account?</p>
            <Link to={signInUrl} className="text-[#1a8a7a] font-semibold text-sm hover:underline">
              Sign in to apply
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-white/60 text-xs">hireabble.com</p>
        </div>
      </div>
    </div>
  );
}
