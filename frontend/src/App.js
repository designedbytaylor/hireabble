import React, { Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "./components/ui/sonner";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { AdminAuthProvider, useAdminAuth } from "./context/AdminAuthContext";

// Eager load only the landing/auth pages (first paint)
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";

// Lazy load everything else — each becomes its own JS chunk
const ForgotPassword = React.lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = React.lazy(() => import("./pages/ResetPassword"));
const Onboarding = React.lazy(() => import("./pages/Onboarding"));
const SeekerDashboard = React.lazy(() => import("./pages/SeekerDashboard"));
const RecruiterDashboard = React.lazy(() => import("./pages/RecruiterDashboard"));
const RecruiterSwipe = React.lazy(() => import("./pages/RecruiterSwipe"));
const Profile = React.lazy(() => import("./pages/Profile"));
const Matches = React.lazy(() => import("./pages/Matches"));
const Chat = React.lazy(() => import("./pages/Chat"));
const InterviewScheduler = React.lazy(() => import("./pages/InterviewScheduler"));
const RecruiterAnalytics = React.lazy(() => import("./pages/RecruiterAnalytics"));
const AppliedJobs = React.lazy(() => import("./pages/AppliedJobs"));
const RecruiterApplications = React.lazy(() => import("./pages/RecruiterApplications"));
const Messages = React.lazy(() => import("./pages/Messages"));
const Upgrade = React.lazy(() => import("./pages/Upgrade"));
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

  // Redirect seekers to onboarding if not complete
  if (user.role === 'seeker' && !user.onboarding_complete) {
    return <Navigate to="/onboarding" replace />;
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

  // If already completed onboarding, go to dashboard
  if (user.onboarding_complete) {
    return <Navigate to="/dashboard" replace />;
  }

  // Only seekers need onboarding
  if (user.role !== 'seeker') {
    return <Navigate to="/recruiter" replace />;
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
    // Check if seeker needs onboarding
    if (user.role === 'seeker' && !user.onboarding_complete) {
      return <Navigate to="/onboarding" replace />;
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

function AppRoutes() {
  return (
    <Suspense fallback={<PageSpinner />}>
    <Routes>
      <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
      <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />
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

      {/* Legal pages — always accessible */}
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/cookie-policy" element={<CookiePolicy />} />

      {/* Admin impersonation — no PublicRoute wrapper so it always works */}
      <Route path="/impersonate" element={<Impersonate />} />

      {/* Admin routes — completely separate auth flow */}
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminOverview />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="jobs" element={<AdminJobs />} />
        <Route path="media" element={<AdminMedia />} />
        <Route path="moderation" element={<AdminModeration />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="testing" element={<AdminTesting />} />
        <Route path="settings" element={<AdminSettings />} />
      </Route>
    </Routes>
    </Suspense>
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
        <AuthProvider>
          <AdminAuthProvider>
            <AppRoutes />
            <Toaster position="bottom-center" richColors style={{ bottom: '80px' }} />
          </AdminAuthProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
