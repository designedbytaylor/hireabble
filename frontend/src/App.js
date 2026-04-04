import React, { Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AdminAuthProvider, useAdminAuth } from "./context/AdminAuthContext";
import { ThemeProvider } from "./context/ThemeContext";

import useCanonical from './hooks/useCanonical';

// Eager load only the landing/auth pages (first paint)
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";

const ImpersonationBanner = React.lazy(() => import("./components/ImpersonationBanner"));
const OfflineIndicator = React.lazy(() => import("./components/OfflineIndicator"));

// Lazy load everything else — each becomes its own JS chunk
const VerifyEmail = React.lazy(() => import("./pages/VerifyEmail"));
const Download = React.lazy(() => import("./pages/Download"));
const ForgotPassword = React.lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));
const Onboarding = React.lazy(() => import("./pages/Onboarding"));
const RecruiterOnboarding = React.lazy(() => import("./pages/RecruiterOnboarding"));
const SeekerDashboard = React.lazy(() => import("./pages/SeekerDashboard"));
const RecruiterDashboard = React.lazy(() => import("./pages/RecruiterDashboard"));
const RecruiterSwipe = React.lazy(() => import("./pages/RecruiterSwipe"));
const RecruiterSearch = React.lazy(() => import("./pages/RecruiterSearch"));
const Profile = React.lazy(() => import("./pages/Profile"));
const Matches = React.lazy(() => import("./pages/Matches"));
const Chat = React.lazy(() => import("./pages/Chat"));
const InterviewScheduler = React.lazy(() => import("./pages/InterviewScheduler"));
const RecruiterAnalytics = React.lazy(() => import("./pages/RecruiterAnalytics"));
const SeekerAnalytics = React.lazy(() => import("./pages/SeekerAnalytics"));
const AppliedJobs = React.lazy(() => import("./pages/AppliedJobs"));
const SavedJobs = React.lazy(() => import("./pages/SavedJobs"));
const SeekerSearch = React.lazy(() => import("./pages/SeekerSearch"));
// SearchJobs removed — search replaced by swipe filters on dashboard
const RecruiterApplications = React.lazy(() => import("./pages/RecruiterApplications"));
const Messages = React.lazy(() => import("./pages/Messages"));
const Upgrade = React.lazy(() => import("./pages/Upgrade"));
const ProfileViewers = React.lazy(() => import("./pages/ProfileViewers"));
const CompanyJobs = React.lazy(() => import("./pages/CompanyJobs"));
const Impersonate = React.lazy(() => import("./pages/Impersonate"));
const SkillQuiz = React.lazy(() => import("./pages/SkillQuiz"));
const BrowseJobs = React.lazy(() => import("./pages/BrowseJobs"));
const PublicJobDetail = React.lazy(() => import("./pages/PublicJobDetail"));
const TermsOfService = React.lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = React.lazy(() => import("./pages/PrivacyPolicy"));
const CookiePolicy = React.lazy(() => import("./pages/CookiePolicy"));
const CommunityGuidelines = React.lazy(() => import("./pages/CommunityGuidelines"));

// Free marketing tools — public, no auth
const ToolsIndex = React.lazy(() => import("./pages/tools/ToolsIndex"));
const ResumeBuilder = React.lazy(() => import("./pages/tools/ResumeBuilder"));
const ResumeScore = React.lazy(() => import("./pages/tools/ResumeScore"));
const CoverLetterGenerator = React.lazy(() => import("./pages/tools/CoverLetterGenerator"));
const SalaryCalculator = React.lazy(() => import("./pages/tools/SalaryCalculator"));
const InterviewPrep = React.lazy(() => import("./pages/tools/InterviewPrep"));
const JobTracker = React.lazy(() => import("./pages/tools/JobTracker"));
const SkillsGap = React.lazy(() => import("./pages/tools/SkillsGap"));
const TypingTuneUp = React.lazy(() => import("./pages/tools/TypingTuneUp"));
const JobAnalyzer = React.lazy(() => import("./pages/tools/JobAnalyzer"));
const CareerGapExplainer = React.lazy(() => import("./pages/tools/CareerGapExplainer"));

