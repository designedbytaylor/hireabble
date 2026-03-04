import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, Briefcase, MapPin, GraduationCap, Building2, 
  DollarSign, Clock, ArrowRight, ArrowLeft, Camera, CheckCircle2,
  Wrench, Upload, X
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
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const STEPS = [
  { id: 'photo', title: 'Your Photo', subtitle: 'Add a professional photo' },
  { id: 'role', title: 'What do you do?', subtitle: 'Your current or desired role' },
  { id: 'experience', title: 'Experience', subtitle: 'How long have you been working?' },
  { id: 'employment', title: 'Work History', subtitle: 'Where have you worked?' },
  { id: 'education', title: 'Education', subtitle: 'Your educational background' },
  { id: 'skills', title: 'Skills', subtitle: 'What are you good at?' },
  { id: 'preferences', title: 'Preferences', subtitle: 'What are you looking for?' },
];

export default function Onboarding() {
  const { user, token, updateProfile } = useAuth();
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    photo_url: '',
    title: '',
    experience_years: '',
    current_employer: '',
    previous_employers: '',
    school: '',
    degree: '',
    skills: '',
    certifications: '',
    location: '',
    work_preference: 'remote',
    desired_salary: '',
    available_immediately: true,
  });

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploadingPhoto(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const response = await axios.post(`${API}/upload/photo`, formDataUpload, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      // The API returns the path, construct full URL
      const photoUrl = `${BACKEND_URL}${response.data.photo_url}`;
      setFormData(prev => ({ ...prev, photo_url: photoUrl }));
      toast.success('Photo uploaded!');
    } catch (error) {
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const nextStep = () => {
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
        title: formData.title || null,
        experience_years: formData.experience_years ? parseInt(formData.experience_years) : null,
        current_employer: formData.current_employer || null,
        previous_employers: formData.previous_employers ? formData.previous_employers.split(',').map(e => e.trim()).filter(Boolean) : [],
        school: formData.school || null,
        degree: formData.degree || null,
        skills: formData.skills ? formData.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
        certifications: formData.certifications ? formData.certifications.split(',').map(c => c.trim()).filter(Boolean) : [],
        location: formData.location || null,
        work_preference: formData.work_preference,
        desired_salary: formData.desired_salary ? parseInt(formData.desired_salary) : null,
        available_immediately: formData.available_immediately,
        onboarding_complete: true,
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
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-secondary/20 rounded-full blur-[120px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="text-sm text-muted-foreground">
            Step {currentStep + 1} of {STEPS.length}
          </div>
          <button 
            onClick={handleSkip}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="skip-onboarding"
          >
            Skip for now
          </button>
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
              {step.id === 'photo' && (
                <div className="space-y-6">
                  <div className="flex flex-col items-center">
                    <div className="relative mb-4">
                      {formData.photo_url ? (
                        <div className="relative">
                          <img 
                            src={formData.photo_url} 
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
                    <p className="text-sm text-muted-foreground text-center mb-4">
                      A professional photo helps recruiters connect with you
                    </p>
                  </div>
                  
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    data-testid="photo-file-input"
                  />
                  
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
                  
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">or paste URL</span>
                    </div>
                  </div>
                  
                  <Input
                    placeholder="https://example.com/your-photo.jpg"
                    value={formData.photo_url}
                    onChange={(e) => handleChange('photo_url', e.target.value)}
                    className="h-12 rounded-xl bg-card border-border"
                    data-testid="photo-url-input"
                  />
                </div>
              )}

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

              {step.id === 'preferences' && (
                <div className="space-y-6">
                  <div className="w-16 h-16 rounded-2xl bg-cyan-500/20 flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8 text-cyan-500" />
                  </div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Where are you located?</Label>
                      <Input
                        placeholder="e.g., New York, NY"
                        value={formData.location}
                        onChange={(e) => handleChange('location', e.target.value)}
                        className="h-12 rounded-xl bg-card border-border"
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
    </div>
  );
}
