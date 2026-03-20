import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Briefcase, MapPin, GraduationCap, Building2, Calendar,
  DollarSign, Clock, ArrowRight, ArrowLeft, Camera, CheckCircle2,
  Wrench, Upload, X, Globe, Navigation2, FileText, Loader2, Bell, BellOff
} from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { isPushSupported, getPermissionStatus, subscribeToPush } from '../utils/pushNotifications';
import axios from 'axios';
import PhotoCropModal from '../components/PhotoCropModal';
import LocationInput from '../components/LocationInput';
import { getPhotoUrl } from '../utils/helpers';
import LocationAutocomplete from '../components/LocationAutocomplete';
import useDocumentTitle from '../hooks/useDocumentTitle';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const STEPS = [
  { id: 'resume', title: 'Speed up your signup', subtitle: 'Upload a resume to autofill your profile' },
  { id: 'photo', title: 'Your Photo', subtitle: 'Add a professional photo' },
  { id: 'dob', title: 'Date of Birth', subtitle: 'We use this to verify your age' },
  { id: 'role', title: 'What do you do?', subtitle: 'Your current or desired role' },
  { id: 'experience', title: 'Experience', subtitle: 'How long have you been working?' },
  { id: 'employment', title: 'Work History', subtitle: 'Where have you worked?' },
  { id: 'education', title: 'Education', subtitle: 'Your educational background' },
  { id: 'skills', title: 'Skills', subtitle: 'What are you good at?' },
  { id: 'job_type', title: 'What type of work?', subtitle: 'Tell us what you\'re looking for' },
  { id: 'preferences', title: 'Preferences', subtitle: 'What are you looking for?' },
  { id: 'notifications', title: 'Stay in the Loop', subtitle: 'Never miss a match or message' },
];