// Blog pages — public, no auth required
const BlogIndex = React.lazy(() => import("./pages/BlogIndex"));
const BlogPost = React.lazy(() => import("./pages/BlogPost"));
const ReferenceRequest = React.lazy(() => import("./pages/tools/ReferenceRequest"));
const BenefitsCalculator = React.lazy(() => import("./pages/tools/BenefitsCalculator"));
const RejectionResponse = React.lazy(() => import("./pages/tools/RejectionResponse"));
const JobTitleTranslator = React.lazy(() => import("./pages/tools/JobTitleTranslator"));
const InterviewScorecard = React.lazy(() => import("./pages/tools/InterviewScorecard"));
const EquityCalculator = React.lazy(() => import("./pages/tools/EquityCalculator"));
const InterviewPlanner = React.lazy(() => import("./pages/tools/InterviewPlanner"));
const WorkStyleQuiz = React.lazy(() => import("./pages/tools/WorkStyleQuiz"));
const JobDescriptionGenerator = React.lazy(() => import("./pages/tools/JobDescriptionGenerator"));
const HiringCostCalculator = React.lazy(() => import("./pages/tools/HiringCostCalculator"));
const OfferLetter = React.lazy(() => import("./pages/tools/OfferLetter"));
const EmployerBrandScore = React.lazy(() => import("./pages/tools/EmployerBrandScore"));

// Prefetch likely-next page chunks after initial load so navigation feels instant
const prefetchChunks = () => {
  // Warm the chunk cache — import() returns cached promises if already loaded
  import("./pages/AppliedJobs");
  import("./pages/Matches");
  import("./pages/Messages");
  import("./pages/Profile");
  import("./pages/InterviewScheduler");
};
// Start prefetching after main page renders (2s delay to avoid competing with critical resources)
if (typeof window !== 'undefined') {
  window.addEventListener('load', () => setTimeout(prefetchChunks, 2000), { once: true });
}

// Admin pages — completely separate chunk (never loaded for regular users)
const AdminLogin = React.lazy(() => import("./pages/admin/AdminLogin"));
const AdminLayout = React.lazy(() => import("./pages/admin/AdminLayout"));
const AdminOverview = React.lazy(() => import("./pages/admin/AdminOverview"));
const AdminUsers = React.lazy(() => import("./pages/admin/AdminUsers"));
const AdminJobs = React.lazy(() => import("./pages/admin/AdminJobs"));
const AdminModeration = React.lazy(() => import("./pages/admin/AdminModeration"));
const AdminReports = React.lazy(() => import("./pages/admin/AdminReports"));
const AdminVerification = React.lazy(() => import("./pages/admin/AdminVerification"));
const AdminSettings = React.lazy(() => import("./pages/admin/AdminSettings"));
const AdminTesting = React.lazy(() => import("./pages/admin/AdminTesting"));
const AdminHealth = React.lazy(() => import("./pages/admin/AdminHealth"));
const AdminMedia = React.lazy(() => import("./pages/admin/AdminMedia"));
const AdminSupport = React.lazy(() => import("./pages/admin/AdminSupport"));
const AdminPromos = React.lazy(() => import("./pages/admin/AdminPromos"));
const AdminStats = React.lazy(() => import("./pages/admin/AdminStats"));
const AdminRevenue = React.lazy(() => import("./pages/admin/AdminRevenue"));
const AdminPricing = React.lazy(() => import("./pages/admin/AdminPricing"));
const AdminMarketing = React.lazy(() => import("./pages/admin/AdminMarketing"));
const AdminLaunchChecklist = React.lazy(() => import("./pages/admin/AdminLaunchChecklist"));
const AdminFiles = React.lazy(() => import("./pages/admin/AdminFiles"));
const AdminBlog = React.lazy(() => import("./pages/admin/AdminBlog"));
const Support = React.lazy(() => import("./pages/Support"));

const NotFound = () => (
  <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
    <h1 className="text-6xl font-bold mb-4">404</h1>
    <p className="text-xl text-muted-foreground mb-6">Page not found</p>
    <a href="/" className="px-6 py-3 rounded-full bg-primary text-white font-medium hover:opacity-90 transition-opacity">
      Go Home
    </a>
  </div>
);

const PageSpinner = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Redirect users to onboarding if not complete
  if (!user.onboarding_complete) {
    if (user.role === 'seeker') {
      return <Navigate to="/onboarding" replace />;
    }
    if (user.role === 'recruiter') {
      return <Navigate to="/recruiter/onboarding" replace />;
    }
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to={user.role === 'seeker' ? '/dashboard' : '/recruiter'} replace />;
  }

  return children;
};

const OnboardingRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If already completed onboarding, go to appropriate dashboard
  if (user.onboarding_complete) {
    return <Navigate to={user.role === 'seeker' ? '/dashboard' : '/recruiter'} replace />;
  }

  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user) {
    if (!user.onboarding_complete) {
      return <Navigate to={user.role === 'seeker' ? '/onboarding' : '/recruiter/onboarding'} replace />;
    }
    return <Navigate to={user.role === 'seeker' ? '/dashboard' : '/recruiter'} replace />;
  }

  return children;
};

const AdminRoute = ({ children }) => {
  const { admin, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!admin) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
};

const AdminIndex = () => {
  const { admin } = useAdminAuth();
  const target = admin?.role === 'support' ? '/admin/support' : '/admin/dashboard';
  return <Navigate to={target} replace />;
};

