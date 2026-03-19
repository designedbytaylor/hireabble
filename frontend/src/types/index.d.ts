// Shared type definitions for Hireabble

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'seeker' | 'recruiter';
  company?: string;
  title?: string;
  bio?: string;
  skills: string[];
  experience_years?: number;
  location?: string;
  avatar?: string;
  photo_url?: string;
  video_url?: string;
  current_employer?: string;
  previous_employers: string[];
  school?: string;
  degree?: string;
  certifications: string[];
  work_preference?: string;
  desired_salary?: number;
  available_immediately: boolean;
  onboarding_complete: boolean;
  email_verified: boolean;
  push_subscription?: object;
  subscription?: Subscription;
  totp_enabled?: boolean;
  created_at: string;
}

export interface Subscription {
  status: 'active' | 'cancelled' | 'expired';
  tier_id: string;
  period_end: string;
  cancel_at_period_end?: boolean;
  cancelled_at?: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  description: string;
  requirements: string[];
  salary_min?: number;
  salary_max?: number;
  location: string;
  job_type: 'remote' | 'onsite' | 'hybrid';
  experience_level: 'entry' | 'mid' | 'senior' | 'lead';
  recruiter_id: string;
  recruiter_name: string;
  company_logo?: string;
  background_image?: string;
  category?: string;
  employment_type?: string;
  listing_photo?: string;
  match_score?: number;
  is_active: boolean;
  is_boosted?: boolean;
  created_at: string;
}

export interface Match {
  id: string;
  job_id: string;
  job_title: string;
  company: string;
  seeker_id: string;
  seeker_name: string;
  seeker_avatar?: string;
  seeker_photo?: string;
  recruiter_id: string;
  recruiter_name: string;
  recruiter_avatar?: string;
  recruiter_photo?: string;
  created_at: string;
  last_message?: string;
  last_message_sender?: string;
  last_message_at?: string;
  unread_count?: number;
}

export interface Message {
  id: string;
  match_id: string;
  sender_id: string;
  sender_name: string;
  sender_avatar?: string;
  content: string;
  created_at: string;
  is_read: boolean;
  message_type?: string;
  data?: Record<string, unknown>;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

export interface Interview {
  id: string;
  match_id: string;
  requester_id: string;
  recipient_id: string;
  proposed_times: string[];
  confirmed_time?: string;
  status: 'pending' | 'accepted' | 'declined' | 'rescheduled' | 'cancelled';
  notes?: string;
  created_at: string;
}
