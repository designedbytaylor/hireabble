import { useState, useEffect } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import { Mail, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const tokenParam = searchParams.get('token');
  const { user, token, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [status, setStatus] = useState(tokenParam ? 'verifying' : 'pending'); // verifying, success, error, pending
  const [resending, setResending] = useState(false);

  // If user arrives with a token param, verify it
  useEffect(() => {
    if (!tokenParam) return;

    const verify = async () => {
      try {
        await axios.post(`${API}/auth/verify-email`, { token: tokenParam });
        setStatus('success');
        // Refresh user data so email_verified updates
        if (token) {
          try {
            const res = await axios.get(`${API}/auth/me`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            localStorage.setItem('cached_user', JSON.stringify(res.data));
          } catch {}
        }
      } catch (error) {
        setStatus('error');
      }
    };
    verify();
  }, [tokenParam, token]);

  const handleResend = async () => {
    if (!token) {
      toast.error('Please log in first');
      return;
    }
    setResending(true);
    try {
      await axios.post(`${API}/auth/resend-verification`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Verification email sent! Check your inbox.');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to resend verification email');
    } finally {
      setResending(false);
    }
  };

  const goToDashboard = () => {
    if (user) {
      navigate(user.role === 'seeker' ? '/dashboard' : '/recruiter');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-secondary/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <Link to="/" className="flex items-center gap-2 mb-8 justify-center">
          <img src="/logo.svg" alt="Hireabble" className="w-10 h-10 rounded-xl" />
          <span className="text-xl font-bold font-['Outfit']">Hireabble</span>
        </Link>

        <div className="glass-card rounded-3xl p-8 md:p-10 text-center">
          {status === 'verifying' && (
            <>
              <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
              <h2 className="text-2xl font-bold font-['Outfit'] mb-2">Verifying Your Email</h2>
              <p className="text-muted-foreground">Please wait while we verify your email address...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-green-500" />
              </div>
              <h2 className="text-2xl font-bold font-['Outfit'] mb-2">Email Verified!</h2>
              <p className="text-muted-foreground mb-6">
                Your email has been verified successfully. You now have full access to Hireabble.
              </p>
              <Button
                onClick={goToDashboard}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-lg font-medium"
              >
                Continue to Dashboard
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-10 h-10 text-red-500" />
              </div>
              <h2 className="text-2xl font-bold font-['Outfit'] mb-2">Verification Failed</h2>
              <p className="text-muted-foreground mb-6">
                This verification link is invalid or has expired. Please request a new one.
              </p>
              <Button
                onClick={handleResend}
                disabled={resending || !token}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-lg font-medium"
              >
                {resending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Resend Verification Email'
                )}
              </Button>
              {!token && (
                <p className="text-sm text-muted-foreground mt-3">
                  <Link to="/login" className="text-primary hover:underline">Log in</Link> first to resend the verification email.
                </p>
              )}
            </>
          )}

          {status === 'pending' && (
            <>
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Mail className="w-10 h-10 text-primary" />
              </div>
              <h2 className="text-2xl font-bold font-['Outfit'] mb-2">Verify Your Email</h2>
              <p className="text-muted-foreground mb-2">
                We've sent a verification link to:
              </p>
              {user?.email && (
                <p className="font-medium text-foreground mb-6">{user.email}</p>
              )}
              <p className="text-sm text-muted-foreground mb-6">
                Check your inbox (and spam folder) and click the link to verify your email. This gives you full access to matches, messaging, and email notifications.
              </p>
              <Button
                onClick={handleResend}
                disabled={resending}
                className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90 font-medium mb-3"
              >
                {resending ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Resend Verification Email'
                )}
              </Button>
              <Button
                onClick={goToDashboard}
                variant="ghost"
                className="w-full h-12 rounded-xl font-medium text-muted-foreground"
              >
                Skip for Now
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
