import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import DpdpConsentBanner from '../components/DpdpConsentBanner.jsx';

const INDIAN_LANDSCAPE_HEROES = [
  {
    url: 'https://images.unsplash.com/photo-1598091383021-15ddea10925d?auto=format&fit=crop&w=2000&q=85',
    caption: 'Dal Lake Shikara & Himalayan Peaks, Srinagar'
  },
  {
    url: 'https://images.unsplash.com/photo-1506461883276-594a12b11cf3?auto=format&fit=crop&w=2000&q=85',
    caption: 'Turquoise Waters of Ladakh Himalayas'
  },
  {
    url: 'https://images.unsplash.com/photo-1706030113693-0104871e2efd?auto=format&fit=crop&w=2000&q=85',
    caption: 'Shri Ram Mandir Grand Architecture, Ayodhya'
  },
  {
    url: 'https://images.unsplash.com/photo-1524492412937-b28074a5d7da?auto=format&fit=crop&w=2000&q=85',
    caption: 'Taj Mahal Monument of Love, Agra'
  },
  {
    url: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=2000&q=85',
    caption: 'Alleppey Backwater Houseboats, Kerala'
  },
  {
    url: 'https://images.unsplash.com/photo-1587474260584-136574528ed5?auto=format&fit=crop&w=2000&q=85',
    caption: 'Pangong Tso Crystal Waters, Ladakh'
  },
  {
    url: 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?auto=format&fit=crop&w=2000&q=85',
    caption: 'Holy Ghats along the Ganges, Varanasi'
  },
  {
    url: 'https://images.unsplash.com/photo-1593693397690-362cb9666fc2?auto=format&fit=crop&w=2000&q=85',
    caption: 'Misty Green Tea Hills, Munnar'
  },
  {
    url: 'https://images.unsplash.com/photo-1514222134-b57cbb8ce073?auto=format&fit=crop&w=2000&q=85',
    caption: 'Lake Palace Twilight Reflection, Udaipur'
  },
  {
    url: 'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?auto=format&fit=crop&w=2000&q=85',
    caption: 'Snow-Capped Spiti Valley & Monasteries, Himachal'
  }
];

