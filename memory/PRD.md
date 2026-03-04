# Hireabble - Job Matching Made Simple

## Original Problem Statement
Build a Tinder-like app for job applications called "Hireabble" where both job seekers AND recruiters can use the platform with mutual matching. Make signup frictionless with a step-by-step resume builder after account creation.

## User Personas
1. **Job Seeker**: Looking for quick, engaging job discovery. Frustrated with Indeed's complexity.
2. **Recruiter**: Seeking efficient candidate matching and easy job posting/editing.

## Core Requirements
- Simple signup first, then step-by-step "quick resume" onboarding
- Swipe right = Apply, Swipe left = Skip, Swipe up = Super Like
- Mutual matching system (match occurs when recruiter accepts)
- Job posting AND editing by recruiters
- Candidate cards show: title, experience, education, photo

## Architecture
- **Frontend**: React 19 with framer-motion for swipe physics, Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI with async MongoDB (Motor)
- **Database**: MongoDB (users, jobs, applications, matches)
- **Auth**: JWT tokens with bcrypt password hashing

## What's Been Implemented (January 2026)
- [x] Rebranding to "Hireabble"
- [x] Landing page with updated messaging
- [x] Frictionless signup (just name, email, password, role)
- [x] Step-by-step onboarding for job seekers:
  - Photo URL upload
  - "What do you do?" (job title)
  - Years of experience
  - Work history (current & previous employers)
  - Education (school, degree)
  - Skills & certifications
  - Preferences (location, work type, salary)
- [x] Recruiters skip onboarding
- [x] Job posting functionality
- [x] Job editing functionality (edit button on each job)
- [x] Job deletion
- [x] Candidate cards show title, experience, education
- [x] Candidate detail modal with full profile
- [x] Swipe interface with framer-motion
- [x] Mutual matching system

## API Endpoints
- POST /api/auth/register - User registration
- POST /api/auth/login - User login
- GET /api/auth/me - Get current user
- PUT /api/auth/profile - Update profile (including onboarding data)
- POST /api/jobs - Create job
- GET /api/jobs - Get swipeable jobs
- GET /api/jobs/recruiter - Get recruiter's jobs
- PUT /api/jobs/{id} - Edit job posting (NEW)
- DELETE /api/jobs/{id} - Delete job
- POST /api/swipe - Submit swipe
- GET /api/applications - Get applications
- POST /api/applications/respond - Accept/reject
- GET /api/matches - Get matches

## Prioritized Backlog
### P0 (Critical) - All Done ✓

### P1 (High Priority)
- [ ] In-app messaging between matched users
- [ ] Real-time notifications for matches
- [ ] Actual photo upload (not just URL)

### P2 (Medium Priority)
- [ ] Job filters (salary, location, job type)
- [ ] Resume PDF export
- [ ] Company verification badges
- [ ] Email notifications

### P3 (Low Priority)
- [ ] Analytics dashboard for recruiters
- [ ] Interview scheduling
- [ ] Social sharing
