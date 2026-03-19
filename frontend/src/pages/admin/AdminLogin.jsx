import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Shield, Eye, EyeOff, Mail } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const { login, verify2FA } = useAdminAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSetup) {
        // First-time setup — create admin account
        const res = await axios.post(`${API}/admin/setup`, { email, password, name });
        localStorage.setItem('admin_token', res.data.token);
        toast.success('Admin account created!');
        window.location.href = '/admin/dashboard';
      } else {
        const result = await login(email, password);
        if (result?.requires_2fa) {
          setNeeds2FA(true);
          setTempToken(result.temp_token);
          toast.success('Verification code sent to your email');
        } else {
          navigate('/admin/dashboard');
        }
      }
    } catch (error) {
      const detail = error.response?.data?.detail || 'Something went wrong';
      toast.error(detail);
      if (!isSetup && error.response?.status === 401) {
        toast.info('No admin account? Click "First-time setup" below.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await verify2FA(tempToken, verificationCode);
      navigate('/admin/dashboard');
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
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.3)' }}>
            <Shield className="w-8 h-8" style={{ color: '#f87171' }} />
          </div>
          <h1 className="text-2xl font-bold" style={{ color: '#ffffff' }}>Admin Portal</h1>
          <p style={{ color: '#9ca3af', marginTop: '4px' }}>
            {isSetup ? 'Create your admin account' : 'Hireabble Platform Administration'}
          </p>
        </div>

        {needs2FA ? (
          <form onSubmit={handleVerify2FA} className="rounded-2xl p-8 space-y-6" style={{ background: 'rgba(31,41,55,0.7)', border: '1px solid rgba(75,85,99,0.5)', backdropFilter: 'blur(8px)' }}>
            <div className="text-center mb-2">
              <Mail className="w-10 h-10 mx-auto mb-3" style={{ color: '#6366f1' }} />
              <p className="text-gray-300 text-sm">
                Enter the 6-digit code sent to your email
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Verification Code</Label>
              <Input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                required
                autoFocus
                className="bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-500 focus:border-red-500 focus:ring-red-500/20 text-center text-2xl tracking-[0.5em] font-mono"
              />
            </div>

            <Button
              type="submit"
              disabled={loading || verificationCode.length !== 6}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? 'Verifying...' : 'Verify & Sign In'}
            </Button>

            <button
              type="button"
              onClick={() => { setNeeds2FA(false); setTempToken(''); setVerificationCode(''); }}
              className="w-full text-center text-sm text-gray-400 hover:text-red-400 transition-colors"
            >
              Back to login
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl p-8 space-y-6" style={{ background: 'rgba(31,41,55,0.7)', border: '1px solid rgba(75,85,99,0.5)', backdropFilter: 'blur(8px)' }}>
            {isSetup && (
              <div className="space-y-2">
                <Label className="text-gray-300">Name</Label>
                <Input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  required
                  className="bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-500 focus:border-red-500 focus:ring-red-500/20"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-gray-300">Email</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@hireabble.com"
                required
                className="bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-500 focus:border-red-500 focus:ring-red-500/20"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-gray-300">Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                  className="bg-gray-900/50 border-gray-600 text-white placeholder:text-gray-500 focus:border-red-500 focus:ring-red-500/20 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? (isSetup ? 'Creating account...' : 'Signing in...') : (isSetup ? 'Create Admin Account' : 'Sign In to Admin')}
            </Button>

            <button
              type="button"
              onClick={() => setIsSetup(!isSetup)}
              className="w-full text-center text-sm text-gray-400 hover:text-red-400 transition-colors"
            >
              {isSetup ? 'Already have an account? Sign in' : 'First-time setup? Create admin account'}
            </button>
          </form>
        )}

        <p className="text-center text-gray-500 text-sm mt-6">
          This area is restricted to authorized administrators only.
        </p>
      </div>
    </div>
  );
}
