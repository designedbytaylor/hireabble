import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Briefcase, ArrowRight, Loader2, Upload, X, Image } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import useDocumentTitle from '../hooks/useDocumentTitle';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function RecruiterOnboarding() {
  useDocumentTitle('Get Started');
  const { user, token, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const logoInputRef = useRef(null);
  const [formData, setFormData] = useState({
    company: user?.company || '',
    title: user?.title || '',
    company_logo: user?.company_logo || '',
  });

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('purpose', 'company_logo');
      const response = await axios.post(`${API}/upload/photo`, fd, {
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' },
      });
      setFormData(prev => ({ ...prev, company_logo: response.data.photo_url }));
      toast.success('Logo uploaded!');
    } catch (error) {
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.company.trim()) {
      toast.error('Please enter your company name');
      return;
    }
    setLoading(true);
    try {
      await updateProfile({
        company: formData.company.trim(),
        title: formData.title.trim() || null,
        company_logo: formData.company_logo || null,
        onboarding_complete: true,
      });
      toast.success('Welcome to Hireabble!');
      navigate('/recruiter');
    } catch (error) {
      toast.error('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-secondary/20 rounded-full blur-3xl" />
      </div>

      <div className="w-full max-w-md relative z-10">
        <div className="glass-card rounded-3xl p-8 md:p-10">
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold font-['Outfit'] mb-2">Complete Your Profile</h1>
            <p className="text-muted-foreground">Tell us about your company so candidates can find you</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Company Logo */}
            <div className="space-y-2">
              <Label>Company Logo</Label>
              <div className="flex items-center gap-4">
                <div className="relative">
                  {formData.company_logo ? (
                    <div className="relative">
                      <img
                        src={formData.company_logo}
                        alt="Company logo"
                        className="w-16 h-16 rounded-xl object-cover border-2 border-primary"
                      />
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, company_logo: '' }))}
                        className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-destructive flex items-center justify-center"
                      >
                        <X className="w-3 h-3 text-white" />
                      </button>
                    </div>
                  ) : (
                    <div
                      onClick={() => logoInputRef.current?.click()}
                      className="w-16 h-16 rounded-xl bg-accent border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                    >
                      {uploadingLogo ? (
                        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                      ) : (
                        <Image className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="rounded-lg"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {uploadingLogo ? 'Uploading...' : formData.company_logo ? 'Change' : 'Upload Logo'}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">Optional. Shown on job listings.</p>
                </div>
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                onChange={handleLogoUpload}
                className="hidden"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Company Name <span className="text-red-500">*</span></Label>
              <div className="relative">
                <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="company"
                  type="text"
                  placeholder="Acme Inc."
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  className="pl-12 h-12 rounded-xl bg-background border-border"
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">Your Role at Company</Label>
              <div className="relative">
                <Briefcase className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="title"
                  type="text"
                  placeholder="Head of Talent"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="pl-12 h-12 rounded-xl bg-background border-border"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-lg font-medium btn-hover-glow mt-4"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Get Started
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