/** Initialize Capacitor native plugins when running inside iOS/Android shell */
function CapacitorInit() {
  const navigate = useNavigate();

  useEffect(() => {
    let cleanup;
    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (!Capacitor.isNativePlatform()) return;

        // Handle deep links
        const { App: CapApp } = await import('@capacitor/app');
        const listener = await CapApp.addListener('appUrlOpen', (event) => {
          const url = new URL(event.url);
          const path = url.pathname + url.search;
          if (path) navigate(path);
        });

        // Handle back button (Android)
        const backListener = await CapApp.addListener('backButton', ({ canGoBack }) => {
          if (canGoBack) {
            window.history.back();
          } else {
            CapApp.exitApp();
          }
        });

        // Configure status bar
        try {
          const { StatusBar, Style } = await import('@capacitor/status-bar');
          await StatusBar.setStyle({ style: Style.Dark });
        } catch { /* StatusBar plugin not available */ }

        // Hide splash screen
        try {
          const { SplashScreen } = await import('@capacitor/splash-screen');
          await SplashScreen.hide();
        } catch { /* SplashScreen plugin not available */ }

        cleanup = () => {
          listener.remove();
          backListener.remove();
        };
      } catch { /* Not running in Capacitor */ }
    })();

    return () => cleanup?.();
  }, [navigate]);

  return null;
}

