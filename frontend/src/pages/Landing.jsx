import { Link } from 'react-router-dom';
import { Briefcase, Heart, Star, ArrowRight, Zap, Users, Target } from 'lucide-react';
import { Button } from '../components/ui/button';

export default function Landing() {
  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[120px]" />
      </div>

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between p-6 md:p-8 lg:px-12">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold font-['Outfit']">Hireabble</span>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/login">
            <Button variant="ghost" className="text-muted-foreground hover:text-foreground" data-testid="login-nav-btn">
              Sign In
            </Button>
          </Link>
          <Link to="/register">
            <Button className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 rounded-full px-6" data-testid="get-started-nav-btn">
              Get Started
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="relative z-10 px-6 md:px-8 lg:px-12 pt-12 md:pt-20">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass text-sm">
                <Zap className="w-4 h-4 text-secondary" />
                <span className="text-muted-foreground">Job hunting made simple</span>
              </div>
              
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold font-['Outfit'] leading-tight">
                Find Jobs.<br />
                <span className="gradient-text">Get Hired.</span><br />
                That Simple.
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground max-w-lg leading-relaxed">
                Skip the endless applications. Swipe through jobs, match with recruiters, 
                and start conversations. Job hunting reimagined.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Link to="/register">
                  <Button 
                    size="lg" 
                    className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 rounded-full px-8 py-6 text-lg btn-hover-glow w-full sm:w-auto"
                    data-testid="hero-get-started-btn"
                  >
                    Find a Job
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                </Link>
                <Link to="/register?role=recruiter">
                  <Button 
                    size="lg" 
                    variant="outline" 
                    className="rounded-full px-8 py-6 text-lg border-border hover:bg-accent w-full sm:w-auto"
                    data-testid="hero-recruiter-btn"
                  >
                    I'm Hiring
                  </Button>
                </Link>
              </div>

              {/* Stats */}
              <div className="flex gap-8 pt-8">
                <div>
                  <div className="text-3xl font-bold font-['Outfit'] gradient-text">10K+</div>
                  <div className="text-sm text-muted-foreground">Active Jobs</div>
                </div>
                <div>
                  <div className="text-3xl font-bold font-['Outfit'] gradient-text">50K+</div>
                  <div className="text-sm text-muted-foreground">Job Seekers</div>
                </div>
                <div>
                  <div className="text-3xl font-bold font-['Outfit'] gradient-text">5K+</div>
                  <div className="text-sm text-muted-foreground">Matches Daily</div>
                </div>
              </div>
            </div>

            {/* Right Content - Card Preview */}
            <div className="relative hidden lg:block">
              <div className="relative w-80 h-[450px] mx-auto">
                {/* Background cards */}
                <div className="absolute inset-0 transform rotate-6 translate-x-4 translate-y-4">
                  <div className="w-full h-full rounded-3xl bg-card/50 border border-border" />
                </div>
                <div className="absolute inset-0 transform -rotate-3 -translate-x-2 translate-y-2">
                  <div className="w-full h-full rounded-3xl bg-card/70 border border-border" />
                </div>
                
                {/* Main card */}
                <div className="relative w-full h-full rounded-3xl overflow-hidden gradient-border animate-float">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent z-10" />
                  <img 
                    src="https://images.unsplash.com/photo-1559310415-1e164ccd653a?w=400&h=600&fit=crop" 
                    alt="Office" 
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-6 z-20">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center">
                        <span className="text-white font-bold">TC</span>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">TechCorp</div>
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold font-['Outfit'] mb-2">Senior Developer</h3>
                    <div className="flex gap-2">
                      <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm">$120k-160k</span>
                      <span className="px-3 py-1 rounded-full bg-secondary/20 text-secondary text-sm">Remote</span>
                    </div>
                  </div>
                </div>

                {/* Action buttons overlay */}
                <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 flex gap-4">
                  <button className="w-14 h-14 rounded-full bg-destructive/20 border border-destructive/50 flex items-center justify-center hover:scale-110 transition-transform">
                    <svg className="w-6 h-6 text-destructive" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <button className="w-16 h-16 rounded-full bg-secondary/20 border border-secondary/50 flex items-center justify-center hover:scale-110 transition-transform">
                    <Star className="w-7 h-7 text-secondary" />
                  </button>
                  <button className="w-14 h-14 rounded-full bg-success/20 border border-success/50 flex items-center justify-center hover:scale-110 transition-transform">
                    <Heart className="w-6 h-6 text-success" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <section className="max-w-6xl mx-auto py-24 md:py-32">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold font-['Outfit'] mb-4">
              Why <span className="gradient-text">Hireabble</span>?
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Because Indeed is confusing and takes forever. We made it simple.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="glass-card rounded-3xl p-8 hover:border-primary/50 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center mb-6">
                <Users className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold font-['Outfit'] mb-3">Quick Profile</h3>
              <p className="text-muted-foreground">
                No more uploading resumes. Answer a few simple questions and you're ready to go.
              </p>
            </div>

            <div className="glass-card rounded-3xl p-8 hover:border-secondary/50 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary to-secondary/50 flex items-center justify-center mb-6">
                <Heart className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold font-['Outfit'] mb-3">Swipe & Match</h3>
              <p className="text-muted-foreground">
                Browse jobs like you browse dating apps. Swipe right to apply, left to pass. Easy.
              </p>
            </div>

            <div className="glass-card rounded-3xl p-8 hover:border-success/50 transition-colors">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-success to-success/50 flex items-center justify-center mb-6">
                <Target className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold font-['Outfit'] mb-3">Real Connections</h3>
              <p className="text-muted-foreground">
                When recruiters like you back, it's a match! Start real conversations, not application black holes.
              </p>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="max-w-4xl mx-auto pb-24 text-center">
          <div className="glass-card rounded-3xl p-12 md:p-16 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-secondary/10" />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold font-['Outfit'] mb-4">
                Ready to Get Hired?
              </h2>
              <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">
                Join thousands who've already ditched the old way of job hunting.
              </p>
              <Link to="/register">
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 rounded-full px-10 py-6 text-lg btn-hover-glow"
                  data-testid="cta-get-started-btn"
                >
                  Get Started Free
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Briefcase className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold font-['Outfit']">Hireabble</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2024 Hireabble. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
