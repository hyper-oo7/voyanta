import { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import StitchPage from '../components/StitchPage.jsx';
import navMap from '../lib/navMap.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { VoyantaAuthentication_bodyClass, VoyantaAuthentication_extraStyles, VoyantaAuthentication_html } from './_html/voyanta_authentication.js';

// Auth page: preserves Stitch's exact UI but wires the existing form fields,
// "Forgot password?" link, and "Create an account" toggle to Supabase Auth.
export default function AuthenticationPage() {
  const wrapperRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { signIn, signUp, resetPassword, signInWithProvider, user, enterDemoMode, demoEnabled } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const redirectTo = location.state?.from || '/dashboard';

  useEffect(() => {
    if (user) navigate(redirectTo, { replace: true });
  }, [user, navigate, redirectTo]);

  useEffect(() => {
    const root = wrapperRef.current;
    if (!root) return;
    const form = root.querySelector('#loginForm');
    const signupOverlay = root.querySelector('#signupOverlay');
    const signupModal = root.querySelector('#signupModal');
    const toggleAuthBtn = root.querySelector('#toggleAuth');
    const closeSignup = root.querySelector('#closeSignup');
    const forgot = root.querySelector('a[href="#"]'); // first "Forgot password?" link

    // ---- Login submit ----
    const onLogin = async (e) => {
      e.preventDefault();
      if (submitting) return;
      setSubmitting(true);
      const email = form.querySelector('#email').value.trim();
      const password = form.querySelector('#password').value;
      const btn = form.querySelector('button[type="submit"]');
      const original = btn.innerText;
      btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-md">progress_activity</span>';
      btn.disabled = true;
      try {
        await signIn({ email, password });
        btn.innerHTML = '<span class="material-symbols-outlined text-md">check</span> Signed in';
        toast.success('Welcome back!');
        setTimeout(() => navigate(redirectTo, { replace: true }), 300);
      } catch (err) {
        toast.error(err.message || 'Sign-in failed');
        btn.innerText = original;
        btn.disabled = false;
      } finally {
        setSubmitting(false);
      }
    };
    form?.addEventListener('submit', onLogin);

    // ---- Open / close signup modal ----
    const openSignup = () => {
      signupOverlay.classList.remove('hidden');
      requestAnimationFrame(() => {
        signupOverlay.classList.replace('opacity-0', 'opacity-100');
        signupModal.classList.replace('scale-95', 'scale-100');
      });
    };
    const dismissSignup = () => {
      signupOverlay.classList.replace('opacity-100', 'opacity-0');
      signupModal.classList.replace('scale-100', 'scale-95');
      setTimeout(() => signupOverlay.classList.add('hidden'), 300);
    };
    toggleAuthBtn?.addEventListener('click', openSignup);
    closeSignup?.addEventListener('click', dismissSignup);
    const onBackdrop = (e) => { if (e.target === signupOverlay) dismissSignup(); };
    signupOverlay?.addEventListener('click', onBackdrop);

    // ---- Signup submit ----
    const signupForm = signupOverlay?.querySelector('form');
    const onSignup = async (e) => {
      e.preventDefault();
      if (submitting) return;
      setSubmitting(true);
      const inputs = signupForm.querySelectorAll('input');
      const firstName = inputs[0].value.trim();
      const lastName = inputs[1].value.trim();
      const email = inputs[2].value.trim();
      const password = inputs[3].value;
      const btn = signupForm.querySelector('button[type="button"]');
      const original = btn.innerText;
      btn.disabled = true;
      btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-md">progress_activity</span>';
      try {
        await signUp({ email, password, fullName: `${firstName} ${lastName}`.trim() });
        toast.success('Account created. Check your inbox to confirm.');
        dismissSignup();
        btn.innerText = original;
      } catch (err) {
        toast.error(err.message || 'Sign-up failed');
        btn.innerText = original;
      } finally {
        btn.disabled = false;
        setSubmitting(false);
      }
    };
    signupForm?.addEventListener('submit', onSignup);
    const signupBtn = signupForm?.querySelector('button[type="button"]');
    signupBtn?.addEventListener('click', onSignup);

    // ---- Forgot password ----
    const onForgot = async (e) => {
      e.preventDefault();
      const email = form?.querySelector('#email').value.trim();
      if (!email) { toast.error('Enter your email above first.'); return; }
      try {
        await resetPassword(email);
        toast.success('Password reset email sent.');
      } catch (err) {
        toast.error(err.message || 'Could not send reset email');
      }
    };
    forgot?.addEventListener('click', onForgot);

    // ---- Google OAuth ----
    const googleBtn = Array.from(root.querySelectorAll('button')).find(b => b.textContent.includes('Continue with Google'));
    const onGoogleLogin = async (e) => {
      e.preventDefault();
      if (submitting) return;
      setSubmitting(true);
      const original = googleBtn.innerHTML;
      googleBtn.innerHTML = '<span class="material-symbols-outlined animate-spin text-md">progress_activity</span>';
      googleBtn.disabled = true;
      try {
        await signInWithProvider('google');
      } catch (err) {
        toast.error(err.message || 'Google sign-in failed');
        googleBtn.innerHTML = original;
        googleBtn.disabled = false;
        setSubmitting(false);
      }
    };
    googleBtn?.addEventListener('click', onGoogleLogin);

    return () => {
      form?.removeEventListener('submit', onLogin);
      toggleAuthBtn?.removeEventListener('click', openSignup);
      closeSignup?.removeEventListener('click', dismissSignup);
      signupOverlay?.removeEventListener('click', onBackdrop);
      signupForm?.removeEventListener('submit', onSignup);
      signupBtn?.removeEventListener('click', onSignup);
      forgot?.removeEventListener('click', onForgot);
      googleBtn?.removeEventListener('click', onGoogleLogin);
    };
  }, [signIn, signUp, resetPassword, signInWithProvider, navigate, toast, redirectTo, submitting]);

  // Inject a small "Try Demo" affordance below the form (preserves all Stitch
  // styling — only adds; never restyles).
  useEffect(() => {
    if (!demoEnabled) return;
    const root = wrapperRef.current;
    if (!root) return;
    const footer = root.querySelector('footer');
    if (!footer || footer.dataset.demoInjected) return;
    footer.dataset.demoInjected = '1';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-testid', 'demo-mode-btn');
    btn.className = 'mt-md text-label-sm font-label-sm text-on-surface-variant hover:text-primary underline';
    btn.textContent = 'Skip — try Demo Mode';
    btn.addEventListener('click', () => {
      enterDemoMode();
      toast.info('Demo mode active');
      navigate('/dashboard', { replace: true });
    });
    footer.appendChild(btn);
  }, [demoEnabled, enterDemoMode, navigate, toast]);

  return (
    <div ref={wrapperRef} style={{ display: 'contents' }}>
      <StitchPage
        styleId="stitch-style-auth"
        bodyClass={VoyantaAuthentication_bodyClass}
        extraStyles={VoyantaAuthentication_extraStyles}
        html={VoyantaAuthentication_html}
        navMap={navMap}
      />
    </div>
  );
}
