import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/authStore.js';
import FlyingLoader from './common/FlyingLoader.jsx';

// Wraps protected routes. While auth restores from storage we render nothing
// to avoid a flash of redirect. If no user, redirect to /login preserving the
// originally requested path so the login flow can return the user there.
export default function ProtectedRoute({ children }) {
  const { user, isLoading: loading, isInitialized } = useAuthStore();
  const location = useLocation();

  if (loading || isInitialized === false) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface" data-testid="auth-loading">
        <FlyingLoader  />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}
