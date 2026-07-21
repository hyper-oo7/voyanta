import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';

// Wraps protected routes. While auth restores from storage we render nothing
// to avoid a flash of redirect. If no user, redirect to /login preserving the
// originally requested path so the login flow can return the user there.
export default function ProtectedRoute({ children }) {
  const { user, isLoading: loading, isInitialized } = useAuthStore();
  const location = useLocation();

  if (loading || isInitialized === false) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface" data-testid="auth-loading">
        <span className="material-symbols-outlined animate-spin text-primary text-3xl">progress_activity</span>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}
