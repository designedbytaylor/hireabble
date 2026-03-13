import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Mail, Lock, User, Building2, ArrowRight, Eye, EyeOff, MapPin, Search, Users, Zap, Target, Shield, BarChart3, Briefcase } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import OAuthButtons from '../components/OAuthButtons';
import LocationAutocomplete from '../components/LocationAutocomplete';

const ROLE_CONFIG = {
  seeker: {
    heading: 'Find Your Dream Job',
    subheading: 'Create your profile and start matching with opportunities',
    brandHeading: 'Your Next Career Move',
    brandSubheading: 'Swipe through curated job opportunities, get matched with top companies, and land your dream role — all from your phone.',
    features: [
      { icon: Search, text: 'Discover jobs tailored to your skills' },
      { icon: Zap, text: 'Instant match when companies like you back' },
      { icon: Shield, text: 'Your profile, your control' },
    ],
    switchText: 'Looking to hire?',
    switchLink: '/register/recruiter',
    switchLabel: 'Sign up as a Recruiter',
    accentColor: 'primary',
  },
  recruiter: {
    heading: 'Hire Top Talent',
    subheading: 'Create your account and start finding the perfect candidates',
    brandHeading: 'Build Your Dream Team',
    brandSubheading: 'Browse pre-qualified candidates, swipe to connect, and fill roles faster than ever — powered by smart matching.',
    features: [
      { icon: Target, text: 'Candidates matched to your requirements' },
      { icon: Users, text: 'Access a growing pool of verified talent' },
      { icon: BarChart3, text: 'Track your hiring pipeline in real-time' },
    ],
    switchText: 'Looking for a job?',
    switchLink: '/register/seeker',
    switchLabel: 'Sign up as a Job Seeker',
    accentColor: 'secondary',
  },
};

export default function Register() {
  const { role: urlRole } = useParams();
  const role = urlRole === 'recruiter' ? 'recruiter' : 'seeker';
  const config = ROLE_CONFIG[role];

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role,
    company: '',
    title: '',
    location: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  // Keep formData.role in sync with URL
  if (formData.role !== role) {
    setFormData(prev => ({ ...prev, role }));
  }

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!acceptedTerms) {
      toast.error('Please accept the Terms and Privacy Policy');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const user = await register(formData);
      toast.success('Welcome to Hireabble! Please verify your email.');
      navigate('/verify-email');
    } catch (error) {
      console.error('Registration error:', error);
      const message = error.response?.data?.detail || error.message || 'Registration failed';
      toast.error(`Registration failed: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />
      </div>

      {/* Left Panel - Role-specific Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12">
        <div className="max-w-lg">
          <Link to="/" className="flex items-center gap-2 mb-12">
            <img src="/logo.png" alt="Hireabble" className="w-12 h-12 rounded-xl" />
            <span className="text-2xl font-bold font-['Outfit']">Hireabble</span>
          </Link>

          <h1 className="text-4xl font-bold font-['Outfit'] mb-4">
            <span className="gradient-text">{config.brandHeading}</span>
          </h1>

          <p className="text-lg text-muted-foreground mb-10">
            {config.brandSubheading}
          </p>

          <div className="space-y-5">
            {config.features.map((feature, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl bg-${config.accentColor}/10 flex items-center justify-center flex-shrink-0`}>
                  <feature.icon className={`w-5 h-5 text-${config.accentColor}`} />
                </div>
                <span className="text-muted-foreground">{feature.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <Link to="/" className="flex lg:hidden items-center gap-2 mb-8">
            <img src="/logo.png" alt="Hireabble" className="w-10 h-10 rounded-xl" />
            <span className="text-xl font-bold font-['Outfit']">Hireabble</span>
          </Link>

          <div className="glass-card rounded-3xl p-8 md:p-10">
            <div className="mb-8">
              <h2 className="text-2xl font-bold font-['Outfit'] mb-2">{config.heading}</h2>
              <p className="text-muted-foreground">{config.subheading}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="name"
                    name="name"
                    type="text"
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={handleChange}
                    className="pl-12 h-12 rounded-xl bg-background border-border"
                    data-testid="register-name-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="pl-12 h-12 rounded-xl bg-background border-border"
                    data-testid="register-email-input"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={handleChange}
                    className="pl-12 pr-12 h-12 rounded-xl bg-background border-border"
                    data-testid="register-password-input"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {role === 'recruiter' && (
                <div className="space-y-2">
                  <Label htmlFor="company">Company Name</Label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="company"
                      name="company"
                      type="text"
                      placeholder="Acme Inc."
                      value={formData.company}
                      onChange={handleChange}
                      className="pl-12 h-12 rounded-xl bg-background border-border"
                      data-testid="register-company-input"
                    />
                  </div>
                </div>
              )}

              {role === 'seeker' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="title">Job Title</Label>
                    <div className="relative">
                      <Briefcase className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="title"
                        name="title"
                        type="text"
                        placeholder="Software Engineer"
                        value={formData.title}
                        onChange={handleChange}
                        className="pl-12 h-12 rounded-xl bg-background border-border"
                        data-testid="register-title-input"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground z-10" />
                      <LocationAutocomplete
                        value={formData.location}
                        onChange={(val) => setFormData(prev => ({ ...prev, location: val }))}
                        placeholder="San Francisco, CA"
                        inputClassName="pl-12 h-12"
                        data-testid="register-location-input"
                      />
                    </div>
                  </div>
                </>
              )}

              <label className="flex items-start gap-3 mt-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-border accent-primary"
                  data-testid="terms-checkbox"
                />
                <span className="text-sm text-muted-foreground">
                  I agree to the{' '}
                  <Link to="/terms" className="text-primary hover:underline" target="_blank">Terms of Service</Link>
                  {' '}and{' '}
                  <Link to="/privacy" className="text-primary hover:underline" target="_blank">Privacy Policy</Link>
                </span>
              </label>

              <Button
                type="submit"
                disabled={loading || !acceptedTerms}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-lg font-medium btn-hover-glow mt-2"
                data-testid="register-submit-btn"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Create Account
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            </form>

            <OAuthButtons role={role} />

            {/* Switch role link */}
            <p className="mt-6 text-center text-muted-foreground text-sm">
              {config.switchText}{' '}
              <Link to={config.switchLink} className={`text-${config.accentColor === 'primary' ? 'secondary' : 'primary'} hover:underline font-medium`}>
                {config.switchLabel}
              </Link>
            </p>

            <p className="mt-4 text-center text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:underline font-medium" data-testid="login-link">
                Sign in
              </Link>
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}