export default function LandingPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { demoEnabled, enterDemoMode } = useAuth();
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(0);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [heroImage] = useState(() => INDIAN_LANDSCAPE_HEROES[Math.floor(Math.random() * INDIAN_LANDSCAPE_HEROES.length)]);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleStartDemo = () => {
    navigate('/login?signup=true');
  };

  const workflowDemoSteps = [
    {
      stepNumber: '01',
      title: 'Upload Supplier & Hotel Contracts',
      subtitle: "Your agency's memory, not just your storage.",
      description: 'Drop any supplier rate sheet, hotel PDF, or messy email thread into My Vault. Every document becomes searchable, reusable knowledge.',
      visual: (
        <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 font-bold">
              PDF
            </div>
            <div>
              <div className="font-bold text-sm text-on-surface">Taj_Kashmir_RateSheet_2026.pdf</div>
              <div className="text-xs text-on-surface-variant">Uploaded to My Vault • Srinagar & Pahalgam</div>
            </div>
            <span className="ml-auto px-2.5 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-full">
              SECURE R2
            </span>
          </div>
          <div className="space-y-2 text-xs text-on-surface-variant font-mono bg-white dark:bg-slate-900 p-4 rounded-xl border border-outline-variant">
            <div className="flex justify-between">
              <span>Taj Dal View Srinagar (Luxury Suite)</span>
              <span className="font-bold text-on-surface">₹24,500 / night</span>
            </div>
            <div className="flex justify-between">
              <span>Shikara Ride & Floating Market</span>
              <span className="font-bold text-on-surface">₹3,200 / pax</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      stepNumber: '02',
      title: 'Specify Client Brief & Destination',
      subtitle: 'Built-in smart querying.',
      description: 'Input destination, budget, and dates. Voyanta instantly indexes and queries your uploaded contracts to pull matched supplier prices.',
      visual: (
        <div className="bg-surface-container-low rounded-2xl p-6 border border-outline-variant shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-outline-variant pb-3">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-base">person</span>
              <span className="font-bold text-sm text-on-surface">Client Brief & Preferences</span>
            </div>
            <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-full uppercase tracking-wider">ACTIVE QUERY</span>
          </div>
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-outline-variant">
                <span className="text-on-surface-variant block mb-1">Destination</span>
                <span className="font-bold text-on-surface">Srinagar & Gulmarg, Kashmir</span>
              </div>
              <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-outline-variant">
                <span className="text-on-surface-variant block mb-1">Target Budget</span>
                <span className="font-bold text-on-surface">₹3,00,000 INR Max</span>
              </div>
            </div>
            <div className="p-3 bg-white dark:bg-slate-900 rounded-xl border border-outline-variant">
              <span className="text-on-surface-variant block mb-1">Traveler Preferences</span>
              <span className="font-bold text-on-surface">Likes: CP plans, high-floor luxury rooms. Dislikes: heavy trekking.</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      stepNumber: '03',
      title: 'Sidebar Auto-Populates Matching Rates',
      subtitle: 'The unique motion: matching rates appear as you type.',
      description: 'As you build your proposal, the Vault Sidebar automatically suggests matching hotels and pre-negotiated rates from your contracts. Click once to insert verified prices directly.',
      visual: (
        <div className="bg-surface-container-low rounded-2xl border border-outline-variant shadow-lg overflow-hidden flex flex-col h-[280px]">
          <div className="bg-white dark:bg-slate-950 px-4 py-2 border-b border-outline-variant flex items-center justify-between text-[10px] font-bold text-on-surface">
            <span className="flex items-center gap-1.5"><span className="material-symbols-outlined text-[13px]">edit_document</span> Proposal Builder / Day 1</span>
            <span className="text-primary flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> Live editor</span>
          </div>
          <div className="flex-1 grid grid-cols-12 overflow-hidden">
            <div className="col-span-6 p-3 border-r border-outline-variant space-y-3 overflow-y-auto bg-white/40">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[9px] flex items-center justify-center font-mono">1</span>
                <span className="font-bold text-[10px] text-on-surface">Day 1: Arrival in Srinagar</span>
              </div>
              <div className="p-2.5 bg-white dark:bg-slate-900 border border-outline-variant rounded-xl text-[9px] text-on-surface-variant font-mono space-y-1.5">
                <div className="flex justify-between border-b border-outline-variant pb-1 font-bold text-on-surface">
                  <span>Day 1 Costing</span>
                  <span>₹27,700</span>
                </div>
                <div className="flex justify-between text-[8px] text-emerald-600 dark:text-emerald-400">
                  <span>✓ Taj Dal View (Luxury Suite)</span>
                  <span>₹24,500</span>
                </div>
                <div className="flex justify-between text-[8px]">
                  <span>✓ Private Guided Shikara Ride</span>
                  <span>₹3,200</span>
                </div>
              </div>
              <button className="w-full py-1.5 border border-dashed border-outline-variant text-[9px] text-on-surface-variant font-medium rounded-lg flex items-center justify-center gap-1 bg-white/60">
                <span className="material-symbols-outlined text-[11px]">add</span> Add Itinerary Item
              </button>
            </div>
            <div className="col-span-6 p-2.5 bg-white dark:bg-slate-900 flex flex-col overflow-y-auto space-y-2 select-none">
              <div className="pb-1.5 border-b border-outline-variant flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px] text-primary animate-pulse">auto_awesome</span> Suggested from Vault
                </span>
                <span className="text-[8px] text-emerald-500 font-extrabold font-mono bg-emerald-500/10 px-1 rounded animate-pulse">MATCH</span>
              </div>
              
              <div className="p-2 border border-emerald-500/35 bg-emerald-500/5 rounded-xl flex flex-col gap-1 shadow-sm transition-all duration-300 transform translate-x-0">
                <div className="flex justify-between items-center">
                  <span className="text-[8px] font-bold uppercase tracking-widest bg-blue-50 text-blue-600 border border-blue-200 px-1 rounded">Hotel</span>
                  <span className="text-[8px] text-on-surface-variant font-medium">Srinagar</span>
                </div>
                <div className="font-bold text-[9px] text-on-surface">Taj Dal View Srinagar</div>
                <div className="flex justify-between items-center text-[8px] text-on-surface font-semibold pt-0.5 border-t border-outline-variant/30">
                  <span className="text-emerald-600 dark:text-emerald-400">₹24,500 <span className="text-[7px] text-on-surface-variant font-normal">/ night</span></span>
                  <span className="text-[7px] px-1 bg-emerald-500/10 text-emerald-600 rounded">✓ Lowest Rate (TBO)</span>
                </div>
              </div>

              <div className="p-2 border border-outline-variant bg-surface-container-low rounded-xl flex flex-col gap-1 transition-all duration-300">
                <div className="flex justify-between items-center">
                  <span className="text-[8px] font-bold uppercase tracking-widest bg-green-50 text-green-600 border border-green-200 px-1 rounded">Activity</span>
                  <span className="text-[8px] text-on-surface-variant font-medium">Dal Lake</span>
                </div>
                <div className="font-bold text-[9px] text-on-surface">Private Guided Shikara Ride</div>
                <div className="flex justify-between items-center text-[8px] text-on-surface font-semibold pt-0.5 border-t border-outline-variant/30">
                  <span className="text-primary">₹3,200 <span className="text-[7px] text-on-surface-variant font-normal">/ pax</span></span>
                  <span className="text-[7px] text-on-surface-variant font-normal">Contract Rate</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="min-h-screen bg-surface font-body text-on-surface overflow-x-hidden selection:bg-primary/30">
      
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 px-6 py-4 transition-all duration-300 ${scrolled ? 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-outline-variant shadow-sm' : 'bg-transparent border-b border-transparent'}`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary flex items-center justify-center rounded-xl shadow-lg shadow-primary/20">
              <span className="material-symbols-outlined text-white text-[24px]">travel_explore</span>
            </div>
            <span className="font-display font-bold text-2xl tracking-tight text-primary">Voyanta</span>
          </div>
          
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className={`${scrolled ? 'text-on-surface-variant hover:text-primary' : 'text-slate-900 dark:text-white/90 hover:text-primary dark:hover:text-white'} text-sm font-medium transition-colors`}>Features</a>
            <a href="#how-it-works" className={`${scrolled ? 'text-on-surface-variant hover:text-primary' : 'text-slate-900 dark:text-white/90 hover:text-primary dark:hover:text-white'} text-sm font-medium transition-colors`}>How It Works</a>
            <a href="#pricing" className={`${scrolled ? 'text-on-surface-variant hover:text-primary' : 'text-slate-900 dark:text-white/90 hover:text-primary dark:hover:text-white'} text-sm font-medium transition-colors`}>Pricing</a>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => navigate('/login')} 
              className={`px-4 py-2 ${scrolled ? 'text-on-surface-variant hover:text-primary' : 'text-slate-900 dark:text-white/90 hover:text-primary dark:hover:text-white'} text-sm font-medium transition-colors`}
            >
              Sign In
            </button>
            <button 
              onClick={handleStartDemo}
              className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-white font-medium text-sm rounded-xl shadow-lg shadow-primary/30 hover:shadow-xl hover:-translate-y-0.5 transition-all"
            >
              Start Free Trial
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-[88vh] flex items-center justify-center pt-32 pb-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src={heroImage.url} 
            alt={heroImage.caption} 
            className="w-full h-full object-cover scale-105 transition-all duration-1000" 
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/50 to-surface"></div>
          <div className="absolute bottom-6 right-6 hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white/90 text-xs font-medium shadow-lg">
            <span className="material-symbols-outlined text-sm text-emerald-400">location_on</span>
            <span>{heroImage.caption}</span>
          </div>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold uppercase tracking-widest mb-6 shadow-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            Built for India&apos;s Premium Travel Agencies
          </div>
          
          <h1 className="font-display text-5xl md:text-7xl font-bold text-white mb-6 leading-[1.1] drop-shadow-2xl">
            Your Agency&apos;s Memory, <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-200 via-white to-blue-100">
              Not Just Your Storage
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-white/90 max-w-2xl mb-10 drop-shadow-md font-medium leading-relaxed">
            Stop starting proposals from scratch. Every hotel contract, itinerary, and flight you upload becomes searchable, reusable AI knowledge tailored in your agency’s exact voice.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-14">
            <button 
              onClick={handleStartDemo}
              className="px-8 py-4 bg-white text-primary hover:bg-surface-container-lowest font-bold text-base rounded-2xl shadow-[0_8px_30px_rgba(255,255,255,0.3)] hover:shadow-[0_15px_40px_rgba(255,255,255,0.4)] hover:-translate-y-1 transition-all flex items-center gap-2"
            >
              Start Free Trial
              <span className="material-symbols-outlined">arrow_forward</span>
            </button>
            <a 
              href="#pricing"
              className="px-8 py-4 bg-black/40 backdrop-blur-md border border-white/30 text-white hover:bg-black/50 font-bold text-base rounded-2xl transition-all shadow-lg flex items-center gap-2"
            >
              <span className="material-symbols-outlined">payments</span>
              View Indian Pricing
            </a>
          </div>

          {/* Hero Live Rupee Proposal Preview Card */}
          <div className="w-full max-w-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-white/20 shadow-2xl text-left">
            <div className="flex items-center justify-between border-b border-outline-variant pb-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  VK
                </div>
                <div>
                  <div className="font-bold text-sm text-on-surface">Luxury Kashmir • 6 Days / 5 Nights</div>
                  <div className="text-xs text-on-surface-variant">Srinagar • Gulmarg • Pahalgam</div>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs rounded-full">
                AI OPTIMIZED
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant">
                <div className="text-xs text-on-surface-variant">Supplier Cost</div>
                <div className="font-bold text-sm text-on-surface">₹2,40,000</div>
              </div>
              <div className="p-3 rounded-xl bg-surface-container-low border border-outline-variant">
                <div className="text-xs text-on-surface-variant">Protected Margin</div>
                <div className="font-bold text-sm text-emerald-600 dark:text-emerald-400">+₹48,000 (20%)</div>
              </div>
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                <div className="text-xs text-primary font-medium">Final Client Quote</div>
                <div className="font-bold text-sm text-primary">₹2,88,000</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Row Section */}
      <section className="py-12 px-6 bg-surface-container-lowest border-y border-outline-variant">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              Trusted Across India & Beyond
            </span>
            <h2 className="font-display text-2xl md:text-3xl font-bold text-on-surface mt-1">
              Built for Travel Agencies Across India
            </h2>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                name: 'Kashmir Luxury Escapes',
                location: 'Srinagar & Gulmarg',
                image: 'https://images.unsplash.com/photo-1598091383021-15ddea10925d?auto=format&fit=crop&w=600&q=80',
                tag: '₹2,80,000 Avg Quote'
              },
              {
                name: 'Royal Rajasthan Palaces',
                location: 'Udaipur & Jaipur',
                image: 'https://images.unsplash.com/photo-1599661046289-e31897846e41?auto=format&fit=crop&w=600&q=80',
                tag: '₹4,50,000 Avg Quote'
              },
              {
                name: 'Maldives Island Retreats',
                location: 'Overwater Villas',
                image: 'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=600&q=80',
                tag: '₹6,20,000 Avg Quote'
              },
              {
                name: 'Dubai Luxury Shopping & Dunes',
                location: 'Downtown Dubai',
                image: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80',
                tag: '₹3,40,000 Avg Quote'
              }
            ].map((dest, idx) => (
              <div 
                key={idx} 
                className="group relative h-48 rounded-2xl overflow-hidden border border-outline-variant shadow-md hover:shadow-xl transition-all duration-300"
              >
                <img 
                  src={dest.image} 
                  alt={dest.name} 
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 flex flex-col justify-end">
                  <span className="text-white font-bold text-sm leading-tight">{dest.name}</span>
                  <span className="text-white/75 text-xs">{dest.location}</span>
                  <span className="mt-2 inline-block px-2 py-0.5 bg-white/20 backdrop-blur-md rounded text-[10px] text-white font-bold w-fit">
                    {dest.tag}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Minimalist Agency Logo Placeholders */}
          <div className="mt-12 pt-8 border-t border-outline-variant/60 flex flex-wrap justify-center items-center gap-12 opacity-60">
            <div className="flex items-center gap-2 text-on-surface-variant font-bold text-sm tracking-widest font-mono select-none">
              <span className="material-symbols-outlined text-primary text-[20px]">flight_takeoff</span> KASHMIR TRAVELS
            </div>
            <div className="flex items-center gap-2 text-on-surface-variant font-bold text-sm tracking-widest font-mono select-none">
              <span className="material-symbols-outlined text-primary text-[20px]">architecture</span> RAJASTHAN PALACES
            </div>
            <div className="flex items-center gap-2 text-on-surface-variant font-bold text-sm tracking-widest font-mono select-none">
              <span className="material-symbols-outlined text-primary text-[20px]">beach_access</span> MALDIVES LUXURY
            </div>
            <div className="flex items-center gap-2 text-on-surface-variant font-bold text-sm tracking-widest font-mono select-none">
              <span className="material-symbols-outlined text-primary text-[20px]">apartment</span> DESERT CONCIERGE
            </div>
          </div>

        </div>
      </section>

      {/* Outcome-Focused AI Features Bento Grid */}
      <section id="features" className="py-24 px-6 bg-surface">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
              Outcome-Focused AI Intelligence
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-on-surface mt-3 mb-4">
              Real Mechanisms, Not SaaS Filler
            </h2>
            <p className="text-lg text-on-surface-variant max-w-2xl mx-auto">
              Every tool in Voyanta is engineered to automate the tedious operational work of travel management agencies while keeping you in total control.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* AI Vault */}
            <div className="md:col-span-2 bg-gradient-to-br from-primary/5 to-surface-container-lowest border border-outline-variant rounded-3xl p-8 flex flex-col hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-primary text-2xl">storage</span>
              </div>
              <div className="text-xs font-bold text-primary uppercase tracking-wider mb-1">AI Vault</div>
              <h3 className="font-display text-2xl md:text-3xl font-bold text-on-surface mb-3">
                Save and reuse successful proposals, itineraries, hotels & rates
              </h3>
              <p className="text-on-surface-variant text-base mb-6 max-w-xl">
                Every hotel contract and supplier PDF you upload becomes searchable, reusable knowledge—not a PDF sitting in a folder. Suggestions appear before you even ask.
              </p>
              
              <div className="mt-auto bg-white dark:bg-slate-900 rounded-2xl p-4 border border-outline-variant shadow-md flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-bold text-xs">
                    R2
                  </div>
                  <div>
                    <div className="font-bold text-sm text-on-surface">Verified Hotel Rates Library</div>
                    <div className="text-xs text-on-surface-variant">Instant one-click auto-fill into proposals</div>
                  </div>
                </div>
                <span className="px-3 py-1 bg-primary/10 text-primary font-bold text-xs rounded-full">
                  Live Sync
                </span>
              </div>
            </div>

            {/* AI Rewrite */}
            <div className="bg-gradient-to-br from-surface-container-low to-surface-container-lowest border border-outline-variant rounded-3xl p-8 flex flex-col hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 bg-secondary/10 rounded-2xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-secondary text-2xl">edit_note</span>
              </div>
              <div className="text-xs font-bold text-secondary uppercase tracking-wider mb-1">AI Rewrite</div>
              <h3 className="font-display text-2xl font-bold text-on-surface mb-3">
                Speaks in your agency&apos;s voice
              </h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                Proposals come out formatted the way you already write them. Instantly rewrite proposals in different tones, luxury phrasing, or client-specific styles.
              </p>
            </div>

            {/* AI Proposal Review */}
            <div className="bg-gradient-to-br from-surface-container-low to-surface-container-lowest border border-outline-variant rounded-3xl p-8 flex flex-col hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-amber-600 text-2xl">fact_check</span>
              </div>
              <div className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">AI Proposal Review</div>
              <h3 className="font-display text-2xl font-bold text-on-surface mb-3">
                Built-in sanity checks
              </h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                Checks for missing flights, hotel mismatches, incorrect dates, pricing inconsistencies, visa gaps, and formatting issues before you send to a client.
              </p>
            </div>

            {/* AI Curated Itinerary */}
            <div className="bg-gradient-to-br from-surface-container-low to-surface-container-lowest border border-outline-variant rounded-3xl p-8 flex flex-col hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-blue-600 text-2xl">map</span>
              </div>
              <div className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">AI Curated Itinerary</div>
              <h3 className="font-display text-2xl font-bold text-on-surface mb-3">
                Learns what you hate, automatically
              </h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                Generates destination-specific itineraries based on budget, duration, traveler type, and season. Reject an activity enough times and Voyanta stops suggesting it.
              </p>
            </div>

            {/* AI Cost Optimizer */}
            <div className="bg-gradient-to-br from-surface-container-low to-surface-container-lowest border border-outline-variant rounded-3xl p-8 flex flex-col hover:shadow-xl transition-all duration-300">
              <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center mb-6">
                <span className="material-symbols-outlined text-emerald-600 text-2xl">trending_up</span>
              </div>
              <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">AI Cost Optimizer</div>
              <h3 className="font-display text-2xl font-bold text-on-surface mb-3">
                Always the cheapest verified supplier
              </h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">
                When three suppliers quote the same hotel, Voyanta knows which one is cheapest right now. Suggests alternatives to improve margins while keeping customer value.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Interactive How It Works Section */}
      <section id="how-it-works" className="py-24 px-6 bg-surface-container-lowest border-t border-outline-variant">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
              Interactive Workflow
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-on-surface mt-3 mb-4">
              How Voyanta Works in 3 Steps
            </h2>
            <p className="text-lg text-on-surface-variant max-w-2xl mx-auto">
              See how your documents turn into polished, highly profitable client proposals in seconds.
            </p>
          </div>

          {/* Interactive Step Selector */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5 space-y-4">
              {workflowDemoSteps.map((step, idx) => (
                <div
                  key={idx}
                  onClick={() => setActiveWorkflowStep(idx)}
                  className={`p-6 rounded-2xl border cursor-pointer transition-all duration-300 ${
                    activeWorkflowStep === idx
                      ? 'bg-primary/10 border-primary shadow-md'
                      : 'bg-surface border-outline-variant hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold uppercase tracking-widest text-primary">
                      Step {step.stepNumber}
                    </span>
                    {activeWorkflowStep === idx && (
                      <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse"></span>
                    )}
                  </div>
                  <h3 className="font-display text-xl font-bold text-on-surface mb-1">
                    {step.title}
                  </h3>
                  <p className="text-sm text-on-surface-variant leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Interactive Live Screen Simulation */}
            <div className="lg:col-span-7 bg-surface p-6 sm:p-8 rounded-3xl border border-outline-variant shadow-2xl min-h-[340px] flex flex-col justify-center">
              <div className="flex items-center justify-between border-b border-outline-variant pb-4 mb-6">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-400"></span>
                  <span className="w-3 h-3 rounded-full bg-amber-400"></span>
                  <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
                  <span className="ml-2 text-xs font-mono text-on-surface-variant">voyanta.in/vault-intelligence</span>
                </div>
                <span className="text-xs text-primary font-bold">LIVE SIMULATION</span>
              </div>

              {workflowDemoSteps[activeWorkflowStep].visual}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section (Rupees ₹) */}
      <section id="pricing" className="py-24 px-6 bg-surface">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
              Transparent Indian Pricing
            </span>
            <h2 className="font-display text-4xl md:text-5xl font-bold text-on-surface mt-3 mb-4">
              Simple, Predictable Plans in ₹
            </h2>
            <p className="text-lg text-on-surface-variant max-w-2xl mx-auto mb-8">
              Every plan includes a 14-Day Free Trial with full access. No credit card required upfront.
            </p>

            {/* Monthly / Yearly Switch Toggle */}
            <div className="inline-flex items-center p-1.5 bg-surface-container-low border border-outline-variant rounded-2xl shadow-sm">
              <button
                onClick={() => setBillingCycle('monthly')}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all border-none cursor-pointer ${
                  billingCycle === 'monthly'
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Monthly Billing
              </button>
              <button
                onClick={() => setBillingCycle('yearly')}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold transition-all border-none cursor-pointer flex items-center gap-1.5 ${
                  billingCycle === 'yearly'
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-transparent text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <span>Yearly Billing</span>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-500 text-[10px] font-black uppercase tracking-wider">
                  Save 20% 🔥
                </span>
              </button>
            </div>
          </div>

          {/* 4 Standing Checklist Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            
            {/* Starter */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl p-6 sm:p-8 flex flex-col hover:shadow-xl transition-all duration-300">
              <div>
                <span className="inline-block px-3 py-1 bg-surface-container text-on-surface-variant text-xs font-bold rounded-full mb-4">
                  Starter Plan
                </span>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-display text-4xl font-bold text-on-surface">
                    {billingCycle === 'yearly' ? '₹799' : '₹999'}
                  </span>
                  <span className="text-xs text-on-surface-variant">/ month</span>
                </div>
                <p className="text-xs font-medium text-on-surface-variant mb-4">
                  {billingCycle === 'yearly' ? 'Billed ₹9,588 annually (20% OFF)' : 'Billed monthly'}
                </p>
                <p className="text-xs font-medium text-primary mb-5">
                  New & solo travel agents
                </p>
              </div>

              <div className="h-px bg-outline-variant mb-5"></div>

              <ul className="space-y-3 text-xs text-on-surface-variant mb-8 flex-1">
                <li className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-base">check</span>
                  <span>50 proposals / month</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-base">check</span>
                  <span>CRM & Invoicing</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-base">check</span>
                  <span>Payment reminders</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-base">check</span>
                  <span>AI Vault document storage</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-base">check</span>
                  <span>16 Basic templates</span>
                </li>
              </ul>

              <button
                onClick={handleStartDemo}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors border-none cursor-pointer"
              >
                Start 14-Day Free Trial
              </button>
            </div>

            {/* Professional ⭐ Most Popular */}
            <div className="bg-gradient-to-b from-primary/10 via-surface-container-lowest to-surface-container-lowest border-2 border-primary rounded-3xl p-6 sm:p-8 flex flex-col shadow-xl relative scale-105 z-10">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-white text-xs font-bold uppercase tracking-wider rounded-full shadow-md">
                ⭐ Most Popular
              </div>

              <div>
                <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full mb-4">
                  Professional Plan
                </span>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-display text-4xl font-bold text-on-surface">
                    {billingCycle === 'yearly' ? '₹2,399' : '₹2,999'}
                  </span>
                  <span className="text-xs text-on-surface-variant">/ month</span>
                </div>
                <p className="text-xs font-medium text-on-surface-variant mb-4">
                  {billingCycle === 'yearly' ? 'Billed ₹28,788 annually (20% OFF)' : 'Billed monthly'}
                </p>
                <p className="text-xs font-medium text-primary mb-5">
                  Growing agencies
                </p>
              </div>

              <div className="h-px bg-outline-variant mb-5"></div>

              <ul className="space-y-3 text-xs text-on-surface-variant mb-8 flex-1">
                <li className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                  <span><strong>200 proposals / month</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                  <span>Everything in Starter Plan</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                  <span><strong>AI Proposal Rewrite</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                  <span><strong>AI Proposal Review</strong> (missing details & quality checks)</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-primary text-base">check_circle</span>
                  <span>All 80+ Premium templates</span>
                </li>
              </ul>

              <button
                onClick={handleStartDemo}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/30 transition-all border-none cursor-pointer"
              >
                Start 14-Day Free Trial
              </button>
            </div>

            {/* Professional Plus */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl p-6 sm:p-8 flex flex-col hover:shadow-xl transition-all duration-300">
              <div>
                <span className="inline-block px-3 py-1 bg-surface-container text-on-surface-variant text-xs font-bold rounded-full mb-4">
                  Professional Plus Plan
                </span>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-display text-4xl font-bold text-on-surface">
                    {billingCycle === 'yearly' ? '₹3,199' : '₹3,999'}
                  </span>
                  <span className="text-xs text-on-surface-variant">/ month</span>
                </div>
                <p className="text-xs font-medium text-on-surface-variant mb-4">
                  {billingCycle === 'yearly' ? 'Billed ₹38,388 annually (20% OFF)' : 'Billed monthly'}
                </p>
                <p className="text-xs font-medium text-primary mb-5">
                  High-volume agencies
                </p>
              </div>

              <div className="h-px bg-outline-variant mb-5"></div>

              <ul className="space-y-3 text-xs text-on-surface-variant mb-8 flex-1">
                <li className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-base">check</span>
                  <span><strong>Unlimited proposals</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-base">check</span>
                  <span>Everything in Professional Plan</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-base">check</span>
                  <span><strong>AI Curated Itinerary</strong> generation</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-base">check</span>
                  <span><strong>AI Cost Optimizer</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-base">check</span>
                  <span>Priority onboarding & support</span>
                </li>
              </ul>

              <button
                onClick={handleStartDemo}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors border-none cursor-pointer"
              >
                Start 14-Day Free Trial
              </button>
            </div>

            {/* Enterprise Standing Checklist Card */}
            <div className="bg-surface-container-lowest border border-outline-variant rounded-3xl p-6 sm:p-8 flex flex-col hover:shadow-xl transition-all duration-300">
              <div>
                <span className="inline-block px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-full mb-4">
                  Enterprise Plan
                </span>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="font-display text-4xl font-bold text-on-surface">
                    {billingCycle === 'yearly' ? '₹6,399' : '₹7,999'}
                  </span>
                  <span className="text-xs text-on-surface-variant">/ month</span>
                </div>
                <p className="text-xs font-medium text-on-surface-variant mb-4">
                  {billingCycle === 'yearly' ? 'Billed ₹76,788 annually (20% OFF)' : 'Billed monthly'}
                </p>
                <p className="text-xs font-medium text-primary mb-5">
                  Multi-agent travel agencies
                </p>
              </div>

              <div className="h-px bg-outline-variant mb-5"></div>

              <ul className="space-y-3 text-xs text-on-surface-variant mb-8 flex-1">
                <li className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-base">check</span>
                  <span><strong>Everything in Professional Plus</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-base">check</span>
                  <span><strong>Up to 5 multi-agent sub-accounts</strong></span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-base">check</span>
                  <span>Role-based access control</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-base">check</span>
                  <span>Shared agency CRM & vault</span>
                </li>
                <li className="flex items-center gap-2.5">
                  <span className="material-symbols-outlined text-emerald-600 text-base">check</span>
                  <span>Dedicated concierge & analytics</span>
                </li>
              </ul>

              <button
                onClick={handleStartDemo}
                className="w-full py-3 px-4 rounded-xl font-bold text-xs bg-primary text-white hover:bg-primary/90 shadow-md transition-all border-none cursor-pointer"
              >
                Start 14-Day Free Trial
              </button>
            </div>

          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-primary text-white text-center relative overflow-hidden my-12 max-w-7xl mx-auto rounded-[40px] shadow-2xl">
        <div className="relative z-10 max-w-3xl mx-auto">
          <h2 className="font-display text-4xl md:text-5xl font-bold mb-6">
            Ready to scale your travel business?
          </h2>
          <p className="text-lg text-white/85 mb-10">
            Join modern travel agencies across India using Voyanta to create stunning, highly profitable itineraries.
          </p>
          <button 
            onClick={handleStartDemo}
            className="px-8 py-4 bg-white text-primary hover:bg-surface-container-lowest font-bold text-base rounded-2xl shadow-xl hover:-translate-y-1 transition-all"
          >
            Start Your 14-Day Free Trial
          </button>
        </div>
      </section>

      {/* DPDP Act Compliant Consent Banner */}
      <DpdpConsentBanner />

      {/* Footer */}
      <footer className="py-12 px-6 bg-surface-container-lowest border-t border-outline-variant mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary flex items-center justify-center rounded-lg">
              <span className="material-symbols-outlined text-white text-[18px]">travel_explore</span>
            </div>
            <span className="font-display font-bold text-xl text-primary">Voyanta</span>
          </div>
          <div className="text-xs sm:text-sm text-on-surface-variant">
            &copy; {new Date().getFullYear()} Voyanta Technologies Pvt. Ltd. All rights reserved. Compliant with India DPDP Act 2023.
          </div>
          <div className="flex gap-6 text-sm font-medium">
            <button onClick={() => navigate('/privacy')} className="text-on-surface-variant hover:text-primary transition-colors">Privacy Policy</button>
            <button onClick={() => navigate('/terms')} className="text-on-surface-variant hover:text-primary transition-colors">Terms of Service</button>
            <button onClick={() => navigate('/cookies')} className="text-on-surface-variant hover:text-primary transition-colors">Cookie Policy</button>
          </div>
        </div>
      </footer>
    </div>
  );
}
