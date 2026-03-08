import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Briefcase, Mail, Lock, User, Building2, ArrowRight, Eye, EyeOff, MapPin } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import OAuthButtons from '../components/OAuthButtons';

export default function Register() {
  const [searchParams] = useSearchParams();
  const defaultRole = searchParams.get('role') === 'recruiter' ? 'recruiter' : 'seeker';
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: defaultRole,
    company: '',
    title: '',
    location: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      toast.error('Please fill in all required fields');
      return;
    }

    if (formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const user = await register(formData);
      toast.success('Welcome to Hireabble!');
      navigate(user.role === 'seeker' ? '/dashboard' : '/recruiter');
    } catch (error) {
      console.error('Registration error:', error);
      console.error('Response status:', error.response?.status);
      console.error('Response data:', error.response?.data);
      console.error('Request URL:', error.config?.url);
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

      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12">
        <div className="max-w-lg">
          <Link to="/" className="flex items-center gap-2 mb-12">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Briefcase className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold font-['Outfit']">Hireabble</span>
          </Link>
          
          <h1 className="text-4xl font-bold font-['Outfit'] mb-6">
            Join{' '}
            <span className="gradient-text">Hireabble</span>
          </h1>
          
          <p className="text-lg text-muted-foreground">
            Create your account and start matching with opportunities that align with your goals.
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <Link to="/" className="flex lg:hidden items-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold font-['Outfit']">Hireabble</span>
          </Link>

          <div className="glass-card rounded-3xl p-8 md:p-10">
            <div className="mb-8">
              <h2 className="text-2xl font-bold font-['Outfit'] mb-2">Create Account</h2>
              <p className="text-muted-foreground">Start your journey today</p>
            </div>

            {/* Role Selection */}
            <div className="flex gap-3 mb-8">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'seeker' })}
                className={`flex-1 py-4 px-4 rounded-xl border transition-all ${
                  formData.role === 'seeker'
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/50'
                }`}
                data-testid="role-seeker-btn"
              >
                <User className="w-5 h-5 mx-auto mb-2" />
                <div className="text-sm font-medium">Job Seeker</div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, role: 'recruiter' })}
                className={`flex-1 py-4 px-4 rounded-xl border transition-all ${
                  formData.role === 'recruiter'
                    ? 'border-secondary bg-secondary/10 text-secondary'
                    : 'border-border bg-background text-muted-foreground hover:border-secondary/50'
                }`}
                data-testid="role-recruiter-btn"
              >
                <Building2 className="w-5 h-5 mx-auto mb-2" />
                <div className="text-sm font-medium">Recruiter</div>
              </button>
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

              {formData.role === 'recruiter' && (
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

              {formData.role === 'seeker' && (
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
                      <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="location"
                        name="location"
                        type="text"
                        placeholder="San Francisco, CA"
                        value={formData.location}
                        onChange={handleChange}
                        className="pl-12 h-12 rounded-xl bg-background border-border"
                        data-testid="register-location-input"
                      />
                    </div>
                  </div>
                </>
              )}

              <Button
                type="submit"
                disabled={loading}
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

            <OAuthButtons role={formData.role} />

            <p className="mt-8 text-center text-muted-foreground">
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
