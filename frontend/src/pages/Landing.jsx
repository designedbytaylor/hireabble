import { Link } from 'react-router-dom';
import { Briefcase } from 'lucide-react';

export default function Landing() {
  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      {/* Full-screen gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary via-primary/90 to-secondary" />

      {/* Subtle animated shapes */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-white/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-white/3 rounded-full blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-between px-6 py-12 min-h-screen">
        {/* Top spacer */}
        <div />

        {/* Center: Logo + Tagline */}
        <div className="text-center space-y-6">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Briefcase className="w-8 h-8 text-white" />
            </div>
          </div>
          <h1 className="text-5xl md:text-7xl font-bold font-['Outfit'] text-white tracking-tight">
            hireabble
          </h1>
          <p className="text-white/80 text-lg md:text-xl max-w-sm mx-auto leading-relaxed">
            Swipe right on your next career move
          </p>
        </div>

        {/* Bottom: Auth buttons + Legal links */}
        <div className="w-full max-w-sm space-y-4">
          <Link to="/register" className="block">
            <button
              className="w-full py-4 rounded-full bg-white text-primary font-bold text-lg hover:bg-white/95 active:scale-[0.98] transition-all shadow-lg"
              data-testid="hero-get-started-btn"
            >
              Create account
            </button>
          </Link>
          <Link to="/login" className="block">
            <button
              className="w-full py-4 rounded-full bg-white/15 backdrop-blur-sm text-white font-bold text-lg border border-white/30 hover:bg-white/25 active:scale-[0.98] transition-all"
              data-testid="login-nav-btn"
            >
              Log in
            </button>
          </Link>

          {/* Legal links */}
          <div className="flex items-center justify-center gap-4 pt-4 text-white/50 text-xs">
            <Link to="/privacy" className="hover:text-white/80 transition-colors">Privacy</Link>
            <span>·</span>
            <Link to="/terms" className="hover:text-white/80 transition-colors">Terms</Link>
            <span>·</span>
            <Link to="/cookie-policy" className="hover:text-white/80 transition-colors">Cookie Policy</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
