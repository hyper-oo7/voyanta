import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';


import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';


export default function LandingPage() {
  const wrapperRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { user, demoEnabled, enterDemoMode } = useAuth();

  // Re-wire CTAs: any "Start Free Trial"/"Get Started" goes to demo dashboard
  // (when demo mode is enabled); Login/Sign Up route to /login.
  useEffect(() => {
    const root = wrapperRef.current; if (!root) return;
    const buttons = root.querySelectorAll('button');
    const wiring = [];
    buttons.forEach((btn) => {
      const label = (btn.textContent || '').trim().toLowerCase();
      let onClick = null;
      if (/start free trial|get started|try demo/.test(label) && demoEnabled) {
        onClick = () => { enterDemoMode(); toast.info('Demo mode active'); navigate('/dashboard'); };
      } else if (/sign up|sign in|login|start free trial|get started/.test(label)) {
        onClick = () => navigate('/login');
      } else if (/book a demo|talk to an expert/.test(label)) {
        onClick = () => navigate('/login');
      }
      if (onClick) {
        btn.addEventListener('click', onClick);
        wiring.push([btn, onClick]);
      }
    });
    return () => wiring.forEach(([b, h]) => b.removeEventListener('click', h));
  }, [navigate, demoEnabled, enterDemoMode, toast]);

  // If user is already authenticated (or in demo), redirect to dashboard
  // when they hit the landing page accidentally. Soft redirect only.
  useEffect(() => {
    if (user) {
      // do not auto-redirect — Stitch landing page can still be visited.
    }
  }, [user]);

  return (
    <div ref={wrapperRef} style={{ display: 'contents' }}>
      <div className="p-xl text-center font-body-lg">TODO: Migrate this page to new React architecture</div>
    </div>
  );
}
