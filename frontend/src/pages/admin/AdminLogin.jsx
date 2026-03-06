import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Shield, Eye, EyeOff } from 'lucide-react';
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
  const { login } = useAdminAuth();
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
        await login(email, password);
        navigate('/admin/dashboard');
      }
    } catch (error) {
      const detail = error.response?.data?.detail || 'Something went wrong';
      toast.error(detail);
      // If login fails with "Invalid credentials", suggest setup
      if (!isSetup && error.response?.status === 401) {
        toast.info('No admin account? Click "First-time setup" below.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500/30 mb-4">
            <Shield className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
          <p className="text-gray-400 mt-1">
            {isSetup ? 'Create your admin account' : 'Hireabble Platform Administration'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-gray-800/50 border border-gray-700 rounded-2xl p-8 space-y-6 backdrop-blur-sm">
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

        <p className="text-center text-gray-500 text-sm mt-6">
          This area is restricted to authorized administrators only.
        </p>
      </div>
    </div>
  );
}
