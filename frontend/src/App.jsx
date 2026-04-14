import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';

const LandingPage = lazy(() => import('./pages/LandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const LoanApplicationPage = lazy(() => import('./pages/LoanApplicationPage'));
const ResultPage = lazy(() => import('./pages/ResultPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

const App = () => (
  <Suspense
    fallback={
      <div className="grid min-h-screen place-items-center bg-secure-950 text-white/60">
        Loading SecureLend...
      </div>
    }
  >
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <UserDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/apply"
        element={
          <ProtectedRoute>
            <LoanApplicationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/result"
        element={
          <ProtectedRoute>
            <ResultPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute role="admin">
            <AdminDashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  </Suspense>
);

export default App;
