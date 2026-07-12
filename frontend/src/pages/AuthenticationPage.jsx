import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useAuthStore } from '../store/authStore.js';

export default function AuthenticationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { signIn, signUp, signInWithProvider, user } = useAuth();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  const redirectTo = location.state?.from || '/dashboard';

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('signup') === 'true') {
      setIsSignUp(true);
    } else {
      setIsSignUp(false);
    }
  }, [location.search]);

  const handleDemoBypass = () => {
    useAuthStore.getState().setIsDemo(true);
    useAuthStore.getState().setAgencyId('00000000-0000-0000-0000-000000000001');
    useAuthStore.getState().setUser({
      id: '00000000-0000-0000-0000-000000000001',
      email: 'demo@voyanta.com',
      user_metadata: { full_name: 'Demo User' }
    }, null, true);
    toast.success('Welcome to Demo Mode!');
    navigate(redirectTo, { replace: true });
  };

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [user, navigate, redirectTo]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    
    try {
      if (isSignUp) {
        await signUp({ email, password, fullName });
        toast.success('Account created! Please check your inbox.');
        setIsSignUp(false);
      } else {
        await signIn({ email, password });
        toast.success('Welcome back!');
        setTimeout(() => navigate(redirectTo, { replace: true }), 300);
      }
    } catch (err) {
      toast.error(err.message || 'Authentication failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    if (submitting) return;
    setSubmitting(true);
    try {
      await signInWithProvider('google');
    } catch (err) {
      toast.error(err.message || 'Google sign-in failed');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center p-xl">
      <div className="max-w-6xl w-full bg-surface rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row h-[700px]">
        
        {/* Left Side: Beautiful imagery */}
        <div className="hidden md:flex md:w-1/2 relative bg-on-surface">
          <img 
            src="https://images.unsplash.com/photo-1498307833015-e7b400441eb8?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80" 
            alt="Amalfi Coast" 
            className="absolute inset-0 w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/60"></div>
          
          <div className="relative z-10 p-xxl flex flex-col justify-between h-full text-white">
            <div>
              <h1 className="font-headline-lg text-headline-lg font-black text-white m-0">Voyanta</h1>
              <p className="font-label-md text-label-md tracking-[0.2em] uppercase text-white/80 m-0 mt-xs">Travel Concierge</p>
            </div>
            
            <div className="mb-xl">
              <div className="inline-flex items-center gap-sm px-md py-sm bg-white/10 backdrop-blur-md rounded-full border border-white/20 mb-lg">
                <span className="material-symbols-outlined text-[16px]">star</span>
                <span className="font-label-sm text-label-sm uppercase tracking-wider">Curated Experiences</span>
              </div>
              <h2 className="font-display text-[42px] leading-tight mb-md text-white">Elevate your journey to an art form.</h2>
              <p className="font-body-lg text-body-lg text-white/80 max-w-md">Access world-class itineraries and exclusive travel perks with a single login.</p>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="w-full md:w-1/2 flex flex-col justify-center px-lg py-xxl sm:px-xxl bg-surface">
          <div className="max-w-md w-full mx-auto">
            
            <div className="mb-xl">
              <h2 className="font-headline-lg text-headline-lg text-on-surface mb-xs m-0">
                Voyanta Travel Concierge
              </h2>
              <p className="font-body-md text-body-md text-on-surface-variant m-0">
                Please enter your credentials or create a new account to continue.
              </p>
            </div>

            {/* Tab switcher */}
            {/* 14-Day Free Trial Notice Banner */}
            <div className="mb-6 p-3.5 bg-gradient-to-r from-emerald-500/10 via-primary/10 to-amber-500/10 border border-emerald-500/25 rounded-2xl flex items-center gap-3 shadow-sm">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 font-bold">
                🎁
              </div>
              <div>
                <p className="text-xs font-bold text-on-surface m-0">
                  14-Day Full Access Free Trial
                </p>
                <p className="text-[11px] text-on-surface-variant m-0">
                  No upfront payment or credit card required • Cancel anytime
                </p>
              </div>
            </div>

            <div className="flex border-b border-outline-variant mb-lg select-none">
              <button 
                onClick={() => setIsSignUp(false)}
                className={`flex-1 pb-3 text-center font-bold text-sm border-b-2 transition-all cursor-pointer ${!isSignUp ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
              >
                Sign In
              </button>
              <button 
                onClick={() => setIsSignUp(true)}
                className={`flex-1 pb-3 text-center font-bold text-sm border-b-2 transition-all cursor-pointer ${isSignUp ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
              >
                Create Account
              </button>
            </div>

            <button 
              onClick={handleGoogle}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-md py-md px-lg border border-outline rounded-lg text-on-surface font-label-md hover:bg-surface-container-low transition-colors disabled:opacity-50"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
              Continue with Google
            </button>

            <div className="flex items-center my-xl">
              <div className="flex-1 border-t border-outline-variant"></div>
              <span className="px-md text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider">Or Email</span>
              <div className="flex-1 border-t border-outline-variant"></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-lg">
              {isSignUp && (
                <div className="space-y-xs">
                  <label className="font-label-sm text-label-sm text-on-surface">Full Name</label>
                  <input 
                    type="text" 
                    required 
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full px-lg py-md bg-surface border border-outline rounded-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="Alex Sterling"
                  />
                </div>
              )}
              
              <div className="space-y-xs">
                <label className="font-label-sm text-label-sm text-on-surface">Email address</label>
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-lg py-md bg-surface border border-outline rounded-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="alex@example.com"
                />
              </div>

              <div className="space-y-xs">
                <div className="flex justify-between items-center">
                  <label className="font-label-sm text-label-sm text-on-surface">Password</label>
                  {!isSignUp && (
                    <a href="#" className="font-label-sm text-label-sm text-primary hover:underline">Forgot password?</a>
                  )}
                </div>
                <div className="relative">
                  <input 
                    type="password" 
                    required 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-lg py-md bg-surface border border-outline rounded-lg focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    placeholder="••••••••"
                  />
                  <span className="material-symbols-outlined absolute right-md top-1/2 -translate-y-1/2 text-on-surface-variant">visibility</span>
                </div>
              </div>

              <button 
                type="submit" 
                disabled={submitting}
                className="w-full bg-on-surface text-surface py-md px-lg rounded-lg font-label-md hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 mt-md border-none"
              >
                {submitting ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
              </button>
            </form>

            <p className="mt-xl text-center font-body-md text-on-surface-variant">
              {isSignUp ? 'Already have an account? ' : 'New to Voyanta? '}
              <button 
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-on-surface font-semibold hover:underline border-none bg-transparent p-0"
              >
                {isSignUp ? 'Sign In' : 'Create an account'}
              </button>
            </p>

          </div>
        </div>
      </div>
    </div>
  );
}
