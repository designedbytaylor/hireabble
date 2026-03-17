import React, { Suspense, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AdminAuthProvider, useAdminAuth } from "./context/AdminAuthContext";
import { ThemeProvider } from "./context/ThemeContext";

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
const Profile = React.lazy(() => import("./pages/Profile"));
const Matches = React.lazy(() => import("./pages/Matches"));
const Chat = React.lazy(() => import("./pages/Chat"));
const InterviewScheduler = React.lazy(() => import("./pages/InterviewScheduler"));
const RecruiterAnalytics = React.lazy(() => import("./pages/RecruiterAnalytics"));
const AppliedJobs = React.lazy(() => import("./pages/AppliedJobs"));
const SavedJobs = React.lazy(() => import("./pages/SavedJobs"));
// SearchJobs removed — search replaced by swipe filters on dashboard
const RecruiterApplications = React.lazy(() => import("./pages/RecruiterApplications"));
const Messages = React.lazy(() => import("./pages/Messages"));
const Upgrade = React.lazy(() => import("./pages/Upgrade"));
const ProfileViewers = React.lazy(() => import("./pages/ProfileViewers"));
const CompanyJobs = React.lazy(() => import("./pages/CompanyJobs"));
const Impersonate = React.lazy(() => import("./pages/Impersonate"));
const TermsOfService = React.lazy(() => import("./pages/TermsOfService"));
const PrivacyPolicy = React.lazy(() => import("./pages/PrivacyPolicy"));
const CookiePolicy = React.lazy(() => import("./pages/CookiePolicy"));

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
const AdminSettings = React.lazy(() => import("./pages/admin/AdminSettings"));
const AdminTesting = React.lazy(() => import("./pages/admin/AdminTesting"));
const AdminMedia = React.lazy(() => import("./pages/admin/AdminMedia"));
const AdminThemes = React.lazy(() => import("./pages/admin/AdminThemes"));
const AdminSupport = React.lazy(() => import("./pages/admin/AdminSupport"));
const AdminPromos = React.lazy(() => import("./pages/admin/AdminPromos"));
const AdminStats = React.lazy(() => import("./pages/admin/AdminStats"));
const AdminRevenue = React.lazy(() => import("./pages/admin/AdminRevenue"));
const AdminPricing = React.lazy(() => import("./pages/admin/AdminPricing"));
const AdminMarketing = React.lazy(() => import("./pages/admin/AdminMarketing"));
const Support = React.lazy(() => import("./pages/Support"));

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
            <RecruiterSwipe />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recruiter/dashboard"
        element={
          <ProtectedRoute allowedRoles={['recruiter']}>
            <RecruiterDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/recruiter/applications"
        element={
          <ProtectedRoute allowedRoles={['recruiter']}>
            <RecruiterApplications />
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
      {/* /search route removed — swipe dashboard filters replace search */}
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

      {/* Legal pages — always accessible */}
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/cookie-policy" element={<CookiePolicy />} />

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
        <Route path="testing" element={<AdminTesting />} />
        <Route path="themes" element={<AdminThemes />} />
        <Route path="support" element={<AdminSupport />} />
        <Route path="promos" element={<AdminPromos />} />
        <Route path="stats" element={<AdminStats />} />
        <Route path="revenue" element={<AdminRevenue />} />
        <Route path="pricing" element={<AdminPricing />} />
        <Route path="marketing" element={<AdminMarketing />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
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
