import { memo, useState, useEffect } from 'react';
import { useToast } from '../context/ToastContext.jsx';
import { logActivity } from '../services/activityLogService.js';

export default memo(function PlanPage() {
  const toast = useToast();
  const [activePlan, setActivePlan] = useState(() => {
    return localStorage.getItem('voyanta_active_plan') || 'Starter';
  });

  useEffect(() => {
    const handler = () => setActivePlan(localStorage.getItem('voyanta_active_plan') || 'Starter');
    window.addEventListener('voyanta:plan-updated', handler);
    return () => window.removeEventListener('voyanta:plan-updated', handler);
  }, []);

  const handleSelectPlan = (planName) => {
    localStorage.setItem('voyanta_active_plan', planName);
    setActivePlan(planName);
    window.dispatchEvent(new CustomEvent('voyanta:plan-updated'));
    logActivity('subscription', `Switched subscription tier to ${planName}`);
    toast.success(`Successfully switched to ${planName} Plan! Features are now active.`);
  };

  const plans = [
    {
      name: "Starter",
      price: "$49",
      period: "per month",
      desc: "Perfect for independent travel agents starting their luxury journey.",
      features: ["Up to 10 PDF downloads/mo", "Basic templates", "Standard support", "Voyanta branding", "Team Management Locked"],
      cta: activePlan === 'Starter' ? "Current Plan" : "Switch to Starter",
      primary: false
    },
    {
      name: "Professional",
      price: "$129",
      period: "per month",
      desc: "For growing agencies needing powerful CRM and branding tools.",
      features: ["Unlimited proposals & downloads", "Custom branding fields", "Priority support", "Analytics dashboard", "Team Management Locked"],
      cta: activePlan === 'Professional' ? "Current Plan" : "Upgrade to Pro",
      primary: true
    },
    {
      name: "Enterprise",
      price: "$299",
      period: "tailored pricing",
      desc: "Bespoke solutions for high-volume luxury travel networks.",
      features: ["Everything in Pro", "Team Management & RBAC Unlocked", "Dedicated account manager", "White-label solution", "Full Audit Logs"],
      cta: activePlan === 'Enterprise' ? "Current Plan" : "Select Enterprise",
      primary: false
    }
  ];

  return (
    <div className="max-w-5xl mx-auto py-xxl animate-fade-in">
      <div className="text-center mb-xxxl pb-lg relative z-20">
        <h1 className="font-headline-lg text-4xl font-black text-on-surface mb-md">Choose your luxury tier.</h1>
        <p className="font-body-lg text-lg text-on-surface-variant max-w-2xl mx-auto drop-shadow-sm">Elevate your agency with the tools designed to craft unforgettable experiences.</p>
        <div className="mt-4 inline-block bg-primary/10 text-primary font-bold px-4 py-2 rounded-full text-sm">
          Active Tier: <span className="underline">{activePlan} Plan</span>
        </div>
      </div>
      
      <div className="grid md:grid-cols-3 gap-lg lg:gap-xl relative z-10">
        {plans.map((p, i) => {
          const isCurrent = activePlan === p.name;
          return (
            <div key={i} className={`rounded-3xl p-xl flex flex-col transition-transform duration-300 hover:-translate-y-2 border ${p.primary ? 'bg-primary text-on-primary border-primary shadow-2xl scale-105 z-20 relative' : 'bg-surface border-outline-variant relative z-10'}`}>
              <div className="flex justify-between items-start">
                <h3 className="font-headline-sm font-bold mb-xs">{p.name}</h3>
                {isCurrent && (
                  <span className="bg-black text-white text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full">Active</span>
                )}
              </div>
              <p className={`font-body-sm mb-lg ${p.primary ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>{p.desc}</p>
              
              <div className="mb-xl">
                <span className="font-headline-lg text-4xl font-black">{p.price}</span>
                <span className={`font-label-md ml-xs ${p.primary ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>{p.period}</span>
              </div>
              
              <ul className="space-y-md mb-xl flex-1">
                {p.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-sm font-body-md">
                    <span className="material-symbols-outlined text-[20px]">{f.includes('Locked') ? 'lock' : 'check_circle'}</span>
                    {f}
                  </li>
                ))}
              </ul>
              
              <button
                onClick={() => handleSelectPlan(p.name)}
                disabled={isCurrent}
                className={`w-full py-md rounded-full font-label-md font-bold transition-opacity hover:opacity-90 ${isCurrent ? 'bg-gray-400 text-white cursor-not-allowed' : p.primary ? 'bg-white text-primary cursor-pointer shadow-md' : 'bg-surface-container-high text-on-surface cursor-pointer'}`}
              >
                {p.cta}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
});