export default function Onboarding() {
  useDocumentTitle('Get Started');
  const { user, token, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState(null);
  const fileInputRef = useRef(null);
  
  const [detectingLocation, setDetectingLocation] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [enablingNotifications, setEnablingNotifications] = useState(false);
  const [parsingResume, setParsingResume] = useState(false);
  const [resumeUploaded, setResumeUploaded] = useState(false);
  const resumeInputRef = useRef(null);

  // Structured data from resume parsing (saved directly to profile)
  const [resumeWorkHistory, setResumeWorkHistory] = useState([]);
  const [resumeEducation, setResumeEducation] = useState([]);
  const [resumeCertifications, setResumeCertifications] = useState([]);
  const [resumeBio, setResumeBio] = useState('');

  const [formData, setFormData] = useState({
    photo_url: '',
    dob: '',
    title: '',
    experience_years: '',
    current_employer: '',
    previous_employers: '',
    school: '',
    degree: '',
    skills: '',
    certifications: '',
    location: '',
    work_preference: 'flexible',
    desired_salary: '80000',
    available_immediately: true,
    job_type_preference: [],
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
            handleChange('location', locationStr);
            toast.success(`Location detected: ${locationStr}`);
          } else {
            toast.error('Could not determine your city. Please enter manually.');
          }
        } catch {
          toast.error('Failed to detect location. Please enter manually.');
        } finally {
          setDetectingLocation(false);
        }
      },
      () => {
        toast.error('Location access denied. Please enter your location manually.');
        setDetectingLocation(false);
      },
      { timeout: 10000 }
    );
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

      // Autofill flat form fields from parsed resume
      setFormData(prev => ({
        ...prev,
        title: parsed.title || prev.title,
        skills: parsed.skills?.length > 0 ? parsed.skills.join(', ') : prev.skills,
        certifications: parsed.certifications?.length > 0 ? parsed.certifications.join(', ') : prev.certifications,
        current_employer: parsed.work_history?.[0]?.company || prev.current_employer,
        previous_employers: parsed.work_history?.slice(1).map(w => w.company).filter(Boolean).join(', ') || prev.previous_employers,
        school: parsed.education?.[0]?.school || prev.school,
        degree: prev.degree, // Keep dropdown selection — mapped below
        location: parsed.location || prev.location,
        experience_years: parsed.experience_years ? String(parsed.experience_years) : prev.experience_years,
      }));

      // Store structured arrays for saving to profile
      if (parsed.work_history?.length > 0) {
        setResumeWorkHistory(parsed.work_history);
      }
      if (parsed.education?.length > 0) {
        setResumeEducation(parsed.education);
      }
      if (parsed.certifications?.length > 0) {
        setResumeCertifications(parsed.certifications);
      }
      if (parsed.bio) {
        setResumeBio(parsed.bio);
      }

      // Map experience_years to nearest select option
      if (parsed.experience_years) {
        const years = parseInt(parsed.experience_years);
        let mappedYears;
        if (years <= 0) mappedYears = '0';
        else if (years <= 1) mappedYears = '1';
        else if (years <= 2) mappedYears = '2';
        else if (years <= 3) mappedYears = '3';
        else if (years <= 7) mappedYears = '5';
        else if (years <= 12) mappedYears = '10';
        else mappedYears = '15';
        setFormData(prev => ({ ...prev, experience_years: mappedYears }));
      }

      // Try to map degree to dropdown value
      if (parsed.education?.[0]?.degree) {
        const degreeText = parsed.education[0].degree.toLowerCase();
        const degreeMap = {
          'high school': 'high_school',
          'associate': 'associates',
          'bachelor': 'bachelors', 'b.s': 'bachelors', 'b.a': 'bachelors', 'bs': 'bachelors', 'ba': 'bachelors', 'b.sc': 'bachelors',
          'master': 'masters', 'm.s': 'masters', 'm.a': 'masters', 'ms': 'masters', 'ma': 'masters', 'mba': 'masters', 'm.b.a': 'masters', 'm.sc': 'masters',
          'ph.d': 'phd', 'phd': 'phd', 'doctor': 'phd',
          'bootcamp': 'bootcamp', 'certificate': 'bootcamp',
        };
        for (const [key, value] of Object.entries(degreeMap)) {
          if (degreeText.includes(key)) {
            setFormData(prev => ({ ...prev, degree: value }));
            break;
          }
        }
      }

      setResumeUploaded(true);
      toast.success('Resume parsed! Your details have been filled in.');
      // Auto-advance to next step
      setCurrentStep(1);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to parse resume');
    } finally {
      setParsingResume(false);
    }
  };

  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

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

      setFormData(prev => ({ ...prev, photo_url: response.data.photo_url }));
      toast.success('Photo uploaded!');
    } catch (error) {
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const nextStep = () => {
    // Require photo on the photo step
    if (STEPS[currentStep]?.id === 'photo' && !formData.photo_url) {
      toast.error('Please upload a photo to continue. Recruiters need to see you!');
      return;
    }
    // Age verification on the DOB step (required)
    if (STEPS[currentStep]?.id === 'dob') {
      if (!formData.dob) {
        toast.error('Please enter your date of birth to continue');
        return;
      }
      const dob = new Date(formData.dob);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
      if (age < 16) {
        toast.error('You must be at least 16 years old to use Hireabble');
        return;
      }
    }
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const updates = {
        photo_url: formData.photo_url || null,
        date_of_birth: formData.dob || null,
        title: formData.title || null,
        bio: resumeBio || null,
        experience_years: formData.experience_years ? parseInt(formData.experience_years) : null,
        current_employer: formData.current_employer || null,
        previous_employers: formData.previous_employers ? formData.previous_employers.split(',').map(e => e.trim()).filter(Boolean) : [],
        school: formData.school || null,
        degree: formData.degree || null,
        skills: formData.skills ? formData.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
        certifications: resumeCertifications.length > 0
          ? resumeCertifications
          : formData.certifications ? formData.certifications.split(',').map(c => c.trim()).filter(Boolean) : [],
        location: formData.location || null,
        work_preference: formData.work_preference,
        desired_salary: formData.desired_salary ? parseInt(formData.desired_salary) : null,
        available_immediately: formData.available_immediately,
        job_type_preference: formData.job_type_preference || [],
        onboarding_complete: true,
        // Structured data from resume parsing
        work_history: resumeWorkHistory.length > 0 ? resumeWorkHistory : [],
        education: resumeEducation.length > 0 ? resumeEducation : [],
      };
      
      await updateProfile(updates);
      toast.success('Profile complete! Start swiping!');
      navigate('/dashboard');
    } catch (error) {
      toast.error('Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = async () => {
    // Require at minimum a photo and name before allowing skip
    // (App Store Guideline 2.1 - app must be functional, not appear broken)
    if (!formData.photo_url) {
      toast.error('Please upload a profile photo before continuing.');
      const photoIdx = STEPS.findIndex(s => s.id === 'photo');
      if (photoIdx >= 0) setCurrentStep(photoIdx);
      return;
    }
    if (!formData.title?.trim()) {
      toast.error('Please add your job title before continuing.');
      const roleIdx = STEPS.findIndex(s => s.id === 'role');
      if (roleIdx >= 0) setCurrentStep(roleIdx);
      return;
    }
    setLoading(true);
    try {
      await updateProfile({ onboarding_complete: true });
      navigate('/dashboard');
    } catch (error) {
      toast.error('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const step = STEPS[currentStep];
  const progress = ((currentStep + 1) / STEPS.length) * 100;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 sm:w-96 sm:h-96 bg-secondary/20 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm text-muted-foreground">
            {STEPS[currentStep]?.title}
          </div>
          {STEPS[currentStep]?.id !== 'photo' && (
            <button
              onClick={handleSkip}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              data-testid="skip-onboarding"
            >
              Skip for now
            </button>
          )}
        </div>
        
        {/* Progress Bar */}
        <div className="h-1 bg-accent rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-gradient-to-r from-primary to-secondary"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 relative z-10 px-6 py-8 flex flex-col">
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
          <AnimatePresence mode="wait">
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="flex-1"
            >
              <div className="mb-8">
                <h1 className="text-2xl md:text-3xl font-bold font-['Outfit'] mb-2">{step.title}</h1>
                <p className="text-muted-foreground">{step.subtitle}</p>
              </div>

              {/* Step Content */}
              {step.id === 'resume' && (
                <div className="space-y-6">
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center mb-6">
                      <FileText className="w-10 h-10 text-primary" />
                    </div>
                    {resumeUploaded ? (
                      <div className="w-full p-4 rounded-xl bg-success/10 border border-success/20 text-center mb-4">
                        <CheckCircle2 className="w-8 h-8 text-success mx-auto mb-2" />
                        <p className="text-sm font-medium text-success">Resume uploaded & parsed!</p>
                        <p className="text-xs text-muted-foreground mt-1">Your details have been filled in. Review them in the next steps.</p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center mb-4">
                        Already have a resume? Upload it and we'll fill in your details automatically.
                      </p>
                    )}
                  </div>

                  <input
                    ref={resumeInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    onChange={handleResumeUpload}
                    className="hidden"
                    data-testid="resume-file-input"
                  />

                  <Button
                    type="button"
                    onClick={() => resumeInputRef.current?.click()}
                    disabled={parsingResume}
                    className="w-full h-14 rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-base"
                    data-testid="upload-resume-btn"
                  >
                    {parsingResume ? (
                      <>
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        Reading your experience...
                      </>
                    ) : (
                      <>
                        <Upload className="w-5 h-5 mr-2" />
                        Upload Resume (PDF or Word)
                      </>
                    )}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">or</span>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setCurrentStep(1)}
                    className="w-full h-12 rounded-xl"
                    data-testid="no-resume-btn"
                  >
                    I don't have a resume right now
                  </Button>

                  <p className="text-xs text-muted-foreground text-center">
                    No worries — you can fill in your details manually or upload a resume later from your profile.
                  </p>
                </div>
              )}

              {step.id === 'photo' && (
                <div className="space-y-6">
                  <div className="flex flex-col items-center">
                    <div className="relative mb-4">
                      {formData.photo_url ? (
                        <div className="relative">
                          <img 
                            src={getPhotoUrl(formData.photo_url)} 
                            alt="Profile"
                            className="w-32 h-32 rounded-full object-cover border-4 border-primary"
                          />
                          <button
                            onClick={() => setFormData(prev => ({ ...prev, photo_url: '' }))}
                            className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-destructive flex items-center justify-center"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>
                        </div>
                      ) : (
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          className="w-32 h-32 rounded-full bg-accent border-4 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/50 transition-colors"
                        >
                          {uploadingPhoto ? (
                            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                          ) : (
                            <Camera className="w-10 h-10 text-muted-foreground" />
                          )}
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground text-center mb-2">
                      This photo will be shown to recruiters when they browse candidates
                    </p>
                    <div className="text-xs text-muted-foreground text-center space-y-1 mb-4">
                      <p>Use a professional, well-lit headshot with a clean background.</p>
                      <p>Vertical photos work best. Smile and look approachable!</p>
                    </div>
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    className="hidden"
                    data-testid="photo-file-input"
                  />
                  
                  {!formData.photo_url && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingPhoto}
                      className="w-full h-12 rounded-xl"
                      data-testid="upload-photo-btn"
                    >
                      <Upload className="w-5 h-5 mr-2" />
                      {uploadingPhoto ? 'Uploading...' : 'Upload Photo'}
                    </Button>
                  )}
                </div>
              )}

              {step.id === 'dob' && (() => {
                const currentYear = new Date().getFullYear();
                const dobParts = formData.dob ? formData.dob.split('-') : ['', '', ''];
                const dobYear = dobParts[0] || '';
                const dobMonth = dobParts[1] || '';
                const dobDay = dobParts[2] || '';
                const updateDob = (part, value) => {
                  const parts = formData.dob ? formData.dob.split('-') : ['', '', ''];
                  if (part === 'year') parts[0] = value;
                  if (part === 'month') parts[1] = value;
                  if (part === 'day') parts[2] = value;
                  if (parts[0] && parts[1] && parts[2]) {
                    handleChange('dob', `${parts[0]}-${parts[1]}-${parts[2]}`);
                  } else {
                    handleChange('dob', parts.join('-'));
                  }
                };
                const daysInMonth = dobYear && dobMonth
                  ? new Date(parseInt(dobYear), parseInt(dobMonth), 0).getDate()
                  : 31;
                return (
                  <div className="space-y-6">
                    <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-4">
                      <Calendar className="w-8 h-8 text-primary" />
                    </div>
                    <div className="space-y-3">
                      <Label>When were you born?</Label>
                      <div className="grid grid-cols-3 gap-3">
                        <select
                          value={dobMonth}
                          onChange={(e) => updateDob('month', e.target.value)}
                          className="h-12 rounded-xl bg-card border border-border px-3 text-sm text-foreground appearance-none"
                          data-testid="dob-month"
                        >
                          <option value="">Month</option>
                          {['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'].map((m, i) => (
                            <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                          ))}
                        </select>
                        <select
                          value={dobDay}
                          onChange={(e) => updateDob('day', e.target.value)}
                          className="h-12 rounded-xl bg-card border border-border px-3 text-sm text-foreground appearance-none"
                          data-testid="dob-day"
                        >
                          <option value="">Day</option>
                          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => (
                            <option key={d} value={String(d).padStart(2, '0')}>{d}</option>
                          ))}
                        </select>
                        <select
                          value={dobYear}
                          onChange={(e) => updateDob('year', e.target.value)}
                          className="h-12 rounded-xl bg-card border border-border px-3 text-sm text-foreground appearance-none"
                          data-testid="dob-year"
                        >
                          <option value="">Year</option>
                          {Array.from({ length: 80 }, (_, i) => currentYear - 16 - i).map(y => (
                            <option key={y} value={String(y)}>{y}</option>
                          ))}
                        </select>
                      </div>
                      <p className="text-xs text-muted-foreground">Required. You must be at least 16 years old to use Hireabble.</p>
                    </div>
                  </div>
                );
              })()}

              {step.id === 'role' && (
                <div className="space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mb-4">
                    <Briefcase className="w-8 h-8 text-primary" />
                  </div>
                  <div className="space-y-2">
                    <Label>What's your job title?</Label>
                    <Input
                      placeholder="e.g., IT Specialist, Marketing Manager, Software Engineer"
                      value={formData.title}
                      onChange={(e) => handleChange('title', e.target.value)}
                      className="h-12 rounded-xl bg-card border-border"
                      data-testid="title-input"
                    />
                    <p className="text-xs text-muted-foreground">This is what recruiters will see first</p>
                  </div>
                </div>
              )}

              {step.id === 'experience' && (
                <div className="space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-secondary/20 flex items-center justify-center mb-4">
                    <Clock className="w-8 h-8 text-secondary" />
                  </div>
                  <div className="space-y-2">
                    <Label>Years of experience</Label>
                    <Select 
                      value={formData.experience_years} 
                      onValueChange={(v) => handleChange('experience_years', v)}
                    >
                      <SelectTrigger className="h-12 rounded-xl bg-card" data-testid="experience-select">
                        <SelectValue placeholder="Select your experience level" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Just starting out (0 years)</SelectItem>
                        <SelectItem value="1">1 year</SelectItem>
                        <SelectItem value="2">2 years</SelectItem>
                        <SelectItem value="3">3 years</SelectItem>
                        <SelectItem value="5">5+ years</SelectItem>
                        <SelectItem value="10">10+ years</SelectItem>
                        <SelectItem value="15">15+ years</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {step.id === 'employment' && (
                <div className="space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-success/20 flex items-center justify-center mb-4">
                    <Building2 className="w-8 h-8 text-success" />
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Where do you currently work?</Label>
                      <Input
                        placeholder="e.g., Google, Freelance, Currently looking"
                        value={formData.current_employer}
                        onChange={(e) => handleChange('current_employer', e.target.value)}
                        className="h-12 rounded-xl bg-card border-border"
                        data-testid="current-employer-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Previous employers (optional)</Label>
                      <Input
                        placeholder="e.g., Microsoft, Amazon, Startup Inc."
                        value={formData.previous_employers}
                        onChange={(e) => handleChange('previous_employers', e.target.value)}
                        className="h-12 rounded-xl bg-card border-border"
                        data-testid="previous-employers-input"
                      />
                      <p className="text-xs text-muted-foreground">Separate with commas</p>
                    </div>
                  </div>
                </div>
              )}

              {step.id === 'education' && (
                <div className="space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-pink-500/20 flex items-center justify-center mb-4">
                    <GraduationCap className="w-8 h-8 text-pink-500" />
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Where did you go to school?</Label>
                      <Input
                        placeholder="e.g., MIT, UCLA, Self-taught"
                        value={formData.school}
                        onChange={(e) => handleChange('school', e.target.value)}
                        className="h-12 rounded-xl bg-card border-border"
                        data-testid="school-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Do you have a degree?</Label>
                      <Select 
                        value={formData.degree} 
                        onValueChange={(v) => handleChange('degree', v)}
                      >
                        <SelectTrigger className="h-12 rounded-xl bg-card" data-testid="degree-select">
                          <SelectValue placeholder="Select your education level" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high_school">High School</SelectItem>
                          <SelectItem value="some_college">Some College</SelectItem>
                          <SelectItem value="associates">Associate's Degree</SelectItem>
                          <SelectItem value="bachelors">Bachelor's Degree</SelectItem>
                          <SelectItem value="masters">Master's Degree</SelectItem>
                          <SelectItem value="phd">PhD / Doctorate</SelectItem>
                          <SelectItem value="bootcamp">Bootcamp / Certification</SelectItem>
                          <SelectItem value="self_taught">Self-taught</SelectItem>
                          <SelectItem value="no_degree">No formal degree</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {step.id === 'skills' && (
                <div className="space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-orange-500/20 flex items-center justify-center mb-4">
                    <Wrench className="w-8 h-8 text-orange-500" />
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>What are your top skills?</Label>
                      <Input
                        placeholder="e.g., JavaScript, Project Management, Sales"
                        value={formData.skills}
                        onChange={(e) => handleChange('skills', e.target.value)}
                        className="h-12 rounded-xl bg-card border-border"
                        data-testid="skills-input"
                      />
                      <p className="text-xs text-muted-foreground">Separate with commas</p>
                    </div>
                    <div className="space-y-2">
                      <Label>Any certifications? (optional)</Label>
                      <Input
                        placeholder="e.g., AWS Certified, PMP, Google Analytics"
                        value={formData.certifications}
                        onChange={(e) => handleChange('certifications', e.target.value)}
                        className="h-12 rounded-xl bg-card border-border"
                        data-testid="certifications-input"
                      />
                    </div>
                  </div>
                </div>
              )}

              {step.id === 'job_type' && (
                <div className="space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-4">
                    <Briefcase className="w-8 h-8 text-purple-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">Select all that apply</p>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'full-time', label: 'Full-time', icon: '💼' },
                      { value: 'part-time', label: 'Part-time', icon: '⏰' },
                      { value: 'contract', label: 'Contract', icon: '📝' },
                      { value: 'remote', label: 'Remote', icon: '🏠' },
                      { value: 'internship', label: 'Internship', icon: '🎓' },
                      { value: 'flexible', label: 'Flexible', icon: '✨' },
                    ].map(option => {
                      const selected = (formData.job_type_preference || []).includes(option.value);
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => {
                            const current = formData.job_type_preference || [];
                            const updated = selected
                              ? current.filter(v => v !== option.value)
                              : [...current, option.value];
                            handleChange('job_type_preference', updated);
                          }}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            selected
                              ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
                              : 'border-border hover:border-primary/30'
                          }`}
                        >
                          <span className="text-2xl mb-2 block">{option.icon}</span>
                          <span className={`font-medium ${selected ? 'text-primary' : ''}`}>{option.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                    <p className="text-sm text-primary font-medium">Complete your profile to match with more businesses!</p>
                    <p className="text-xs text-muted-foreground mt-1">The more details you add, the better your matches will be.</p>
                  </div>
                </div>
              )}

              {step.id === 'preferences' && (
                <div className="space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8 text-cyan-500" />
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Where are you located?
                      </Label>
                      <LocationAutocomplete
                        value={formData.location}
                        onChange={(val) => handleChange('location', val)}
                        placeholder="Start typing your city..."
                        showDetectButton
                        data-testid="location-input"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Work preference</Label>
                      <Select 
                        value={formData.work_preference} 
                        onValueChange={(v) => handleChange('work_preference', v)}
                      >
                        <SelectTrigger className="h-12 rounded-xl bg-card" data-testid="work-pref-select">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="remote">Remote</SelectItem>
                          <SelectItem value="onsite">On-site</SelectItem>
                          <SelectItem value="hybrid">Hybrid</SelectItem>
                          <SelectItem value="flexible">Flexible / Open to all</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Desired salary (annual, optional)</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          type="number"
                          placeholder="75000"
                          value={formData.desired_salary}
                          onChange={(e) => handleChange('desired_salary', e.target.value)}
                          className="pl-12 h-12 rounded-xl bg-card border-border"
                          data-testid="salary-input"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
                      <input
                        type="checkbox"
                        id="available"
                        checked={formData.available_immediately}
                        onChange={(e) => handleChange('available_immediately', e.target.checked)}
                        className="w-5 h-5 rounded border-border"
                        data-testid="available-checkbox"
                      />
                      <label htmlFor="available" className="text-sm cursor-pointer">
                        I'm available to start immediately
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {STEPS[currentStep]?.id === 'notifications' && (
                <div className="space-y-6">
                  <div className="text-center py-4">
                    <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                      {notificationsEnabled ? (
                        <Bell className="w-10 h-10 text-primary" />
                      ) : (
                        <BellOff className="w-10 h-10 text-muted-foreground" />
                      )}
                    </div>
                    {notificationsEnabled ? (
                      <>
                        <h3 className="text-lg font-semibold text-foreground mb-2">Notifications Enabled!</h3>
                        <p className="text-sm text-muted-foreground">You'll be notified about new matches and messages.</p>
                      </>
                    ) : getPermissionStatus() === 'denied' ? (
                      <>
                        <h3 className="text-lg font-semibold text-foreground mb-2">Notifications Blocked</h3>
                        <p className="text-sm text-muted-foreground">You've blocked notifications. You can enable them later in your device settings.</p>
                      </>
                    ) : (
                      <>
                        <h3 className="text-lg font-semibold text-foreground mb-2">Don't miss your next match</h3>
                        <p className="text-sm text-muted-foreground">Get instant alerts when a recruiter likes you back, sends a message, or schedules an interview.</p>
                      </>
                    )}
                  </div>

                  {!notificationsEnabled && getPermissionStatus() !== 'denied' && (
                    <Button
                      onClick={async () => {
                        if (!isPushSupported()) {
                          toast.error('Push notifications are not supported on this device/browser. You can enable them later.');
                          return;
                        }
                        setEnablingNotifications(true);
                        const success = await subscribeToPush(token);
                        setNotificationsEnabled(success);
                        setEnablingNotifications(false);
                        if (success) {
                          toast.success('Notifications enabled!');
                        } else if (getPermissionStatus() === 'denied') {
                          toast.error('Notifications were blocked. You can enable them in your browser/device settings.');
                        } else {
                          toast.error('Could not enable notifications. You can try again later in Settings.');
                        }
                      }}
                      disabled={enablingNotifications}
                      className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                      data-testid="enable-notifications-btn"
                    >
                      {enablingNotifications ? (
                        <Loader2 className="w-5 h-5 animate-spin mr-2" />
                      ) : (
                        <Bell className="w-5 h-5 mr-2" />
                      )}
                      Enable Notifications
                    </Button>
                  )}

                  <div className="space-y-3 bg-card rounded-xl p-4 border border-border">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">New Matches</p>
                        <p className="text-xs text-muted-foreground">Know instantly when a recruiter swipes right on you</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4 text-blue-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Messages</p>
                        <p className="text-xs text-muted-foreground">Never miss a message from a recruiter</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 className="w-4 h-4 text-purple-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">Interviews</p>
                        <p className="text-xs text-muted-foreground">Get reminded about upcoming interviews</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex gap-4 mt-8">
            {currentStep > 0 && (
              <Button
                variant="outline"
                onClick={prevStep}
                className="flex-1 h-12 rounded-xl"
                data-testid="prev-step-btn"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
            )}
            
            {currentStep < STEPS.length - 1 ? (
              <Button
                onClick={nextStep}
                className="flex-1 h-12 rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                data-testid="next-step-btn"
              >
                Continue
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            ) : (
              <Button
                onClick={handleComplete}
                disabled={loading}
                className="flex-1 h-12 rounded-xl bg-gradient-to-r from-primary to-secondary hover:opacity-90"
                data-testid="complete-btn"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Complete Profile
                    <CheckCircle2 className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </main>

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
