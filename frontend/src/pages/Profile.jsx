import { useState, useEffect } from 'react';
import { User, Mail, Briefcase, MapPin, Save, LogOut, Building2 } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';

export default function Profile() {
  const { user, updateProfile, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    bio: '',
    location: '',
    company: '',
    skills: ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        title: user.title || '',
        bio: user.bio || '',
        location: user.location || '',
        company: user.company || '',
        skills: user.skills?.join(', ') || ''
      });
    }
  }, [user]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const updates = {
        ...formData,
        skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean)
      };
      await updateProfile(updates);
      toast.success('Profile updated!');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-[150px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-[150px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 md:p-8">
        <h1 className="text-2xl font-bold font-['Outfit']">Profile</h1>
        <p className="text-muted-foreground">Manage your account</p>
      </header>

      {/* Profile Card */}
      <main className="relative z-10 px-6 md:px-8">
        <div className="max-w-lg mx-auto">
          {/* Avatar Section */}
          <div className="glass-card rounded-3xl p-8 mb-6 text-center">
            <div className="relative inline-block">
              <img 
                src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user?.id}`}
                alt="Avatar"
                className="w-24 h-24 rounded-full border-4 border-primary mx-auto"
              />
              <div className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center">
                {user?.role === 'seeker' ? (
                  <User className="w-4 h-4 text-white" />
                ) : (
                  <Building2 className="w-4 h-4 text-white" />
                )}
              </div>
            </div>
            <h2 className="text-xl font-bold font-['Outfit'] mt-4">{user?.name}</h2>
            <p className="text-muted-foreground">{user?.email}</p>
            <span className="inline-block mt-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-sm capitalize">
              {user?.role}
            </span>
          </div>

          {/* Edit Form */}
          <form onSubmit={handleSubmit} className="glass-card rounded-3xl p-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="pl-12 h-12 rounded-xl bg-background border-border"
                  data-testid="profile-name-input"
                />
              </div>
            </div>

            {user?.role === 'seeker' ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="title">Job Title</Label>
                  <div className="relative">
                    <Briefcase className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="e.g., Software Engineer"
                      className="pl-12 h-12 rounded-xl bg-background border-border"
                      data-testid="profile-title-input"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="skills">Skills (comma-separated)</Label>
                  <Input
                    id="skills"
                    value={formData.skills}
                    onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                    placeholder="e.g., React, Node.js, Python"
                    className="h-12 rounded-xl bg-background border-border"
                    data-testid="profile-skills-input"
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="company">Company Name</Label>
                <div className="relative">
                  <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    placeholder="e.g., Acme Inc."
                    className="pl-12 h-12 rounded-xl bg-background border-border"
                    data-testid="profile-company-input"
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g., San Francisco, CA"
                  className="pl-12 h-12 rounded-xl bg-background border-border"
                  data-testid="profile-location-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                placeholder="Tell us about yourself..."
                className="min-h-[100px] rounded-xl bg-background border-border resize-none"
                data-testid="profile-bio-input"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90"
              data-testid="save-profile-btn"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Save className="w-5 h-5 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </form>

          {/* Logout Button */}
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full h-12 rounded-xl mt-6 border-destructive/30 text-destructive hover:bg-destructive/10"
            data-testid="logout-btn"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Sign Out
          </Button>
        </div>
      </main>

      <Navigation />
    </div>
  );
}
