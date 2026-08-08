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
      <div className="flex flex-col items-center justify-center min-h-screen bg-surface" data-testid="auth-loading">
        <div className="relative w-32 h-32 flex items-center justify-center">
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-1 bg-primary/40 rounded-full animate-wind ml-8"></div>
            <div className="w-8 h-1 bg-primary/30 rounded-full animate-wind-delayed -ml-6"></div>
            <div className="w-16 h-1 bg-primary/20 rounded-full animate-wind-slow ml-12"></div>
          </div>
          <span className="material-symbols-outlined text-primary text-6xl animate-fly-float relative z-10 drop-shadow-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
            flight
          </span>
        </div>
        <p className="mt-2 font-label-sm text-xs font-bold text-primary uppercase tracking-[0.2em] animate-pulse">
          Preparing your journey...
        </p>
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return children;
}
