# Hireabble - Job Matching Made Simple

## Original Problem Statement
Build a Tinder-like app for job applications called "Hireabble" where both job seekers AND recruiters can use the platform with mutual matching.

## User Personas
1. **Job Seeker**: Looking for quick, engaging job discovery
2. **Recruiter**: Seeking efficient candidate matching

## Architecture
- **Frontend**: React 19 with framer-motion, Tailwind CSS, Shadcn/UI
- **Backend**: FastAPI with async MongoDB (Motor)
- **Database**: MongoDB (users, jobs, applications, matches, messages)
- **Real-time**: WebSocket for messaging
- **Auth**: JWT tokens with bcrypt
- **File Storage**: Local /uploads for photos
- **PDF Generation**: reportlab

## What's Been Implemented (January 2026)

### Phase 1 - MVP ✓
- Rebranding to "Hireabble"
- Landing page, auth, onboarding
- Swipe interface with framer-motion
- Mutual matching system

### Phase 2 - Enhancements ✓
- Photo upload (file + URL)
- In-app messaging (polling)
- Job filters
- Job editing for recruiters
- Candidate detail modal

### Phase 3 - Advanced Features ✓
- **WebSocket Real-time Chat**: Instant message delivery with connection status indicator
- **Email Notifications**: Match alerts and new message notifications (requires RESEND_API_KEY)
- **Resume PDF Export**: Professional PDF generation with all profile data
- **Quick Apply Badge**: Shows when profile is 80%+ complete, indicates "profile ready" status
- **Profile Completeness Tracker**: Percentage display with missing fields hints

### Phase 4 - Account Security (March 2026) ✓
- **Forgot Password Flow**: Complete password reset via email
  - `/forgot-password` page: Email input form with success state
  - `/reset-password` page: Token validation and new password form
  - Token expires in 1 hour for security
  - Invalid/expired token error handling
  - Email notifications via SendGrid (optional - requires RESEND_API_KEY)

## API Endpoints

### Auth
- POST /api/auth/register
- POST /api/auth/login
- GET /api/auth/me
- PUT /api/auth/profile
- POST /api/auth/forgot-password (new)
- POST /api/auth/reset-password (new)

### Jobs
- POST /api/jobs
- GET /api/jobs (with filters)
- GET /api/jobs/recruiter
- PUT /api/jobs/{id}
- DELETE /api/jobs/{id}

### Applications & Matching
- POST /api/swipe
- GET /api/applications
- POST /api/applications/respond
- GET /api/matches

### Messaging
- POST /api/messages
- GET /api/messages/{match_id}
- GET /api/messages/unread/count
- WS /ws/{token} (WebSocket)

### Profile
- GET /api/profile/completeness
- GET /api/resume/download
- POST /api/upload/photo

## Environment Variables
- MONGO_URL (required)
- DB_NAME (required)
- JWT_SECRET (optional)
- RESEND_API_KEY (optional - for email notifications)
- SENDER_EMAIL (optional - defaults to onboarding@resend.dev)

## Prioritized Backlog

### P0 (Critical) - All Done ✓

### P1 (High Priority)
- [ ] Push notifications (mobile web)
- [ ] Video intro feature for candidates
- [ ] Interview scheduling integration

### P2 (Medium Priority)
- [ ] Advanced search with AI matching
- [ ] Company verification badges
- [ ] Saved/bookmarked jobs

### P3 (Low Priority)
- [ ] Analytics dashboard for recruiters
- [ ] Social sharing
- [ ] Referral system
