import { memo } from 'react';

export default memo(function PlanPage() {
  const plans = [
    {
      name: "Starter",
      price: "$49",
      period: "per month",
      desc: "Perfect for independent travel agents starting their luxury journey.",
      features: ["Up to 10 proposals/mo", "Basic templates", "Standard support", "Voyanta branding"],
      cta: "Current Plan",
      primary: false
    },
    {
      name: "Professional",
      price: "$129",
      period: "per month",
      desc: "For growing agencies needing powerful CRM and branding tools.",
      features: ["Unlimited proposals", "Custom branding", "Priority support", "Analytics dashboard", "Client portal"],
      cta: "Upgrade to Pro",
      primary: true
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "tailored pricing",
      desc: "Bespoke solutions for high-volume luxury travel networks.",
      features: ["Everything in Pro", "API access", "Dedicated account manager", "White-label solution", "Custom integrations"],
      cta: "Contact Sales",
      primary: false
    }
  ];

  return (
    <div className="max-w-5xl mx-auto py-xxl animate-fade-in">
      <div className="text-center mb-xxxl pb-lg relative z-20">
        <h1 className="font-headline-lg text-4xl font-black text-on-surface mb-md">Choose your luxury tier.</h1>
        <p className="font-body-lg text-lg text-on-surface-variant max-w-2xl mx-auto drop-shadow-sm">Elevate your agency with the tools designed to craft unforgettable experiences.</p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-lg lg:gap-xl relative z-10">
        {plans.map((p, i) => (
          <div key={i} className={`rounded-3xl p-xl flex flex-col transition-transform duration-300 hover:-translate-y-2 border ${p.primary ? 'bg-primary text-on-primary border-primary shadow-2xl scale-105 z-20 relative' : 'bg-surface border-outline-variant relative z-10'}`}>
            <h3 className="font-headline-sm font-bold mb-xs">{p.name}</h3>
            <p className={`font-body-sm mb-lg ${p.primary ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>{p.desc}</p>
            
            <div className="mb-xl">
              <span className="font-headline-lg text-4xl font-black">{p.price}</span>
              <span className={`font-label-md ml-xs ${p.primary ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>{p.period}</span>
            </div>
            
            <ul className="space-y-md mb-xl flex-1">
              {p.features.map((f, j) => (
                <li key={j} className="flex items-center gap-sm font-body-md">
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                  {f}
                </li>
              ))}
            </ul>
            
            <button className={`w-full py-md rounded-full font-label-md font-bold transition-opacity hover:opacity-90 ${p.primary ? 'bg-white text-primary' : 'bg-surface-container-high text-on-surface'}`}>
              {p.cta}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
});
