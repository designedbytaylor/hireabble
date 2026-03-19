import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Lock, ArrowRight, Eye, EyeOff, Shield } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import OAuthButtons from '../components/OAuthButtons';
import useDocumentTitle from '../hooks/useDocumentTitle';

export default function Login() {
  useDocumentTitle('Sign In');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [twoFAType, setTwoFAType] = useState('');
  const { login, verifyEmail2FA, verifyTotp2FA } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const role = searchParams.get('role') === 'recruiter' ? 'recruiter' : 'seeker';

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const result = await login(email, password);
      if (result?.requires_2fa) {
        if (result.two_fa_type === 'email') {
          setNeeds2FA(true);
          setTwoFAType('email');
          setTempToken(result.temp_token);
          toast.success('Verification code sent to your email');
        } else {
          // TOTP 2FA - existing flow
          setNeeds2FA(true);
          setTwoFAType('totp');
          setTempToken(result.temp_token);
        }
      } else {
        toast.success('Welcome back!');
        navigate(result.role === 'seeker' ? '/dashboard' : '/recruiter');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const verifyFn = twoFAType === 'totp' ? verifyTotp2FA : verifyEmail2FA;
      const userData = await verifyFn(tempToken, verificationCode);
      toast.success('Welcome back!');
      navigate(userData.role === 'seeker' ? '/dashboard' : '/recruiter');
    } catch (error) {
      const detail = error.response?.data?.detail || 'Invalid code';
      toast.error(detail);
      if (error.response?.status === 401 && detail.includes('expired')) {
        setNeeds2FA(false);
        setTempToken('');
        setVerificationCode('');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-secondary/20 rounded-full blur-3xl" />
      </div>

      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative items-center justify-center p-12">
        <div className="max-w-lg">
          <Link to="/" className="flex items-center gap-3 mb-12">
            <img src="/logo.svg" alt="Hireabble" className="w-12 h-12 rounded-xl" />
            <span className="text-2xl font-bold font-['Outfit']">Hireabble</span>
          </Link>
          
          <h1 className="text-4xl font-bold font-['Outfit'] mb-6">
            Welcome back to{' '}
            <span className="gradient-text">Hireabble</span>
          </h1>
          
          <p className="text-lg text-muted-foreground">
            Sign in to continue swiping through opportunities and connecting with your next career move.
          </p>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <Link to="/" className="flex lg:hidden items-center gap-2 mb-8">
            <img src="/logo.svg" alt="Hireabble" className="w-10 h-10 rounded-xl" />
            <span className="text-xl font-bold font-['Outfit']">Hireabble</span>
          </Link>

          <div className="glass-card rounded-3xl p-8 md:p-10">
            {needs2FA ? (
              <>
                <div className="mb-8 text-center">
                  <Shield className="w-12 h-12 mx-auto mb-3 text-primary" />
                  <h2 className="text-2xl font-bold font-['Outfit'] mb-2">
                    {twoFAType === 'email' ? 'Check Your Email' : 'Enter 2FA Code'}
                  </h2>
                  <p className="text-muted-foreground">
                    {twoFAType === 'email'
                      ? 'Enter the 6-digit code sent to your email'
                      : 'Enter the code from your authenticator app'}
                  </p>
                </div>

                <form onSubmit={handleVerify2FA} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="code">Verification Code</Label>
                    <Input
                      id="code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      required
                      autoFocus
                      className="h-14 rounded-xl bg-background border-border text-center text-2xl tracking-[0.5em] font-mono"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={loading || verificationCode.length !== 6}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-lg font-medium btn-hover-glow"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        Verify & Sign In
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </form>

                <button
                  type="button"
                  onClick={() => { setNeeds2FA(false); setTempToken(''); setVerificationCode(''); }}
                  className="w-full mt-4 text-center text-sm text-muted-foreground hover:text-primary transition-colors"
                >
                  Back to login
                </button>
              </>
            ) : (
              <>
                <div className="mb-8">
                  <h2 className="text-2xl font-bold font-['Outfit'] mb-2">Sign In</h2>
                  <p className="text-muted-foreground">Enter your credentials to continue</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-12 h-12 rounded-xl bg-background border-border"
                        data-testid="login-email-input"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="password">Password</Label>
                      <Link
                        to="/forgot-password"
                        className="text-sm text-primary hover:underline"
                        data-testid="forgot-password-link"
                      >
                        Forgot password?
                      </Link>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-12 pr-12 h-12 rounded-xl bg-background border-border"
                        data-testid="login-password-input"
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

                  <Button
                    type="submit"
                    disabled={loading}
                    className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-lg font-medium btn-hover-glow"
                    data-testid="login-submit-btn"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        Sign In
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </>
                    )}
                  </Button>
                </form>

                <OAuthButtons role={role} />

                <p className="mt-8 text-center text-muted-foreground">
                  Don't have an account?{' '}
                  <Link to={`/register/${role}`} className="text-primary hover:underline font-medium" data-testid="register-link">
                    Create one
                  </Link>
                </p>

                <div className="flex items-center justify-center gap-3 mt-4">
                  <Link to="/privacy" className="text-xs text-muted-foreground hover:text-foreground">Privacy Policy</Link>
                  <span className="text-xs text-muted-foreground">·</span>
                  <Link to="/terms" className="text-xs text-muted-foreground hover:text-foreground">Terms</Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
