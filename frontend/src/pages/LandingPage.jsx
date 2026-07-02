import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function LandingPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { user, demoEnabled, enterDemoMode } = useAuth();

  useEffect(() => {
    if (user) {
      // If already logged in, they can go to dashboard if they want
    }
  }, [user]);

  const handleStartDemo = () => {
    if (demoEnabled) {
      enterDemoMode();
      toast.info('Demo mode active');
      navigate('/dashboard');
    } else {
      navigate('/login');
    }
  };

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface overflow-x-hidden selection:bg-primary/30">
      
      {/* Navigation - Glassmorphic */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-xl py-md bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-sm transition-all duration-300">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-md">
            <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-xl shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-white text-[24px]">travel_explore</span>
            </div>
            <span className="font-display font-bold text-2xl tracking-tight text-primary">Voyanta</span>
          </div>
          
          <div className="hidden md:flex items-center gap-xl">
            <a href="#features" className="text-on-surface-variant hover:text-primary font-body-md font-medium transition-colors">Features</a>
            <a href="#how-it-works" className="text-on-surface-variant hover:text-primary font-body-md font-medium transition-colors">How it works</a>
            <a href="#pricing" className="text-on-surface-variant hover:text-primary font-body-md font-medium transition-colors">Pricing</a>
          </div>

          <div className="flex items-center gap-md">
            <button 
              onClick={() => navigate('/login')} 
              className="px-lg py-2 text-on-surface-variant hover:text-primary font-label-md transition-colors"
            >
              Sign In
            </button>
            <button 
              onClick={handleStartDemo}
              className="px-xl py-2.5 bg-primary hover:bg-primary/90 text-white font-label-md rounded-xl shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              Start Free Trial
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[90vh] flex items-center justify-center pt-32 pb-xl overflow-hidden">
        {/* Background Image & Overlay */}
        <div className="absolute inset-0 z-0">
          <img src="/hero-bg.png" alt="Luxury Travel" className="w-full h-full object-cover scale-105" style={{ animation: 'pulse 15s ease-in-out infinite' }} />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-surface"></div>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-xl text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-md py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-[11px] font-bold uppercase tracking-widest mb-lg shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Voyanta 2.0 is Live
          </div>
          
          <h1 className="font-display text-5xl md:text-7xl font-bold text-white mb-lg leading-[1.1] drop-shadow-2xl">
            Elevate Your Travel <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 to-white">Concierge Business</span>
          </h1>
          
          <p className="font-body-lg text-xl text-white/90 max-w-2xl mb-xl drop-shadow-md font-medium leading-relaxed">
            The all-in-one operating system for premium travel agents. Build stunning proposals in minutes, manage client portfolios, and close deals faster.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-md">
            <button 
              onClick={handleStartDemo}
              className="px-8 py-4 bg-white text-primary hover:bg-surface-container-lowest font-label-md text-lg rounded-2xl shadow-[0_8px_30px_rgba(255,255,255,0.3)] hover:shadow-[0_15px_40px_rgba(255,255,255,0.4)] hover:-translate-y-1 transition-all flex items-center gap-sm"
            >
              Get Started Free
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
            <button 
              onClick={() => navigate('/login')}
              className="px-8 py-4 bg-black/30 backdrop-blur-md border border-white/30 text-white hover:bg-black/40 font-label-md text-lg rounded-2xl transition-all shadow-lg hover:shadow-xl flex items-center gap-sm"
            >
              <span className="material-symbols-outlined">play_circle</span>
              Watch Demo
            </button>
          </div>
        </div>
        
        {/* Scroll Indicator */}
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 animate-bounce flex flex-col items-center gap-xs opacity-70 cursor-pointer">
          <span className="text-white text-[10px] font-bold uppercase tracking-widest">Discover</span>
          <span className="material-symbols-outlined text-white">keyboard_arrow_down</span>
        </div>
      </section>

      {/* Feature Bento Grid */}
      <section id="features" className="py-xxl px-xl relative bg-surface">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-xxl">
            <h2 className="font-display text-4xl md:text-5xl font-bold text-on-surface mb-md">Everything you need to succeed</h2>
            <p className="font-body-lg text-lg text-on-surface-variant max-w-2xl mx-auto">Replace fragmented spreadsheets and docs with one powerful, elegant workspace designed specifically for modern travel professionals.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-xl">
            {/* Feature 1 */}
            <div className="md:col-span-2 bg-gradient-to-br from-primary/5 to-surface-container-lowest border border-outline-variant rounded-[32px] p-xl flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center mb-lg">
                <span className="material-symbols-outlined text-primary text-[32px]">design_services</span>
              </div>
              <h3 className="font-display text-3xl font-bold text-on-surface mb-sm">Stunning Proposals in Minutes</h3>
              <p className="text-on-surface-variant font-body-lg mb-xl max-w-md">Wow your clients with beautiful, interactive itineraries that look incredible on any device. Export to PDF or PPTX instantly.</p>
              
              <div className="mt-auto bg-white rounded-2xl p-md border border-outline-variant shadow-md flex items-center gap-md max-w-md w-full mx-auto md:mx-0">
                <div className="w-16 h-16 bg-surface-container rounded-xl overflow-hidden shrink-0">
                   <img src="https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&q=80&w=200" className="w-full h-full object-cover" alt="Dubai" />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm text-on-surface mb-1">Dubai Luxury Escape</div>
                  <div className="flex gap-2">
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded text-[10px] font-bold">ACCEPTED</span>
                    <span className="px-2 py-0.5 bg-surface-container text-on-surface-variant rounded text-[10px] font-bold">$12,400</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Feature 2 */}
            <div className="bg-gradient-to-br from-secondary-container/30 to-surface-container-lowest border border-outline-variant rounded-[32px] p-xl flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="w-14 h-14 bg-secondary-container rounded-2xl flex items-center justify-center mb-lg">
                <span className="material-symbols-outlined text-on-secondary-container text-[32px]">inventory_2</span>
              </div>
              <h3 className="font-display text-2xl font-bold text-on-surface mb-sm">Smart Library</h3>
              <p className="text-on-surface-variant font-body-lg">Store all your hotels, flights, and itineraries in a central database for one-click insertion into any proposal.</p>
            </div>
            
            {/* Feature 3 */}
            <div className="bg-gradient-to-br from-tertiary-container/30 to-surface-container-lowest border border-outline-variant rounded-[32px] p-xl flex flex-col hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
              <div className="w-14 h-14 bg-tertiary-container rounded-2xl flex items-center justify-center mb-lg">
                <span className="material-symbols-outlined text-on-tertiary-container text-[32px]">auto_awesome</span>
              </div>
              <h3 className="font-display text-2xl font-bold text-on-surface mb-sm">AI Magic</h3>
              <p className="text-on-surface-variant font-body-lg">Instantly parse messy email threads and PDF itineraries into structured proposal data using AI.</p>
            </div>
            
            {/* Feature 4 */}
            <div className="md:col-span-2 bg-gradient-to-br from-surface-container-low to-surface border border-outline-variant rounded-[32px] p-xl flex flex-col sm:flex-row items-center gap-xl hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
               <div className="flex-1">
                 <div className="w-14 h-14 bg-surface-container-highest rounded-2xl flex items-center justify-center mb-lg">
                   <span className="material-symbols-outlined text-on-surface text-[32px]">calculate</span>
                 </div>
                 <h3 className="font-display text-3xl font-bold text-on-surface mb-sm">Automated Costing</h3>
                 <p className="text-on-surface-variant font-body-lg max-w-md">Apply markups, discounts, and taxes automatically. Ensure your margins are always protected with intelligent pricing logic.</p>
               </div>
               <div className="w-full sm:w-64 bg-white dark:bg-slate-800 rounded-2xl p-lg border border-outline-variant shadow-lg rotate-1 hover:rotate-0 transition-transform">
                  <div className="flex justify-between mb-sm text-sm">
                    <span className="text-on-surface-variant">Subtotal</span>
                    <span className="font-medium text-on-surface">$8,400</span>
                  </div>
                  <div className="flex justify-between mb-sm text-sm">
                    <span className="text-on-surface-variant">Markup (15%)</span>
                    <span className="font-medium text-emerald-600 dark:text-emerald-400">+$1,260</span>
                  </div>
                  <div className="h-px bg-outline-variant my-md"></div>
                  <div className="flex justify-between font-bold text-lg">
                    <span className="text-on-surface">Total</span>
                    <span className="text-primary dark:text-blue-400">$9,660</span>
                  </div>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-xxl px-xl bg-primary text-white text-center relative overflow-hidden my-xl max-w-7xl mx-auto rounded-[40px] shadow-2xl">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at center, #ffffff 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
        <div className="relative z-10 max-w-3xl mx-auto py-xl">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-lg">Ready to transform your business?</h2>
          <p className="font-body-lg text-xl text-primary-container mb-xl text-white/80">Join hundreds of luxury travel advisors already using Voyanta to save time and win more clients.</p>
          <button 
            onClick={handleStartDemo}
            className="px-xl py-4 bg-white text-primary hover:bg-surface-container-lowest font-label-md text-lg rounded-2xl shadow-xl hover:-translate-y-1 transition-all"
          >
            Start Your Free Trial
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-xl px-xl bg-surface-container-lowest border-t border-outline-variant mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-md">
          <div className="flex items-center gap-sm">
             <div className="w-8 h-8 bg-primary flex items-center justify-center rounded-lg">
               <span className="material-symbols-outlined text-white text-[18px]">travel_explore</span>
             </div>
             <span className="font-display font-bold text-xl text-primary">Voyanta</span>
          </div>
          <div className="text-sm font-body-md text-on-surface-variant">
            &copy; {new Date().getFullYear()} Voyanta, Inc. All rights reserved.
          </div>
          <div className="flex gap-lg">
             <a href="#" className="font-label-sm text-on-surface-variant hover:text-primary transition-colors">Privacy</a>
             <a href="#" className="font-label-sm text-on-surface-variant hover:text-primary transition-colors">Terms</a>
             <a href="#" className="font-label-sm text-on-surface-variant hover:text-primary transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
