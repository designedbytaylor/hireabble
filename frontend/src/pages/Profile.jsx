import { useState, useEffect, useRef } from 'react';
import { User, Mail, Briefcase, MapPin, Save, LogOut, Building2, Download, Upload, CheckCircle, AlertCircle, Lock, Eye, EyeOff, ChevronDown, Plus, Trash2, GraduationCap, Award, Clock, Navigation2, Bell, BellOff, CreditCard, Crown, ExternalLink, FileText, Loader2, HelpCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import { toast } from 'sonner';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import Navigation from '../components/Navigation';
import VideoUpload from '../components/VideoUpload';
import { getPhotoUrl, handleImgError } from '../utils/helpers';
import { isPushSupported, getPermissionStatus, subscribeToPush, unsubscribeFromPush } from '../utils/pushNotifications';
import { UpgradePrompt } from '../components/UpgradeModal';
import ConfirmDialog from '../components/ConfirmDialog';
import PhotoCropModal from '../components/PhotoCropModal';
import LocationAutocomplete from '../components/LocationAutocomplete';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

function EmailNotificationSettings({ token }) {
  const [prefs, setPrefs] = useState(null);
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await axios.get(`${API}/notifications/preferences`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setPrefs(res.data);
      } catch { /* ignore */ }
    };
    fetch();
  }, [token]);

  const toggle = async (key) => {
    if (!prefs) return;
    setSaving(key);
    const newVal = !prefs[key];
    setPrefs(prev => ({ ...prev, [key]: newVal }));
    try {
      await axios.put(`${API}/notifications/preferences`, { [key]: newVal }, {
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      setPrefs(prev => ({ ...prev, [key]: !newVal }));
      toast.error('Failed to update preference');
    } finally {
      setSaving(null);
    }
  };

  if (!prefs) return null;

  const items = [
    { key: 'matches', label: 'New matches', desc: 'When you match with a job or candidate' },
    { key: 'interviews', label: 'Interview updates', desc: 'Interview requests, acceptances & changes' },
    { key: 'messages', label: 'Message digests', desc: 'Summary of unread messages (max every 15 min)' },
    { key: 'status_updates', label: 'Application updates', desc: 'When your application stage changes' },
    { key: 'marketing_emails_opt_in', label: 'Marketing & promotions', desc: 'Occasional updates, tips, and promotional offers' },
  ];

  return (
    <div className="glass-card rounded-2xl p-5 mt-6">
      <h3 className="text-lg font-bold font-['Outfit'] mb-3 flex items-center gap-2">
        <Mail className="w-5 h-5" /> Email Notifications
      </h3>
      <div className="space-y-2">
        {items.map(({ key, label, desc }) => (
          <button
            key={key}
            type="button"
            onClick={() => toggle(key)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
              prefs[key]
                ? 'bg-primary/5 border-primary/20 text-foreground'
                : 'bg-background border-border text-muted-foreground hover:border-primary/10'
            }`}
          >
            <div className="flex-1 text-left">
              <div className="font-medium text-sm">{label}</div>
              <div className="text-xs opacity-70">{desc}</div>
            </div>
            <div className={`w-10 h-6 rounded-full transition-colors shrink-0 ${prefs[key] ? 'bg-primary' : 'bg-muted'}`}>
              <div className={`w-5 h-5 rounded-full bg-white mt-0.5 transition-transform ${prefs[key] ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
            </div>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        You can also unsubscribe via the link at the bottom of any email.
      </p>
    </div>
  );
}

export default function Profile() {
  const { user, token, updateProfile, logout, refreshUser, patchUser } = useAuth();
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [completeness, setCompleteness] = useState({ percentage: 0, missing_fields: [], is_complete: false });
  const fileInputRef = useRef(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported] = useState(isPushSupported());
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    bio: '',
    location: '',
    company: '',
    skills: '',
    current_employer: '',
    experience_years: '',
    school: '',
    degree: '',
  });
  const [workHistory, setWorkHistory] = useState([]);
  const [education, setEducation] = useState([]);
  const [certifications, setCertifications] = useState([]);
  const [references, setReferences] = useState([]);
  const [referencesHidden, setReferencesHidden] = useState(true);
  const [referenceRequests, setReferenceRequests] = useState([]);
  const [subscription, setSubscription] = useState(undefined); // undefined = loading, null = no subscription
  const [parsingResume, setParsingResume] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const resumeInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        title: user.title || '',
        bio: user.bio || '',
        location: user.location || '',
        company: user.company || '',
        skills: user.skills?.join(', ') || '',
        current_employer: user.current_employer || '',
        experience_years: user.experience_years || '',
        school: user.school || '',
        degree: user.degree || '',
      });
      setWorkHistory(user.work_history || []);
      setEducation(user.education || []);
      setCertifications(user.certifications || []);
      setReferences(user.references || []);
      setReferencesHidden(user.references_hidden !== false);
      fetchCompleteness();
      fetchReferenceRequests();
      fetchSubscription();
    }
    // Check push notification status - auto-enable on first visit
    if (pushSupported) {
      const permStatus = getPermissionStatus();
      if (permStatus === 'granted') {
        setPushEnabled(true);
      } else if (permStatus === 'default' && !user?.push_subscription) {
        // Auto-prompt for push notifications on first profile visit
        subscribeToPush(token).then((ok) => {
          if (ok) setPushEnabled(true);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleTogglePush = async () => {
    if (pushEnabled) {
      const ok = await unsubscribeFromPush(token);
      if (ok) {
        setPushEnabled(false);
        toast.success('Push notifications disabled');
      }
    } else {
      const ok = await subscribeToPush(token);
      if (ok) {
        setPushEnabled(true);
        toast.success('Push notifications enabled! You\'ll be notified of new matches and messages.');
      } else {
        toast.error('Could not enable notifications. Please check your browser settings.');
      }
    }
  };

  const fetchReferenceRequests = async () => {
    try {
      const response = await axios.get(`${API}/references/requests`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReferenceRequests(response.data);
    } catch (error) {
      console.error('Failed to fetch reference requests:', error);
    }
  };

  const fetchSubscription = async () => {
    try {
      const response = await axios.get(`${API}/payments/subscription`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSubscription(response.data);
    } catch (error) {
      // Subscription endpoint may not exist for all users
      setSubscription(null);
    }
  };

  const fetchCompleteness = async () => {
    try {
      const response = await axios.get(`${API}/profile/completeness`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCompleteness(response.data);
    } catch (error) {
      console.error('Failed to fetch completeness:', error);
    }
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    // Open crop modal with the selected image
    const reader = new FileReader();
    reader.onload = () => setCropImageSrc(reader.result);
    reader.readAsDataURL(file);
  };

  const handleCroppedPhoto = async (blob) => {
    setCropImageSrc(null);
    setUploadingPhoto(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', new File([blob], 'photo.jpg', { type: 'image/jpeg' }));

      const response = await axios.post(`${API}/upload/photo`, formDataUpload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      await updateProfile({ photo_url: response.data.photo_url });
      toast.success('Photo updated!');
      fetchCompleteness();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please select a PDF or Word document (.pdf, .doc, .docx)');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Resume must be less than 10MB');
      return;
    }

    setParsingResume(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await axios.post(`${API}/upload/resume`, formDataUpload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      const parsed = response.data.parsed;

      // Build the updated form data from parsed resume
      const updatedFormData = {
        ...formData,
        title: parsed.title || formData.title,
        bio: parsed.bio || formData.bio,
        skills: parsed.skills?.length > 0 ? parsed.skills.join(', ') : formData.skills,
        current_employer: parsed.work_history?.[0]?.company || formData.current_employer,
        experience_years: parsed.experience_years || formData.experience_years,
        location: parsed.location || formData.location,
        school: parsed.education?.[0]?.school || formData.school,
        degree: parsed.education?.[0]?.degree || formData.degree,
      };
      setFormData(updatedFormData);

      const newWorkHistory = parsed.work_history?.length > 0 ? parsed.work_history : workHistory;
      const newEducation = parsed.education?.length > 0 ? parsed.education : education;
      const newCertifications = parsed.certifications?.length > 0 ? parsed.certifications : certifications;

      setWorkHistory(newWorkHistory);
      setEducation(newEducation);
      setCertifications(newCertifications);

      // Auto-save parsed resume data to profile immediately
      try {
        const updates = {
          ...updatedFormData,
          skills: updatedFormData.skills.split(',').map(s => s.trim()).filter(Boolean),
          experience_years: updatedFormData.experience_years ? parseInt(updatedFormData.experience_years) : null,
          work_history: newWorkHistory,
          education: newEducation,
          certifications: newCertifications.filter(Boolean),
          references: references.filter(r => r.name),
          references_hidden: referencesHidden,
        };
        await updateProfile(updates);
        const partsFound = [
          newWorkHistory.length > 0 ? `${newWorkHistory.length} positions` : null,
          newEducation.length > 0 ? `${newEducation.length} education` : null,
          updatedFormData.skills !== formData.skills ? 'skills' : null,
        ].filter(Boolean);
        const summary = partsFound.length > 0 ? ` Found ${partsFound.join(', ')}.` : '';
        if (parsed._parser === 'basic') {
          toast.success(`Resume parsed (basic mode) and saved!${summary} For best results, ensure AI parsing is enabled.`);
        } else {
          toast.success(`Resume parsed and profile updated!${summary}`);
        }
        fetchCompleteness();
      } catch {
        toast.success('Resume parsed! Review and save your profile.');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to parse resume');
    } finally {
      setParsingResume(false);
      // Reset the input so the same file can be re-uploaded
      if (resumeInputRef.current) resumeInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const updates = {
        ...formData,
        skills: formData.skills.split(',').map(s => s.trim()).filter(Boolean),
        experience_years: formData.experience_years ? parseInt(formData.experience_years) : null,
        work_history: workHistory,
        education: education,
        certifications: certifications.filter(Boolean),
        references: references.filter(r => r.name),
        references_hidden: referencesHidden,
      };
      await updateProfile(updates);
      toast.success('Profile updated!');
      fetchCompleteness();
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadResume = async () => {
    try {
      const response = await axios.get(`${API}/users/resume/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${user?.name?.replace(' ', '_') || 'resume'}_Resume.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success('Resume downloaded!');
    } catch (error) {
      toast.error('Failed to download resume');
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);

  const handleExportData = async () => {
    setExportLoading(true);
    try {
      const res = await axios.get(`${API}/auth/account/export`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hireabble-data-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Data exported successfully');
    } catch {
      toast.error('Failed to export data. Please try again.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      await axios.delete(`${API}/auth/account`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      toast.success('Account deleted');
      logout();
    } catch {
      toast.error('Failed to delete account. Please try again or contact support.');
    } finally {
      setDeleteLoading(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not supported by your browser');
      return;
    }
    setDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
          );
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.village || '';
          const state = data.address?.state || '';
          const country = data.address?.country || '';
          let locationStr = city;
          if (state) locationStr += `, ${state}`;
          else if (country) locationStr += `, ${country}`;
          if (locationStr) {
            setFormData(prev => ({ ...prev, location: locationStr }));
            toast.success(`Location detected: ${locationStr}`);
          } else {
            toast.error('Could not determine your city');
          }
        } catch {
          toast.error('Failed to detect location');
        } finally {
          setDetectingLocation(false);
        }
      },
      () => {
        toast.error('Location access denied');
        setDetectingLocation(false);
      },
      { timeout: 10000 }
    );
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    
    if (passwordData.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    
    setChangingPassword(true);
    try {
      await axios.post(`${API}/auth/change-password`, {
        current_password: passwordData.currentPassword,
        new_password: passwordData.newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      toast.success('Password changed successfully!');
      setShowChangePassword(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary/10 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6 md:p-8">
        <h1 className="text-2xl font-bold font-['Outfit']">Profile</h1>
        <p className="text-muted-foreground">Manage your account</p>
      </header>

      {/* Profile Card */}
      <main className="relative z-10 px-6 md:px-8">
        <div className="max-w-lg mx-auto">
          {/* Upgrade Banner - hide if subscribed or still loading subscription status */}
          {subscription !== undefined && !subscription?.subscribed && (
            <div className="mb-6">
              <UpgradePrompt
                title={user?.role === 'recruiter' ? 'Upgrade to Pro' : 'Upgrade to Plus'}
                subtitle="Unlock premium features and stand out from the crowd"
                tierHint={user?.role === 'recruiter' ? 'recruiter_pro' : 'seeker_plus'}
                onSubscribed={fetchSubscription}
              />
            </div>
          )}

          {/* Avatar Section */}
          <div className="glass-card rounded-3xl p-8 mb-6 text-center">
            <div className="relative inline-block mb-4">
              <img
                src={getPhotoUrl(user?.photo_url, user?.name || user?.id) || user?.avatar}
                alt="Avatar"
                className="w-40 h-52 rounded-2xl border-4 border-primary mx-auto object-cover"
                onError={handleImgError(user?.name || user?.id)}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute bottom-2 right-2 w-9 h-9 rounded-full bg-gradient-to-r from-primary to-secondary flex items-center justify-center hover:scale-110 transition-transform"
              >
                {uploadingPhoto ? (
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
            </div>
            <h2 className="text-xl font-bold font-['Outfit']">{user?.name}</h2>
            <p className="text-muted-foreground">{user?.email}</p>
            <span className="inline-block mt-2 px-3 py-1 rounded-full bg-primary/20 text-primary text-sm capitalize">
              {user?.role}
            </span>
            {user?.role === 'seeker' && (
              <p className="text-xs text-muted-foreground mt-3">
                This is your swipe card photo — recruiters see it when browsing candidates. Use a professional, well-lit vertical photo.
              </p>
            )}
          </div>

          {/* Subscription Management */}
          {subscription?.subscribed && (
            <div className="glass-card rounded-2xl p-5 mb-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-400 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold font-['Outfit']">
                    {subscription?.tier_name || subscription?.plan_name || (user?.role === 'recruiter' ? 'Recruiter Pro' : 'Seeker Plus')}
                  </h3>
                  <p className="text-xs text-muted-foreground">Active subscription</p>
                </div>
              </div>
              {subscription.period_end && (
                <p className="text-sm text-muted-foreground mb-3">
                  Renews {new Date(subscription.period_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </p>
              )}
              <a
                href="https://apps.apple.com/account/subscriptions"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <CreditCard className="w-4 h-4" />
                Manage Subscription
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}

          {/* Profile Completeness (Seeker Only) */}
          {user?.role === 'seeker' && (
            <div className="glass-card rounded-2xl p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  {completeness.is_complete ? (
                    <CheckCircle className="w-5 h-5 text-success" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-secondary" />
                  )}
                  <span className="font-medium">Profile Strength</span>
                </div>
                <span className={`text-sm font-bold ${completeness.is_complete ? 'text-success' : 'text-secondary'}`}>
                  {completeness.percentage}%
                </span>
              </div>
              <Progress value={completeness.percentage} className="h-2 mb-3" />
              {completeness.missing_fields.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Add {completeness.missing_fields.slice(0, 2).join(', ')} to improve visibility
                </p>
              )}
              
            </div>
          )}

          {/* Resume Upload & Download (Seeker Only) */}
          {user?.role === 'seeker' && (
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <input
                ref={resumeInputRef}
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleResumeUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => resumeInputRef.current?.click()}
                disabled={parsingResume}
                className="flex-1 h-12 rounded-xl border-secondary/30 text-secondary hover:bg-secondary/10"
                data-testid="upload-resume-btn"
              >
                {parsingResume ? (
                  <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Reading your experience...</>
                ) : (
                  <><FileText className="w-5 h-5 mr-2" /> Upload Resume to Autofill</>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleDownloadResume}
                className="flex-1 h-12 rounded-xl border-primary/30 text-primary hover:bg-primary/10"
                data-testid="download-resume-btn"
              >
                <Download className="w-5 h-5 mr-2" />
                Download Resume PDF
              </Button>
            </div>
          )}

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

                {/* Current Employment */}
                <div className="space-y-2">
                  <Label htmlFor="current_employer">Current Employer</Label>
                  <div className="relative">
                    <Building2 className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="current_employer"
                      value={formData.current_employer}
                      onChange={(e) => setFormData({ ...formData, current_employer: e.target.value })}
                      placeholder="e.g., Google"
                      className="pl-12 h-12 rounded-xl bg-background border-border"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="experience_years">Years of Experience</Label>
                  <div className="relative">
                    <Clock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="experience_years"
                      type="number"
                      min="0"
                      value={formData.experience_years}
                      onChange={(e) => setFormData({ ...formData, experience_years: e.target.value })}
                      placeholder="e.g., 5"
                      className="pl-12 h-12 rounded-xl bg-background border-border"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="school">School</Label>
                  <div className="relative">
                    <GraduationCap className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="school"
                      value={formData.school}
                      onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                      placeholder="e.g., MIT"
                      className="pl-12 h-12 rounded-xl bg-background border-border"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="degree">Degree</Label>
                  <Input
                    id="degree"
                    value={formData.degree}
                    onChange={(e) => setFormData({ ...formData, degree: e.target.value })}
                    placeholder="e.g., B.S. Computer Science"
                    className="h-12 rounded-xl bg-background border-border"
                  />
                </div>

                {/* Work History */}
                <div className="pt-4 border-t border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Work Experience</Label>
                    <button
                      type="button"
                      onClick={() => setWorkHistory([...workHistory, { company: '', position: '', start_date: '', end_date: '', description: '' }])}
                      className="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                  {workHistory.map((job, i) => (
                    <div key={i} className="p-4 rounded-xl bg-background/50 border border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Position {i + 1}</span>
                        <button
                          type="button"
                          onClick={() => setWorkHistory(workHistory.filter((_, idx) => idx !== i))}
                          className="text-destructive hover:text-destructive/80"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <Input
                        value={job.position}
                        onChange={(e) => { const w = [...workHistory]; w[i] = { ...w[i], position: e.target.value }; setWorkHistory(w); }}
                        placeholder="Job Title"
                        className="h-10 rounded-lg bg-background border-border"
                      />
                      <Input
                        value={job.company}
                        onChange={(e) => { const w = [...workHistory]; w[i] = { ...w[i], company: e.target.value }; setWorkHistory(w); }}
                        placeholder="Company"
                        className="h-10 rounded-lg bg-background border-border"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={job.start_date}
                          onChange={(e) => { const w = [...workHistory]; w[i] = { ...w[i], start_date: e.target.value }; setWorkHistory(w); }}
                          placeholder="Start (e.g., Jan 2020)"
                          className="h-10 rounded-lg bg-background border-border"
                        />
                        <Input
                          value={job.end_date}
                          onChange={(e) => { const w = [...workHistory]; w[i] = { ...w[i], end_date: e.target.value }; setWorkHistory(w); }}
                          placeholder="End (or leave blank)"
                          className="h-10 rounded-lg bg-background border-border"
                        />
                      </div>
                      <Textarea
                        value={job.description || ''}
                        onChange={(e) => { const w = [...workHistory]; w[i] = { ...w[i], description: e.target.value }; setWorkHistory(w); }}
                        placeholder="Describe your responsibilities..."
                        className="min-h-[60px] rounded-lg bg-background border-border resize-none text-sm"
                      />
                    </div>
                  ))}
                  {workHistory.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">No work experience added yet</p>
                  )}
                </div>

                {/* Education */}
                <div className="pt-4 border-t border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Education</Label>
                    <button
                      type="button"
                      onClick={() => setEducation([...education, { school: '', degree: '', field: '', year: '' }])}
                      className="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                  {education.map((edu, i) => (
                    <div key={i} className="p-4 rounded-xl bg-background/50 border border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Education {i + 1}</span>
                        <button
                          type="button"
                          onClick={() => setEducation(education.filter((_, idx) => idx !== i))}
                          className="text-destructive hover:text-destructive/80"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <Input
                        value={edu.school}
                        onChange={(e) => { const ed = [...education]; ed[i] = { ...ed[i], school: e.target.value }; setEducation(ed); }}
                        placeholder="School / University"
                        className="h-10 rounded-lg bg-background border-border"
                      />
                      <Input
                        value={edu.degree}
                        onChange={(e) => { const ed = [...education]; ed[i] = { ...ed[i], degree: e.target.value }; setEducation(ed); }}
                        placeholder="Degree (e.g., B.S., M.S., Ph.D.)"
                        className="h-10 rounded-lg bg-background border-border"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={edu.field}
                          onChange={(e) => { const ed = [...education]; ed[i] = { ...ed[i], field: e.target.value }; setEducation(ed); }}
                          placeholder="Field of Study"
                          className="h-10 rounded-lg bg-background border-border"
                        />
                        <Input
                          value={edu.year}
                          onChange={(e) => { const ed = [...education]; ed[i] = { ...ed[i], year: e.target.value }; setEducation(ed); }}
                          placeholder="Graduation Year"
                          className="h-10 rounded-lg bg-background border-border"
                        />
                      </div>
                    </div>
                  ))}
                  {education.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">No education added yet</p>
                  )}
                </div>

                {/* Certifications */}
                <div className="pt-4 border-t border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Certifications</Label>
                    <button
                      type="button"
                      onClick={() => setCertifications([...certifications, ''])}
                      className="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>
                  {certifications.map((cert, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-muted-foreground shrink-0" />
                      <Input
                        value={cert}
                        onChange={(e) => { const c = [...certifications]; c[i] = e.target.value; setCertifications(c); }}
                        placeholder="e.g., AWS Solutions Architect"
                        className="h-10 rounded-lg bg-background border-border"
                      />
                      <button
                        type="button"
                        onClick={() => setCertifications(certifications.filter((_, idx) => idx !== i))}
                        className="text-destructive hover:text-destructive/80 shrink-0"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {certifications.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">No certifications added yet</p>
                  )}
                </div>

                {/* References */}
                <div className="pt-4 border-t border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">References</Label>
                    <button
                      type="button"
                      onClick={() => setReferences([...references, { name: '', title: '', company: '', email: '', phone: '' }])}
                      className="flex items-center gap-1 text-sm text-primary hover:text-primary/80"
                    >
                      <Plus className="w-4 h-4" /> Add
                    </button>
                  </div>

                  {/* Hide References Toggle */}
                  <button
                    type="button"
                    onClick={() => setReferencesHidden(!referencesHidden)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      referencesHidden
                        ? 'bg-background border-border'
                        : 'bg-primary/10 border-primary/40'
                    }`}
                  >
                    {referencesHidden ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-primary" />}
                    <div className="flex-1 text-left">
                      <div className="text-sm font-medium">{referencesHidden ? 'References Hidden' : 'References Visible'}</div>
                      <div className="text-xs text-muted-foreground">
                        {referencesHidden ? 'Recruiters will see "Available upon request"' : 'Recruiters can see your references'}
                      </div>
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-colors ${!referencesHidden ? 'bg-primary' : 'bg-muted'}`}>
                      <div className={`w-5 h-5 rounded-full bg-white mt-0.5 transition-transform ${!referencesHidden ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                    </div>
                  </button>

                  {references.map((ref, i) => (
                    <div key={i} className="p-4 rounded-xl bg-background/50 border border-border space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-muted-foreground">Reference {i + 1}</span>
                        <button
                          type="button"
                          onClick={() => setReferences(references.filter((_, idx) => idx !== i))}
                          className="text-destructive hover:text-destructive/80"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <Input
                        value={ref.name}
                        onChange={(e) => { const r = [...references]; r[i] = { ...r[i], name: e.target.value }; setReferences(r); }}
                        placeholder="Full Name"
                        className="h-10 rounded-lg bg-background border-border"
                      />
                      <Input
                        value={ref.title}
                        onChange={(e) => { const r = [...references]; r[i] = { ...r[i], title: e.target.value }; setReferences(r); }}
                        placeholder="Job Title"
                        className="h-10 rounded-lg bg-background border-border"
                      />
                      <Input
                        value={ref.company}
                        onChange={(e) => { const r = [...references]; r[i] = { ...r[i], company: e.target.value }; setReferences(r); }}
                        placeholder="Company"
                        className="h-10 rounded-lg bg-background border-border"
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          value={ref.email}
                          onChange={(e) => { const r = [...references]; r[i] = { ...r[i], email: e.target.value }; setReferences(r); }}
                          placeholder="Email"
                          className="h-10 rounded-lg bg-background border-border"
                        />
                        <Input
                          value={ref.phone}
                          onChange={(e) => { const r = [...references]; r[i] = { ...r[i], phone: e.target.value }; setReferences(r); }}
                          placeholder="Phone"
                          className="h-10 rounded-lg bg-background border-border"
                        />
                      </div>
                    </div>
                  ))}
                  {references.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-2">No references added yet</p>
                  )}

                  {/* Reference Requests */}
                  {referenceRequests.length > 0 && (
                    <div className="space-y-2 pt-3">
                      <Label className="text-sm font-semibold text-secondary">Reference Requests</Label>
                      {referenceRequests.filter(r => r.status === 'pending').map(req => (
                        <div key={req.id} className="p-3 rounded-xl bg-secondary/10 border border-secondary/20 flex items-center gap-3">
                          <div className="flex-1">
                            <div className="text-sm font-medium">{req.recruiter_name}</div>
                            <div className="text-xs text-muted-foreground">{req.company_name} wants to see your references</div>
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await axios.post(`${API}/references/respond/${req.id}`, { action: 'approve' }, {
                                    headers: { Authorization: `Bearer ${token}` }
                                  });
                                  toast.success('References shared!');
                                  fetchReferenceRequests();
                                } catch { toast.error('Failed to respond'); }
                              }}
                              className="px-3 py-1.5 rounded-lg bg-success/20 text-success text-xs font-medium hover:bg-success/30"
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                try {
                                  await axios.post(`${API}/references/respond/${req.id}`, { action: 'deny' }, {
                                    headers: { Authorization: `Bearer ${token}` }
                                  });
                                  toast.info('Request denied');
                                  fetchReferenceRequests();
                                } catch { toast.error('Failed to respond'); }
                              }}
                              className="px-3 py-1.5 rounded-lg bg-destructive/20 text-destructive text-xs font-medium hover:bg-destructive/30"
                            >
                              Deny
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Video Introduction */}
                <div className="pt-4 border-t border-border">
                  <VideoUpload
                    token={token}
                    currentVideoUrl={user?.video_url}
                    onVideoChange={(url) => {
                      updateProfile({ video_url: url });
                    }}
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
              <LocationAutocomplete
                value={formData.location}
                onChange={(val) => setFormData({ ...formData, location: val })}
                placeholder="e.g., San Francisco, CA"
                showDetectButton
                data-testid="profile-location-input"
              />
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

          {/* Change Password Section */}
          <div className="glass-card rounded-3xl p-6 mt-6">
            <button
              onClick={() => setShowChangePassword(!showChangePassword)}
              className="w-full flex items-center justify-between text-left"
              data-testid="change-password-toggle"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Change Password</h3>
                  <p className="text-sm text-muted-foreground">Update your account password</p>
                </div>
              </div>
              <ChevronDown className={`w-5 h-5 text-muted-foreground transition-transform ${showChangePassword ? 'rotate-180' : ''}`} />
            </button>

            {showChangePassword && (
              <form onSubmit={handleChangePassword} className="mt-6 space-y-4 border-t border-border pt-6">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="currentPassword"
                      type={showPasswords.current ? 'text' : 'password'}
                      value={passwordData.currentPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                      placeholder="Enter current password"
                      className="pl-12 pr-12 h-12 rounded-xl bg-background border-border"
                      data-testid="current-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPasswords.current ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="newPassword"
                      type={showPasswords.new ? 'text' : 'password'}
                      value={passwordData.newPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                      placeholder="Enter new password"
                      className="pl-12 pr-12 h-12 rounded-xl bg-background border-border"
                      data-testid="new-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPasswords.new ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPasswords.confirm ? 'text' : 'password'}
                      value={passwordData.confirmPassword}
                      onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                      placeholder="Confirm new password"
                      className="pl-12 pr-12 h-12 rounded-xl bg-background border-border"
                      data-testid="confirm-password-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                      className="absolute right-4 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPasswords.confirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={changingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                  className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90"
                  data-testid="change-password-btn"
                >
                  {changingPassword ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    'Update Password'
                  )}
                </Button>
              </form>
            )}
          </div>

          {/* Private Profile */}
          {user?.role === 'seeker' && (
            <div className="glass-card rounded-2xl p-5 mt-6">
              <h3 className="text-lg font-bold font-['Outfit'] mb-3 flex items-center gap-2">
                <EyeOff className="w-5 h-5" /> Profile Visibility
              </h3>
              <button
                type="button"
                onClick={() => {
                  const newVal = !user?.incognito_mode;
                  patchUser({ incognito_mode: newVal });
                  axios.post(`${API}/profile/incognito`, { enabled: newVal }, {
                    headers: { Authorization: `Bearer ${token}` },
                  }).catch(() => {
                    patchUser({ incognito_mode: !newVal });
                    toast.error('Failed to update');
                  });
                }}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${
                  user?.incognito_mode
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : 'bg-background border-border text-muted-foreground hover:border-primary/20'
                }`}
              >
                {user?.incognito_mode ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                <div className="flex-1 text-left">
                  <div className="font-medium text-sm">Private Profile</div>
                  <div className="text-xs opacity-70">
                    {user?.incognito_mode
                      ? 'Only visible to recruiters for jobs you applied to'
                      : 'Your profile appears in recruiter search & swipes'}
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors ${user?.incognito_mode ? 'bg-primary' : 'bg-muted'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white mt-0.5 transition-transform ${user?.incognito_mode ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </div>
              </button>
              <p className="text-xs text-muted-foreground mt-2">
                When private, recruiters can only see your profile for jobs you've applied to.
              </p>
            </div>
          )}

          {/* Push Notifications */}
          {pushSupported && (
            <div className="glass-card rounded-2xl p-5 mt-6">
              <h3 className="text-lg font-bold font-['Outfit'] mb-3 flex items-center gap-2">
                <Bell className="w-5 h-5" /> Notifications
              </h3>
              <button
                type="button"
                onClick={handleTogglePush}
                className={`w-full flex items-center gap-3 p-4 rounded-xl border transition-all ${
                  pushEnabled
                    ? 'bg-primary/10 border-primary/40 text-primary'
                    : 'bg-background border-border text-muted-foreground hover:border-primary/20'
                }`}
              >
                {pushEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                <div className="flex-1 text-left">
                  <div className="font-medium text-sm">Push Notifications</div>
                  <div className="text-xs opacity-70">
                    {pushEnabled ? 'Get notified of matches, messages & interviews' : 'Enable to stay updated on your phone'}
                  </div>
                </div>
                <div className={`w-10 h-6 rounded-full transition-colors ${pushEnabled ? 'bg-primary' : 'bg-muted'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white mt-0.5 transition-transform ${pushEnabled ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
                </div>
              </button>
              <p className="text-xs text-muted-foreground mt-2">
                You can also manage notifications through your device settings.
              </p>
            </div>
          )}

          {/* Email Notifications */}
          <EmailNotificationSettings token={token} />

          {/* Subscription Management */}
          {user?.subscription?.tier_id && (
            <div className="glass-card rounded-2xl p-5 mt-6">
              <h3 className="text-lg font-bold font-['Outfit'] mb-3 flex items-center gap-2">
                <CreditCard className="w-5 h-5" /> Subscription
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                You are on the <strong className="text-foreground">{user.subscription.tier_name || user.subscription.tier_id}</strong> plan.
              </p>
              <p className="text-xs text-muted-foreground mb-3">
                To manage or cancel your subscription, use the platform where you subscribed:
              </p>
              <div className="space-y-2">
                <a
                  href="https://apps.apple.com/account/subscriptions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-10 rounded-xl border border-border bg-background hover:bg-accent flex items-center justify-center gap-2 text-sm font-medium text-foreground transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Manage in App Store
                </a>
                <a
                  href="https://play.google.com/store/account/subscriptions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full h-10 rounded-xl border border-border bg-background hover:bg-accent flex items-center justify-center gap-2 text-sm font-medium text-foreground transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Manage in Google Play
                </a>
              </div>
            </div>
          )}

          {/* Help & Support */}
          <Link
            to="/support"
            className="w-full h-12 rounded-xl mt-6 border border-border bg-background hover:bg-accent flex items-center justify-center gap-2 text-sm font-medium text-foreground transition-colors"
          >
            <HelpCircle className="w-5 h-5" />
            Help & Support
          </Link>

          {/* Logout Button */}
          <Button
            variant="outline"
            onClick={handleLogout}
            className="w-full h-12 rounded-xl mt-3 border-destructive/30 text-destructive hover:bg-destructive/10"
            data-testid="logout-btn"
          >
            <LogOut className="w-5 h-5 mr-2" />
            Sign Out
          </Button>

          {/* Export Data */}
          <Button
            variant="outline"
            onClick={handleExportData}
            disabled={exportLoading}
            className="w-full h-12 rounded-xl mt-3 border-primary/30 text-primary hover:bg-primary/10"
          >
            <Download className="w-5 h-5 mr-2" />
            {exportLoading ? 'Exporting...' : 'Download My Data'}
          </Button>

          {/* Delete Account */}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full mt-6 text-center text-sm text-muted-foreground hover:text-destructive transition-colors"
          >
            Delete Account
          </button>

          <ConfirmDialog
            open={showDeleteConfirm}
            onOpenChange={setShowDeleteConfirm}
            title="Delete your account?"
            description="This will permanently delete your account, profile, applications, matches, and messages. This action cannot be undone. If you have an active subscription, please cancel it first in your App Store or Google Play settings to avoid further charges."
            confirmLabel={deleteLoading ? 'Deleting...' : 'Delete My Account'}
            variant="destructive"
            onConfirm={handleDeleteAccount}
          />

          {/* Legal Links */}
          <div className="flex items-center justify-center gap-4 mt-6 mb-4 flex-wrap">
            <Link to="/privacy" className="text-xs text-muted-foreground hover:text-foreground">Privacy Policy</Link>
            <span className="text-xs text-muted-foreground">·</span>
            <Link to="/terms" className="text-xs text-muted-foreground hover:text-foreground">Terms & EULA</Link>
          </div>
        </div>
      </main>

      <Navigation />

      {/* Photo Crop Modal */}
      {cropImageSrc && (
        <PhotoCropModal
          imageSrc={cropImageSrc}
          onCropDone={handleCroppedPhoto}
          onCancel={() => setCropImageSrc(null)}
        />
      )}
    </div>
  );
}
