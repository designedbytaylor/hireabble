# JobSwipe - Tinder for Jobs

## Original Problem Statement
Build a Tinder-like app for job applications where both job seekers AND recruiters can use the platform with mutual matching.

## User Personas
1. **Job Seeker**: Looking for quick, engaging job discovery through swipe-based interaction
2. **Recruiter**: Seeking efficient candidate matching and job posting capabilities

## Core Requirements
- Swipe right = Apply, Swipe left = Skip, Swipe up = Super Like (priority application)
- Mutual matching system (match occurs when recruiter accepts application)
- Job posting by recruiters
- JWT-based authentication with role selection

## Architecture
- **Frontend**: React 19 with framer-motion for swipe physics, Tailwind CSS, Shadcn/UI components
- **Backend**: FastAPI with async MongoDB (Motor)
- **Database**: MongoDB with collections: users, jobs, applications, matches
- **Auth**: JWT tokens with bcrypt password hashing

## What's Been Implemented (January 2026)
- [x] Landing page with neon noir design theme
- [x] User registration with role selection (seeker/recruiter)
- [x] User login with JWT authentication
- [x] Job Seeker Dashboard with swipe cards (framer-motion)
- [x] Recruiter Dashboard with bento grid layout
- [x] Job posting functionality
- [x] Swipe actions (like, pass, superlike)
- [x] Recruiter accept/reject applications
- [x] Mutual matching system
- [x] Matches page for both roles
- [x] Profile editing
- [x] Glass-morphism navigation bar

## API Endpoints
- POST /api/auth/register - User registration
- POST /api/auth/login - User login
- GET /api/auth/me - Get current user
- PUT /api/auth/profile - Update profile
- POST /api/jobs - Create job (recruiter)
- GET /api/jobs - Get swipeable jobs (seeker)
- GET /api/jobs/recruiter - Get recruiter's jobs
- POST /api/swipe - Submit swipe action
- GET /api/applications - Get applications
- POST /api/applications/respond - Accept/reject application
- GET /api/matches - Get user matches
- GET /api/stats/seeker - Seeker statistics
- GET /api/stats/recruiter - Recruiter statistics

## Prioritized Backlog
### P0 (Critical)
- All core features implemented ✓

### P1 (High Priority)
- [ ] Real-time notifications for matches
- [ ] In-app messaging between matched users
- [ ] Email notifications

### P2 (Medium Priority)
- [ ] Advanced job filters (salary, location, job type)
- [ ] Resume/CV upload for seekers
- [ ] Company verification for recruiters
- [ ] Job search functionality

### P3 (Low Priority)
- [ ] Analytics dashboard for recruiters
- [ ] Skill assessment integration
- [ ] Interview scheduling
- [ ] Social sharing features
