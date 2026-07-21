import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useToast } from '../context/ToastContext.jsx';
import { useAuthStore } from '../store/authStore.js';

export default function AuthenticationPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { signIn, signUp, signInWithProvider, user } = useAuthStore();
  
  const [isSignUp, setIsSignUp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
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
    const plan = params.get('plan');
    if (plan) {
      localStorage.setItem('voyanta_pending_subscription_plan', plan);
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
    if (isSignUp && !termsAccepted) {
      toast.error('Please accept the Terms & Conditions and Privacy Policy to continue.');
      return;
    }
    setSubmitting(true);
    
    try {
      if (isSignUp) {
        const res = await signUp({ email, password, fullName });
        if (res?.session) {
          toast.success('Account created successfully!');
          setTimeout(() => navigate(redirectTo, { replace: true }), 300);
        } else {
          toast.success('Account created successfully! Please sign in with your credentials.');
          setIsSignUp(false);
        }
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
    <div className="min-h-screen bg-surface-container-lowest flex items-center justify-center p-4 md:p-8">
      <div className="max-w-6xl w-full bg-surface rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row min-h-[580px] md:min-h-[680px] max-h-[92vh] my-auto border border-outline-variant/40">
        
        {/* Left Side: Beautiful imagery */}
        <div className="hidden md:flex md:w-1/2 relative bg-on-surface">
          <img 
            src="https://images.unsplash.com/photo-1498307833015-e7b400441eb8?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80" 
            alt="Amalfi Coast" 
            className="absolute inset-0 w-full h-full object-cover opacity-80"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/60"></div>
          
          <div className="relative z-10 p-[40px] flex flex-col justify-between h-full text-white">
            <div>
              <h1 className="font-headline-lg text-headline-lg font-black text-white m-0">Voyanta</h1>
              <p className="font-label-md text-label-md tracking-[0.2em] uppercase text-white/80 m-0 mt-xs">Travel Concierge</p>
            </div>
            
            <div className="mb-xl">
              <div className="inline-flex items-center gap-sm px-md py-sm bg-white/10 backdrop-blur-md rounded-full border border-white/20 mb-lg">
                <span className="material-symbols-outlined text-[16px]">star</span>
                <span className="font-label-sm text-label-sm uppercase tracking-wider">Curated Experiences</span>
              </div>
              <h2 className="font-display text-[38px] leading-tight mb-md text-white">Elevate your journey to an art form.</h2>
              <p className="font-body-lg text-body-lg text-white/80 max-w-md">Access world-class itineraries and exclusive travel perks with a single login.</p>
            </div>
          </div>
        </div>

        {/* Right Side: Auth Form */}
        <div className="w-full md:w-1/2 flex flex-col justify-start md:justify-center py-6 md:py-8 px-6 sm:px-10 bg-surface overflow-y-auto max-h-[92vh] custom-scrollbar">
          <div className="max-w-md w-full mx-auto">
            
            {/* Top Navigation Row */}
            <div className="flex items-center justify-between mb-4">
              <button 
                onClick={() => navigate('/')} 
                className="flex items-center gap-1 text-xs font-bold text-primary hover:underline bg-transparent border-none p-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">arrow_back</span>
                Back to Home
              </button>
              <div className="flex items-center gap-1.5 md:hidden">
                <span className="material-symbols-outlined text-primary text-[20px]">travel_explore</span>
                <span className="font-display font-bold text-primary text-base">Voyanta</span>
              </div>
            </div>

            <div className="mb-4">
              <h2 className="font-headline-lg text-xl md:text-2xl text-on-surface mb-1 m-0">
                Voyanta Travel Concierge
              </h2>
              <p className="font-body-md text-xs text-on-surface-variant m-0">
                Please enter your credentials or create a new account to continue.
              </p>
            </div>

            {/* 14-Day Free Trial Notice Banner */}
            <div className="mb-4 p-3 bg-gradient-to-r from-emerald-500/10 via-primary/10 to-amber-500/10 border border-emerald-500/25 rounded-xl flex items-center gap-3 shadow-sm">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 font-bold text-xs">
                🎁
              </div>
              <div>
                <p className="text-xs font-bold text-on-surface m-0">
                  14-Day Full Access Free Trial
                </p>
                <p className="text-[11px] text-on-surface-variant m-0">
                  No upfront payment required • Cancel anytime
                </p>
              </div>
            </div>

            <div className="flex border-b border-outline-variant mb-4 select-none">
              <button 
                type="button"
                onClick={() => setIsSignUp(false)}
                className={`flex-1 pb-2.5 text-center font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${!isSignUp ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
              >
                Sign In
              </button>
              <button 
                type="button"
                onClick={() => setIsSignUp(true)}
                className={`flex-1 pb-2.5 text-center font-bold text-xs uppercase tracking-wider border-b-2 transition-all cursor-pointer ${isSignUp ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
              >
                Create Account
              </button>
            </div>

            <button 
              type="button"
              onClick={handleGoogle}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border border-outline rounded-xl text-on-surface font-bold text-xs hover:bg-surface-container-low transition-colors disabled:opacity-50 cursor-pointer"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" />
              Continue with Google
            </button>

            <div className="flex items-center my-3">
              <div className="flex-1 border-t border-outline-variant"></div>
              <span className="px-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Or Email</span>
              <div className="flex-1 border-t border-outline-variant"></div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              {isSignUp && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface uppercase tracking-wider">Full Name</label>
                  <input 
                    type="text" 
                    required 
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2 bg-surface border border-outline rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                    placeholder="Alex Sterling"
                  />
                </div>
              )}
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface uppercase tracking-wider">Email address</label>
                <input 
                  type="email" 
                  required 
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2 bg-surface border border-outline rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
                  placeholder="alex@example.com"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-bold text-on-surface uppercase tracking-wider">Password</label>
                  {!isSignUp && (
                    <a href="#" className="text-xs text-primary hover:underline font-semibold">Forgot password?</a>
                  )}
                </div>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"} 
                    required 
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full px-3.5 py-2 bg-surface border border-outline rounded-xl text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all pr-10"
                    placeholder="••••••••"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface bg-transparent border-none p-0 cursor-pointer text-[18px]"
                  >
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </button>
                </div>
              </div>

              {isSignUp && (
                <div className="flex items-start gap-2.5 pt-1 select-none">
                  <input 
                    type="checkbox" 
                    id="termsAccepted" 
                    checked={termsAccepted} 
                    onChange={e => setTermsAccepted(e.target.checked)} 
                    className="mt-0.5 w-4 h-4 accent-primary rounded cursor-pointer shrink-0"
                  />
                  <label htmlFor="termsAccepted" className="text-xs text-on-surface-variant leading-tight cursor-pointer">
                    I agree to the <a href="/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">Terms of Service</a> and <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-semibold">Privacy Policy</a>, and consent to DPDP Act 2023 processing.
                  </label>
                </div>
              )}

              <button 
                type="submit" 
                disabled={submitting || (isSignUp && !termsAccepted)}
                className="w-full bg-primary text-white py-2.5 px-4 rounded-xl font-bold text-sm hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50 mt-2 border-none cursor-pointer shadow-md shadow-primary/20"
              >
                {submitting ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign In')}
              </button>
            </form>

            <p className="mt-4 text-center text-xs text-on-surface-variant">
              {isSignUp ? 'Already have an account? ' : 'New to Voyanta? '}
              <button 
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-primary font-bold hover:underline border-none bg-transparent p-0 cursor-pointer"
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