function AppRoutes() {
  useCanonical();
  return (
    <>
    <Suspense fallback={null}><ImpersonationBanner /></Suspense>
    <Suspense fallback={<PageSpinner />}>
    <Routes>
      <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/register/:role" element={<PublicRoute><Register /></PublicRoute>} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/download" element={<Download />} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password" element={<PublicRoute><ResetPassword /></PublicRoute>} />
      <Route
        path="/onboarding"
        element={
          <OnboardingRoute>
            <Onboarding />
          </OnboardingRoute>
        }
      />
      <Route
        path="/recruiter/onboarding"
        element={
          <OnboardingRoute>
            <RecruiterOnboarding />
          </OnboardingRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute allowedRoles={['seeker']}>
            <SeekerDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recruiter"
        element={
          <ProtectedRoute allowedRoles={['recruiter']}>
            <RecruiterDashboard />
          </ProtectedRoute>
        }
      />
      {/* Backward compat: old dashboard URL redirects to /recruiter */}
      <Route path="/recruiter/dashboard" element={<Navigate to="/recruiter" replace />} />
      <Route
        path="/recruiter/search"
        element={
          <ProtectedRoute allowedRoles={['recruiter']}>
            <RecruiterSearch />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recruiter/pipeline"
        element={
          <ProtectedRoute allowedRoles={['recruiter']}>
            <RecruiterApplications />
          </ProtectedRoute>
        }
      />
      {/* Backward compat: old applications URL redirects to pipeline */}
      <Route path="/recruiter/applications" element={<Navigate to="/recruiter/pipeline" replace />} />
      {/* Legacy swipe page redirects to search */}
      <Route
        path="/recruiter/candidates"
        element={
          <ProtectedRoute allowedRoles={['recruiter']}>
            <RecruiterSwipe />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <Profile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/skills"
        element={
          <ProtectedRoute>
            <SkillQuiz />
          </ProtectedRoute>
        }
      />
      <Route
        path="/skills/:quizId"
        element={
          <ProtectedRoute>
            <SkillQuiz />
          </ProtectedRoute>
        }
      />
      <Route
        path="/matches"
        element={
          <ProtectedRoute>
            <Matches />
          </ProtectedRoute>
        }
      />
      <Route
        path="/messages"
        element={
          <ProtectedRoute>
            <Messages />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat/:matchId"
        element={
          <ProtectedRoute>
            <Chat />
          </ProtectedRoute>
        }
      />
      <Route
        path="/applied"
        element={
          <ProtectedRoute allowedRoles={['seeker']}>
            <AppliedJobs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/saved"
        element={
          <ProtectedRoute allowedRoles={['seeker']}>
            <SavedJobs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/search"
        element={
          <ProtectedRoute allowedRoles={['seeker']}>
            <SeekerSearch />
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile-viewers"
        element={
          <ProtectedRoute allowedRoles={['seeker']}>
            <ProfileViewers />
          </ProtectedRoute>
        }
      />
      <Route
        path="/interviews"
        element={
          <ProtectedRoute>
            <InterviewScheduler />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute allowedRoles={['seeker']}>
            <SeekerAnalytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recruiter/analytics"
        element={
          <ProtectedRoute allowedRoles={['recruiter']}>
            <RecruiterAnalytics />
          </ProtectedRoute>
        }
      />

      <Route
        path="/company/:recruiterId"
        element={
          <ProtectedRoute allowedRoles={['seeker']}>
            <CompanyJobs />
          </ProtectedRoute>
        }
      />
      <Route
        path="/upgrade"
        element={
          <ProtectedRoute>
            <Upgrade />
          </ProtectedRoute>
        }
      />
      <Route
        path="/support"
        element={
          <ProtectedRoute>
            <Support />
          </ProtectedRoute>
        }
      />

      {/* Public browse — no auth required */}
      <Route path="/browse" element={<BrowseJobs />} />
      <Route path="/jobs/:id" element={<PublicJobDetail />} />

      {/* Legal pages — always accessible */}
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/cookie-policy" element={<CookiePolicy />} />
      <Route path="/community-guidelines" element={<CommunityGuidelines />} />

      {/* Public blog — no auth required */}
      <Route path="/blog" element={<BlogIndex />} />
      <Route path="/blog/:slug" element={<BlogPost />} />

      {/* Free marketing tools — public, no auth required */}
      <Route path="/tools" element={<ToolsIndex />} />
      <Route path="/tools/resume-builder" element={<ResumeBuilder />} />
      <Route path="/tools/resume-score" element={<ResumeScore />} />
      <Route path="/tools/cover-letter-generator" element={<CoverLetterGenerator />} />
      <Route path="/tools/salary-calculator" element={<SalaryCalculator />} />
      <Route path="/tools/interview-prep" element={<InterviewPrep />} />
      <Route path="/tools/job-tracker" element={<JobTracker />} />
      <Route path="/tools/skills-gap" element={<SkillsGap />} />
      <Route path="/tools/job-description-generator" element={<JobDescriptionGenerator />} />
      <Route path="/tools/hiring-cost-calculator" element={<HiringCostCalculator />} />
      <Route path="/tools/offer-letter" element={<OfferLetter />} />
      <Route path="/tools/employer-brand-score" element={<EmployerBrandScore />} />
      <Route path="/tools/typing-tune-up" element={<TypingTuneUp />} />
      <Route path="/tools/job-analyzer" element={<JobAnalyzer />} />
      <Route path="/tools/career-gap-explainer" element={<CareerGapExplainer />} />
      <Route path="/tools/reference-request" element={<ReferenceRequest />} />
      <Route path="/tools/benefits-calculator" element={<BenefitsCalculator />} />
      <Route path="/tools/after-rejection" element={<RejectionResponse />} />
      <Route path="/tools/job-title-translator" element={<JobTitleTranslator />} />
      <Route path="/tools/interview-scorecard" element={<InterviewScorecard />} />
      <Route path="/tools/equity-calculator" element={<EquityCalculator />} />
      <Route path="/tools/interview-planner" element={<InterviewPlanner />} />
      <Route path="/tools/work-style-quiz" element={<WorkStyleQuiz />} />

      {/* Admin impersonation — no PublicRoute wrapper so it always works */}
      <Route path="/impersonate" element={<Impersonate />} />

      {/* Admin routes — completely separate auth flow */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<AdminIndex />} />
        <Route path="dashboard" element={<AdminOverview />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="jobs" element={<AdminJobs />} />
        <Route path="media" element={<AdminMedia />} />
        <Route path="moderation" element={<AdminModeration />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="verification" element={<AdminVerification />} />
        <Route path="testing" element={<AdminTesting />} />
        <Route path="health" element={<AdminHealth />} />
        <Route path="support" element={<AdminSupport />} />
        <Route path="promos" element={<AdminPromos />} />
        <Route path="stats" element={<AdminStats />} />
        <Route path="revenue" element={<AdminRevenue />} />
        <Route path="pricing" element={<AdminPricing />} />
        <Route path="marketing" element={<AdminMarketing />} />
        <Route path="files" element={<AdminFiles />} />
        <Route path="blog" element={<AdminBlog />} />
        <Route path="launch" element={<AdminLaunchChecklist />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>

      {/* 404 catch-all */}
      <Route path="*" element={<NotFound />} />
    </Routes>
    </Suspense>
    </>
  );
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('App error:', error, info);
    try {
      import('@sentry/react').then(Sentry => {
        Sentry.captureException(error, { extra: { componentStack: info?.componentStack } });
      });
    } catch { /* Sentry not available */ }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
          <p className="text-muted-foreground mb-6">Please try refreshing the page.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-full bg-primary text-white font-medium"
          >
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ThemeProvider>
          <AuthProvider>
            <AdminAuthProvider>
              <CapacitorInit />
              <Suspense fallback={null}><OfflineIndicator /></Suspense>
              <AppRoutes />
              <Toaster position="bottom-center" style={{ bottom: '80px' }} duration={3000} closeButton={false} />
            </AdminAuthProvider>
          </AuthProvider>
        </ThemeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
