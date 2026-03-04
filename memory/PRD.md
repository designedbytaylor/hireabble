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
- In-app messaging for matched users
- Job filters for seekers

## Architecture
- **Frontend**: React 19 with framer-motion for swipe physics, Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI with async MongoDB (Motor)
- **Database**: MongoDB (users, jobs, applications, matches, messages)
- **Auth**: JWT tokens with bcrypt password hashing
- **File Storage**: Local /uploads directory for photos

## What's Been Implemented (January 2026)
### Phase 1 - MVP
- [x] Rebranding to "Hireabble"
- [x] Landing page with updated messaging
- [x] Frictionless signup (just name, email, password, role)
- [x] Step-by-step onboarding for job seekers
- [x] Swipe interface with framer-motion
- [x] Mutual matching system

### Phase 2 - Enhancements
- [x] **Photo Upload**: File upload to /uploads + URL paste option
- [x] **In-app Messaging**: Real-time chat between matched users (polling every 3s)
- [x] **Job Filters**: Filter by job type, experience level, salary, location
- [x] Job editing functionality for recruiters
- [x] Candidate detail modal with full profile
- [x] Unread message count indicator

## API Endpoints
### Auth
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- PUT /api/auth/profile

### Jobs
- POST /api/jobs - Create job
- GET /api/jobs - Get jobs with filters (?job_type=&experience_level=&salary_min=&location=)
- GET /api/jobs/recruiter - Get recruiter's jobs
- PUT /api/jobs/{id} - Edit job
- DELETE /api/jobs/{id} - Delete job

### Applications & Matching
- POST /api/swipe - Submit swipe
- GET /api/applications - Get applications
- POST /api/applications/respond - Accept/reject
- GET /api/matches - Get matches

### Messaging (NEW)
- POST /api/messages - Send message
- GET /api/messages/{match_id} - Get conversation
- GET /api/messages/unread/count - Get unread count

### Files (NEW)
- POST /api/upload/photo - Upload profile photo

## Prioritized Backlog
### P0 (Critical) - All Done ✓

### P1 (High Priority)
- [ ] Real-time messaging with WebSockets (currently polling)
- [ ] Email notifications for new matches
- [ ] Push notifications (mobile web)

### P2 (Medium Priority)
- [ ] Resume PDF export
- [ ] Company verification badges
- [ ] Advanced search (keyword, skills matching)
- [ ] Save/bookmark jobs for later

### P3 (Low Priority)
- [ ] Analytics dashboard for recruiters
- [ ] Interview scheduling integration
- [ ] Video intro feature
- [ ] Social sharing
