import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../store/authStore.js';
import { supabase, getAgencyId } from '../lib/supabaseClient.js';
import { useToast } from '../context/ToastContext.jsx';
import { settingsService } from '../services/resourceService.js';
import ImageUploadInput from '../components/common/ImageUploadInput.jsx';
import { getActivityLogs, clearActivityLogs, logActivity } from '../services/activityLogService.js';
import { resetAllDataToZero } from '../services/proposalService.js';
import { getTeam, inviteMember, removeMember, updateMemberRole } from '../services/teamService.js';

// ---- Fetch Functions ----
const fetchAgency = async () => {
  if (!supabase) return { name: 'Demo Agency', slug: 'voyanta-demo' };
  const agencyId = getAgencyId();
  const { data, error } = await supabase.from('agencies').select('*').eq('id', agencyId).maybeSingle();
  if (error) throw error;
  return data || { name: 'My Agency', slug: 'my-agency' };
};

const fetchSubscription = async () => {
  if (!supabase) return { plan: localStorage.getItem('voyanta_active_plan') || 'Starter' };
  const agencyId = getAgencyId();
  const { data, error } = await supabase.from('subscriptions').select('*').eq('agency_id', agencyId).maybeSingle();
  if (error) throw error;
  return data || { plan: localStorage.getItem('voyanta_active_plan') || 'Starter' };
};

const fetchActivityLogs = async () => {
  if (!supabase) return getActivityLogs();
  const agencyId = getAgencyId();
  const { data, error } = await supabase.from('activity_logs').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false }).limit(20);
  if (error) throw error;
  return data || [];
};

// ---- Components ----
export default function SettingsPage() {
  const { user, isDemo, signOut } = useAuthStore();
  const [activeTab, setActiveTab] = useState('plan');
  const [localPlan, setLocalPlan] = useState(() => localStorage.getItem('voyanta_active_plan') || 'Starter');
  
  useEffect(() => {
    const handlePlanUpdate = () => {
      setLocalPlan(localStorage.getItem('voyanta_active_plan') || 'Starter');
    };
    window.addEventListener('voyanta:plan-updated', handlePlanUpdate);
    return () => window.removeEventListener('voyanta:plan-updated', handlePlanUpdate);
  }, []);

  const { data: subscription } = useQuery({ queryKey: ['subscription'], queryFn: fetchSubscription });
  const isEnterprise = localPlan === 'Enterprise' || subscription?.plan === 'Enterprise';

  return (
    <div className="space-y-6">
      {/* Settings Header Card */}
      <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant shadow-sm flex flex-wrap items-center justify-between gap-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-on-surface m-0">Settings</h1>
          <p className="text-xs text-on-surface-variant m-0 mt-1">
            Configure your travel agency parameters, invoice formats, legal items, team permissions, and billing tier.
          </p>
        </div>
      </div>

      {/* Horizontal Tabs */}
      <div className="flex flex-wrap border-b border-outline-variant gap-2 bg-surface-container-lowest p-3 rounded-2xl border border-outline-variant">
        {[
          { id: 'plan', label: 'My Plan & Billing', icon: 'star' },
          { id: 'profile', label: 'My Profile', icon: 'person' },
          { id: 'branding', label: 'Agency Branding', icon: 'palette' },
          { id: 'team', label: 'Team Management', icon: 'group' },
          { id: 'logs', label: 'Activity Logs', icon: 'list_alt' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 border-none cursor-pointer transition-all ${
              activeTab === tab.id 
                ? 'bg-primary text-white shadow-sm' 
                : 'bg-transparent text-on-surface-variant hover:bg-surface-container'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Main Settings Display */}
      <div className="bg-surface-container-lowest p-6 rounded-3xl border border-outline-variant shadow-sm">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="w-full"
          >
            {activeTab === 'plan' && <PlanSettings subscription={subscription} />}
            {activeTab === 'profile' && <ProfileSettings user={user} signOut={signOut} isDemo={isDemo} isEnterprise={isEnterprise} />}
            {activeTab === 'branding' && <BrandingSettings />}
            {activeTab === 'team' && <TeamSettings />}
            {activeTab === 'logs' && <ActivityLogs />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---- Sub Pages ----

function PlanSettings({ subscription }) {
  const toast = useToast();
  const [activePlan, setActivePlan] = useState(() => localStorage.getItem('voyanta_active_plan') || subscription?.plan || 'Starter');
  const [billingCycle, setBillingCycle] = useState('monthly');

  const handleSwitchPlan = async (planName) => {
    localStorage.setItem('voyanta_active_plan', planName);
    setActivePlan(planName);
    window.dispatchEvent(new CustomEvent('voyanta:plan-updated'));
    logActivity('subscription', `Switched active subscription tier to ${planName} from Settings`);
    toast.success(`Switched to ${planName} Plan! Features and limits updated immediately.`);
    if (supabase) {
      try {
        const agencyId = getAgencyId();
        await supabase.from('subscriptions').upsert({
          agency_id: agencyId,
          plan: planName,
          status: 'active'
        }).catch(() => {});
      } catch {}
    }
  };

  const plans = [
    {
      name: 'Starter',
      monthlyPrice: '₹999 / mo',
      yearlyPrice: '₹799 / mo (₹9,588/yr)',
      allows: ['50 proposals / month', 'Client CRM & Address Book', 'Invoicing & Payment reminders', 'AI Vault & 16 Basic templates'],
      restricts: ['AI Rewrite & Review Locked', 'AI Cost Optimizer Locked'],
    },
    {
      name: 'Professional',
      badge: 'Most Popular ⭐',
      monthlyPrice: '₹2,999 / mo',
      yearlyPrice: '₹2,399 / mo (₹28,788/yr)',
      allows: ['200 proposals / month', 'AI Proposal Rewrite & Review', 'Everything in Starter', '80 Premium templates'],
      restricts: ['AI Cost Optimizer Locked'],
    },
    {
      name: 'Professional Plus',
      monthlyPrice: '₹3,999 / mo',
      yearlyPrice: '₹3,199 / mo (₹38,388/yr)',
      allows: ['Unlimited proposals', 'AI Curated Itinerary Generator', 'AI Cost Optimizer', 'Full White-label export'],
      restricts: [],
    },
    {
      name: 'Enterprise',
      monthlyPrice: '₹7,999 / mo',
      yearlyPrice: '₹6,399 / mo (₹76,788/yr)',
      allows: ['Up to 5 multi-agent sub-accounts', 'Dedicated Account Manager', 'Custom extra sections auto-fill', 'Custom API integrations'],
      restricts: [],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h3 className="text-2xl font-serif font-bold">Plan & Billing</h3>
          <p className="text-xs text-on-surface-variant m-0 mt-1">Manage your subscription and upgrade anytime</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="inline-flex items-center bg-surface-container rounded-xl p-1 border border-outline-variant">
            <button
              onClick={() => setBillingCycle('monthly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer ${billingCycle === 'monthly' ? 'bg-primary text-white shadow-sm' : 'bg-transparent text-on-surface-variant'}`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingCycle('yearly')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1 ${billingCycle === 'yearly' ? 'bg-primary text-white shadow-sm' : 'bg-transparent text-on-surface-variant'}`}
            >
              Yearly <span className="text-[10px] bg-amber-400 text-black px-1.5 py-0.5 rounded font-black">20% OFF</span>
            </button>
          </div>
          <span className="px-4 py-1.5 bg-primary/10 text-primary font-bold rounded-full text-sm">
            Active Tier: <span className="underline">{activePlan}</span>
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((p) => {
          const isCurrent = activePlan === p.name;
          return (
            <div key={p.name} className={`p-6 rounded-2xl border flex flex-col justify-between transition-all ${isCurrent ? 'bg-primary/5 border-primary shadow-lg ring-2 ring-primary/20' : 'bg-surface-container border-outline-variant hover:border-outline'}`}>
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h4 className="text-lg font-bold font-serif m-0">{p.name}</h4>
                    {p.badge && <span className="text-[10px] font-extrabold text-amber-500 uppercase tracking-wider">{p.badge}</span>}
                  </div>
                  {isCurrent && <span className="bg-black text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">Current</span>}
                </div>
                <div className="text-xl font-black mb-4 text-primary">
                  {billingCycle === 'yearly' ? p.yearlyPrice : p.monthlyPrice}
                </div>
                
                <div className="space-y-2 mb-6">
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Included:</p>
                  <ul className="space-y-1.5 text-xs">
                    {p.allows.map((allow, i) => (
                      <li key={i} className="flex items-center gap-2 text-on-surface">
                        <span className="material-symbols-outlined text-[16px] text-green-600">check_circle</span>
                        <span>{allow}</span>
                      </li>
                    ))}
                  </ul>
                  {p.restricts.length > 0 && (
                    <>
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mt-4">Restrictions:</p>
                      <ul className="space-y-1.5 text-xs">
                        {p.restricts.map((rest, i) => (
                          <li key={i} className="flex items-center gap-2 text-on-surface-variant opacity-80">
                            <span className="material-symbols-outlined text-[16px] text-error">lock</span>
                            <span>{rest}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleSwitchPlan(p.name)}
                disabled={isCurrent}
                className={`w-full py-2.5 rounded-xl font-bold text-xs transition-all border-none ${isCurrent ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-primary text-on-primary hover:bg-primary/90 shadow-md cursor-pointer'}`}
              >
                {isCurrent ? 'Active Plan' : `Switch to ${p.name}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ProfileSettings({ user, signOut, isDemo, isEnterprise }) {
  const rawAgencyId = getAgencyId() || '0001';
  const rawUserId = user?.id || '0001';

  // Calculate Voyanta ID: VOY-{MMM}-{YYYY}-{digit from 0001}
  const createdDate = user?.created_at ? new Date(user.created_at) : new Date();
  const monthStr = createdDate.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const yearStr = createdDate.getFullYear();
  const userNums = (String(rawUserId).match(/\d+/g) || ['0001']).join('');
  const userDigit = userNums.slice(-4).padStart(4, '0');
  const voyantaId = `VOY-${monthStr}-${yearStr}-${userDigit === '0000' ? '0001' : userDigit}`;

  // Calculate Agency ID: {Agency name's first 3 letters}-digit from 0001
  let agencyName = 'Voyanta';
  try {
    const rawSet = localStorage.getItem('voyanta_settings_data');
    if (rawSet) {
      const parsed = JSON.parse(rawSet);
      if (parsed.agency_name) agencyName = parsed.agency_name;
    }
  } catch {}
  if (agencyName === 'Voyanta' || !agencyName.trim()) {
    try {
      const rawBrand = localStorage.getItem('voyanta_agency_branding');
      if (rawBrand) {
        const parsedB = JSON.parse(rawBrand);
        if (parsedB.agency_name) agencyName = parsedB.agency_name;
      }
    } catch {}
  }
  const agencyNums = (String(rawAgencyId).match(/\d+/g) || ['0001']).join('');
  const agencyDigit = agencyNums.slice(-4).padStart(4, '0');
  const first3 = (agencyName.replace(/[^a-zA-Z]/g, '') || 'VOY').slice(0, 3).toUpperCase().padEnd(3, 'X');
  const agencyId = `${first3}-${agencyDigit === '0000' ? '0001' : agencyDigit}`;

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-serif font-bold">My Profile</h3>
      <div className="p-6 bg-surface-container rounded-xl border border-outline-variant space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-on-surface-variant">Name</label>
            <div className="mt-1 text-on-surface font-medium">{user?.user_metadata?.full_name || (isDemo ? 'Demo User' : 'Voyanta Agent')}</div>
          </div>
          <div>
            <label className="text-sm font-medium text-on-surface-variant">Email</label>
            <div className="mt-1 text-on-surface font-medium">{user?.email || 'Demo Session'}</div>
          </div>
        </div>

        <div className="pt-4 border-t border-outline-variant space-y-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">Unique Identifiers (Read-Only)</div>
          <p className="text-xs text-on-surface-variant">These unique IDs identify your account and agency for administrative and backend operations.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-3 bg-surface rounded-lg border border-outline-variant">
              <div className="text-xs font-medium text-on-surface-variant mb-1 flex items-center justify-between">
                <span>Voyanta ID (User ID)</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded font-mono">Unique</span>
              </div>
              <div className="font-mono text-xs text-on-surface select-all break-all">{voyantaId}</div>
            </div>
            {isEnterprise ? (
              <div className="p-3 bg-surface rounded-lg border border-outline-variant">
                <div className="text-xs font-medium text-on-surface-variant mb-1 flex items-center justify-between">
                  <span>Agency ID (Tenant ID)</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-secondary/10 text-secondary rounded font-mono">Agency</span>
                </div>
                <div className="font-mono text-xs text-on-surface select-all break-all">{agencyId}</div>
              </div>
            ) : (
              <div className="p-3 bg-surface rounded-lg border border-outline-variant flex flex-col justify-between h-full opacity-60">
                <div className="text-xs font-medium text-on-surface-variant mb-1">
                  <span>Agency ID (Tenant ID)</span>
                </div>
                <div className="text-[10px] text-primary font-bold">🔒 Only visible to Enterprise users</div>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-outline-variant flex justify-end">
          <button onClick={signOut} className="text-error font-medium hover:underline">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamSettings() {
  const { user } = useAuthStore();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [activePlan, setActivePlan] = useState(() => localStorage.getItem('voyanta_active_plan') || 'Starter');
  const isEnterprise = activePlan === 'Enterprise';

  const { data: teamData, isLoading } = useQuery({
    queryKey: ['team'],
    queryFn: () => getTeam(),
  });

  const teamMembers = teamData?.members || [];
  const teamInvites = teamData?.invitations || [];
  const combinedTeam = [...teamMembers, ...teamInvites];

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteRole, setInviteRole] = useState('Editor');

  useEffect(() => {
    const handler = () => setActivePlan(localStorage.getItem('voyanta_active_plan') || 'Starter');
    window.addEventListener('voyanta:plan-updated', handler);
    return () => window.removeEventListener('voyanta:plan-updated', handler);
  }, []);

  const inviteMutation = useMutation({
    mutationFn: (newMember) => inviteMember(newMember),
    onSuccess: (res) => {
      queryClient.invalidateQueries(['team']);
      logActivity('team', `Added agent ${res.email} with ${res.role} permissions`);
      toast.success(`Agent ${res.email} added successfully (${res.role} Access)!`);
      setInviteEmail('');
      setInviteName('');
      setInvitePassword('');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to add agent');
    }
  });

  const handleInvite = (e) => {
    e.preventDefault();
    if (!inviteEmail || !invitePassword) {
      toast.error('Please enter Agent Gmail ID and Password');
      return;
    }
    inviteMutation.mutate({ 
      email: inviteEmail, 
      name: inviteName || 'Travel Agent', 
      password: invitePassword,
      role: inviteRole,
      can_delete: inviteRole === 'Admin'
    });
  };

  const removeMutation = useMutation({
    mutationFn: ({ id, isInvite }) => removeMember(id, isInvite),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries(['team']);
      logActivity('team', `Removed team member (ID: ${id})`);
      toast.info('Team member removed.');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to remove team member');
    }
  });

  const handleRemove = (id, isInvite) => {
    removeMutation.mutate({ id, isInvite });
  };

  const roleMutation = useMutation({
    mutationFn: ({ id, newRole, isInvite }) => updateMemberRole(id, newRole, isInvite),
    onSuccess: (_, { newRole }) => {
      queryClient.invalidateQueries(['team']);
      logActivity('team', `Updated role for team member to ${newRole}`);
      toast.success(`Role updated to ${newRole}.`);
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to update role');
    }
  });

  const handleRoleChange = (id, newRole, isInvite) => {
    roleMutation.mutate({ id, newRole, isInvite });
  };

  if (!isEnterprise) {
    return (
      <div className="relative space-y-6 animate-fade-in">
        <div className="filter blur-[6px] pointer-events-none opacity-40 select-none transition-all duration-500">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-2xl font-serif font-bold text-primary">Team Management & RBAC</h3>
              <p className="text-xs text-on-surface-variant">Assign Admin or Editor roles to control proposal management and deletion permissions.</p>
            </div>
            <span className="px-3 py-1 bg-primary/10 text-primary rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">lock</span> Enterprise Feature
            </span>
          </div>

          <div className="p-6 bg-surface-container rounded-xl border border-outline-variant mb-6">
            <h4 className="text-base font-bold mb-3">Invite New Travel Designer</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="h-10 bg-surface rounded-lg border border-outline-variant"></div>
              <div className="h-10 bg-surface rounded-lg border border-outline-variant"></div>
              <div className="h-10 bg-surface rounded-lg border border-outline-variant"></div>
              <div className="h-10 bg-primary/30 rounded-lg"></div>
            </div>
          </div>

          <div className="bg-surface-container rounded-xl border border-outline-variant p-6 space-y-4">
            <h4 className="text-base font-bold mb-2">Active Team Members</h4>
            <div className="h-16 bg-surface rounded-xl border border-outline-variant flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20"></div>
                <div className="space-y-1"><div className="w-32 h-4 bg-on-surface/20 rounded"></div><div className="w-48 h-3 bg-on-surface/10 rounded"></div></div>
              </div>
            </div>
            <div className="h-16 bg-surface rounded-xl border border-outline-variant flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/20"></div>
                <div className="space-y-1"><div className="w-40 h-4 bg-on-surface/20 rounded"></div><div className="w-56 h-3 bg-on-surface/10 rounded"></div></div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute inset-0 flex items-center justify-center z-20 p-4">
          <div className="bg-surface/85 dark:bg-surface/90 backdrop-blur-2xl p-8 rounded-[28px] border border-outline-variant/60 shadow-2xl max-w-lg w-full text-center transform hover:scale-[1.01] transition-all duration-300">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-primary/20 to-primary/5 border border-primary/20 text-primary flex items-center justify-center mx-auto mb-5 shadow-inner">
              <span className="material-symbols-outlined text-[40px] animate-pulse">lock</span>
            </div>
            <h4 className="text-2xl font-serif font-extrabold text-primary mb-2">Team Management & RBAC</h4>
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              Role-Based Access Control (Admin vs. Editor permissions) and multi-designer collaboration are exclusively unlocked on the <strong className="text-primary font-bold">Enterprise Plan</strong>. Your agency is currently on the <strong className="uppercase tracking-wider px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-bold">{activePlan}</strong> tier.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('voyanta_active_plan', 'Enterprise');
                  setActivePlan('Enterprise');
                  window.dispatchEvent(new CustomEvent('voyanta:plan-updated'));
                  toast.success('Upgraded to Enterprise Plan! Team Management is now unlocked.');
                }}
                className="px-6 py-3.5 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-on-primary font-bold rounded-xl shadow-lg hover:shadow-primary/25 hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2 cursor-pointer w-full sm:w-auto"
              >
                <span className="material-symbols-outlined text-[20px]">rocket_launch</span>
                Upgrade to Enterprise Now
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-serif font-bold">Team Management & RBAC</h3>
          <p className="text-xs text-on-surface-variant">Assign Admin or Editor roles to control proposal management and deletion permissions.</p>
        </div>
        <span className="px-3 py-1 bg-green-500/10 text-green-600 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">verified</span> Enterprise Unlocked
        </span>
      </div>
      
      <div className="p-6 bg-surface-container rounded-xl border border-outline-variant space-y-3">
        <div className="flex justify-between items-center">
          <h4 className="text-base font-bold flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">person_add</span>
            Add Enterprise Agent Credentials
          </h4>
          <span className="text-[11px] text-on-surface-variant bg-surface-container-highest px-2.5 py-1 rounded-full font-medium">
            Set Gmail ID & Password for Enterprise Agents
          </span>
        </div>
        
        <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input 
            type="text" 
            placeholder="Agent Full Name" 
            value={inviteName}
            onChange={e => setInviteName(e.target.value)}
            className="px-3 py-2 border border-outline rounded-lg bg-white text-sm focus:border-primary outline-none"
            required
          />
          <input 
            type="email" 
            placeholder="agent.gmail@gmail.com" 
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            className="px-3 py-2 border border-outline rounded-lg bg-white text-sm focus:border-primary outline-none"
            required
          />
          <input 
            type="password" 
            placeholder="Agent Password" 
            value={invitePassword}
            onChange={e => setInvitePassword(e.target.value)}
            className="px-3 py-2 border border-outline rounded-lg bg-white text-sm focus:border-primary outline-none"
            required
          />
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}
            className="px-3 py-2 border border-outline rounded-lg bg-white text-sm focus:border-primary outline-none font-medium"
          >
            <option value="Admin">Full Access (Includes Delete)</option>
            <option value="Editor">Partial Access (No Delete)</option>
          </select>
          <button type="submit" className="px-4 py-2 bg-primary text-on-primary rounded-lg font-bold text-sm hover:bg-primary/90 transition-colors shadow-sm cursor-pointer flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-[16px]">add_task</span>
            Add Agent
          </button>
        </form>
      </div>

      <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-surface-container-highest border-b border-outline-variant">
            <tr>
              <th className="p-4 font-medium text-on-surface-variant text-xs uppercase tracking-wider">Member</th>
              <th className="p-4 font-medium text-on-surface-variant text-xs uppercase tracking-wider">Role & Permissions</th>
              <th className="p-4 font-medium text-on-surface-variant text-xs uppercase tracking-wider">Status</th>
              <th className="p-4 font-medium text-on-surface-variant text-xs uppercase tracking-wider text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {isLoading ? (
              <tr>
                <td colSpan="4" className="p-8 text-center text-on-surface-variant font-medium">
                  Loading team members...
                </td>
              </tr>
            ) : combinedTeam.length === 0 ? (
              <tr>
                <td colSpan="4" className="p-8 text-center text-on-surface-variant font-medium">
                  No team members found.
                </td>
              </tr>
            ) : combinedTeam.map(member => {
              const isOwnerOrSelf = member.role === 'Owner' || member.role === 'owner' || member.email?.toLowerCase() === user?.email?.toLowerCase() || member.id === user?.id || member.email?.toLowerCase() === 'raman@voyanta.com';
              return (
              <tr key={member.id} className="hover:bg-surface-container-highest/50 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-on-surface text-sm flex items-center gap-2">
                    {member.name}
                    {member.isInvite && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase font-bold">Pending</span>}
                    {isOwnerOrSelf && <span className="text-[10px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded uppercase font-bold">Agency Owner</span>}
                  </div>
                  <div className="text-xs text-on-surface-variant">{member.email}</div>
                </td>
                <td className="p-4">
                  {isOwnerOrSelf ? (
                    <div>
                      <span className="px-2.5 py-1 bg-primary/10 text-primary rounded-md font-bold text-xs flex items-center gap-1.5 w-fit">
                        <span className="material-symbols-outlined text-[15px]">shield_person</span> Owner / Default Admin (Full Access)
                      </span>
                      <div className="text-[10px] text-on-surface-variant mt-0.5">
                        Default agency creator with permanent full administrative and deletion access
                      </div>
                    </div>
                  ) : (
                    <>
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value, member.isInvite)}
                        className="px-2 py-1 rounded bg-white border border-outline text-xs font-bold text-primary cursor-pointer"
                      >
                        <option value="Editor">Editor (No Delete)</option>
                        <option value="Admin">Admin (Full Access)</option>
                      </select>
                      <div className="text-[10px] text-on-surface-variant mt-0.5">
                        {member.role === 'Admin' ? 'Can edit, send & delete proposals' : 'Can edit & send, cannot delete'}
                      </div>
                    </>
                  )}
                </td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${member.status === 'Active' ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'}`}>
                    {member.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  {isOwnerOrSelf ? (
                    <span className="text-[10px] text-on-surface-variant italic">Permanent Admin</span>
                  ) : (
                    <button type="button" onClick={() => handleRemove(member.id, member.isInvite)} className="text-error text-xs font-bold hover:underline">
                      {member.isInvite ? 'Revoke Invite' : 'Revoke Access'}
                    </button>
                  )}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BrandingSettings() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useQuery({ queryKey: ['agency_settings'], queryFn: () => settingsService.get() });
  const [form, setForm] = useState(null);
  const [activeSubTab, setActiveSubTab] = useState('general');

  const current = form || settings || {};
  const upd = (k) => (e) => setForm((s) => ({ ...(s || settings || {}), [k]: e.target.value }));
  const safeStr = (v) => Array.isArray(v) ? v.join('\n') : (v && typeof v === 'object' ? String(v.url || v.src || v.text || v.label || JSON.stringify(v)) : String(v ?? ''));

  const renderWatermarkTargets = () => {
    const targets = Array.isArray(current.watermark_targets) ? current.watermark_targets : ['invoice', 'receipt', 'proposal'];
    return (
      <div className="md:col-span-2 bg-surface p-4 rounded-xl border border-outline-variant mt-1 space-y-2.5 shadow-sm">
        <label className="block text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm">filter_center_focus</span>
          Where do you want to show the Watermark?
        </label>
        <p className="text-xs text-on-surface-variant">Select exactly which generated documents will embed the watermark across your agency.</p>
        <div className="flex flex-wrap items-center gap-6 pt-1">
          {[
            { id: 'invoice', label: 'Invoices', icon: 'receipt_long' },
            { id: 'receipt', label: 'Payment Receipts', icon: 'payments' },
            { id: 'proposal', label: 'Proposals & Itineraries', icon: 'flight_takeoff' }
          ].map(item => {
            const checked = targets.includes(item.id);
            return (
              <label key={item.id} className="flex items-center gap-2 cursor-pointer select-none text-sm font-semibold text-on-surface hover:text-primary transition-colors">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => {
                    const next = checked ? targets.filter(t => t !== item.id) : [...targets, item.id];
                    setForm(s => ({ ...(s || settings || {}), watermark_targets: next }));
                  }}
                  className="w-4 h-4 text-primary rounded border-outline-variant focus:ring-primary cursor-pointer"
                />
                <span className="material-symbols-outlined text-base text-primary">{item.icon}</span>
                <span>{item.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  const mutation = useMutation({
    mutationFn: (newSettings) => settingsService.update(newSettings),
    onSuccess: () => {
      toast.success('Agency branding updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['agency_settings'] });
    },
    onError: (err) => toast.error('Failed to save branding: ' + err.message)
  });

  if (isLoading) return <div>Loading agency branding...</div>;

  const SubTab = ({ id, label, icon }) => (
    <button
      onClick={() => setActiveSubTab(id)}
      className={`px-4 py-2 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${activeSubTab === id ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
      {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-end">
        <h3 className="text-2xl font-serif font-bold">Agency Branding</h3>
        <button onClick={() => mutation.mutate(current)} disabled={mutation.isPending} className="px-6 py-2 bg-primary text-on-primary rounded-lg font-bold shadow-md hover:shadow-lg hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">save</span>
          {mutation.isPending ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="flex border-b border-outline-variant mb-6 overflow-x-auto hide-scrollbar">
        <SubTab id="general" label="General Info" icon="storefront" />
        <SubTab id="theme" label="Theme & Layout" icon="palette" />
        <SubTab id="legal" label="Legal & Tax" icon="gavel" />
        <SubTab id="social" label="Social Links" icon="share" />
      </div>

      <div className="p-6 bg-surface-container rounded-xl border border-outline-variant min-h-[400px]">
        {activeSubTab === 'general' && (
          <div className="space-y-6 animate-fade-in">
            <h4 className="text-lg font-serif font-bold text-on-surface mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">storefront</span>
              Basic Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-on-surface-variant mb-1">Agency Name</label>
                <input type="text" value={safeStr(current.agency_name)} onChange={upd('agency_name')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white" />
              </div>
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                <ImageUploadInput
                  label="Agency Logo"
                  value={safeStr(current.logo_url)}
                  onChange={(val) => setForm(s => ({ ...(s || settings || {}), logo_url: val }))}
                  placeholder="https://example.com/logo.png or upload..."
                  hideStockSearch={true}
                />
                <ImageUploadInput
                  label="Cover Image"
                  value={safeStr(current.cover_image_url)}
                  onChange={(val) => setForm(s => ({ ...(s || settings || {}), cover_image_url: val }))}
                  placeholder="https://example.com/cover.jpg or upload..."
                  hideStockSearch={true}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1">Contact Email</label>
                <input type="email" value={safeStr(current.contact_email)} onChange={upd('contact_email')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white" />
              </div>
              <div>
                <label className="block text-sm font-medium text-on-surface-variant mb-1">Contact Phone</label>
                <input type="text" value={safeStr(current.contact_phone)} onChange={upd('contact_phone')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1">Website</label>
              <input type="text" value={safeStr(current.website)} onChange={upd('website')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white" />
            </div>
            <div>
              <label className="block text-sm font-medium text-on-surface-variant mb-1">Address</label>
              <input type="text" value={safeStr(current.address)} onChange={upd('address')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white" />
            </div>
          </div>
        )}

        {activeSubTab === 'theme' && (
          <div className="space-y-6 animate-fade-in">
            <h4 className="text-lg font-serif font-bold text-on-surface mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">palette</span>
              Brand Colors & Typography
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/60">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Primary Brand Color (Hex)</label>
                <div className="flex gap-2">
                  <input type="color" value={safeStr(current.theme_color)} onChange={upd('theme_color')} className="w-10 h-10 rounded border border-outline cursor-pointer bg-white p-1" />
                  <input type="text" placeholder="#115E59" value={safeStr(current.theme_color)} onChange={upd('theme_color')} className="flex-1 px-4 py-2 border border-outline rounded-lg bg-white text-sm font-mono uppercase" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Secondary / Accent Color</label>
                <div className="flex gap-2">
                  <input type="color" value={safeStr(current.secondary_color)} onChange={upd('secondary_color')} className="w-10 h-10 rounded border border-outline cursor-pointer bg-white p-1" />
                  <input type="text" placeholder="#CBA365" value={safeStr(current.secondary_color)} onChange={upd('secondary_color')} className="flex-1 px-4 py-2 border border-outline rounded-lg bg-white text-sm font-mono uppercase" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Header Font (Serif/Display)</label>
                <input type="text" placeholder="Playfair Display, serif" value={safeStr(current.font_header)} onChange={upd('font_header')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Body Font (Sans)</label>
                <input type="text" placeholder="Inter, sans-serif" value={safeStr(current.font_body)} onChange={upd('font_body')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm" />
              </div>
            </div>

            <h4 className="text-lg font-serif font-bold text-on-surface mt-6 mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">article</span>
              Document Layout Defaults
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/60">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Default Base Template</label>
                <select value={safeStr(current.default_template) || 'EditorialTemplate'} onChange={upd('default_template')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm font-semibold text-primary focus:outline-none focus:border-primary">
                  <option value="EditorialTemplate">Editorial Vogue (Classic)</option>
                  <option value="LuxuryThemeEngine">Luxury Theme Engine (Dynamic Config)</option>
                  <option value="ZenTemplate">Zen Minimalist (Clean)</option>
                  <option value="BaseTemplate">Standard Corporate</option>
                  <option value="EcoSanctuaryTemplate">Eco Sanctuary (Nature)</option>
                  <option value="AlpineTemplate">Alpine Retreat (Snow/Mountains)</option>
                  <option value="DesertTemplate">Desert Mirage (Warm/Sands)</option>
                  <option value="TropicTemplate">Tropic Paradise (Beaches)</option>
                  <option value="AegeanTemplate">Aegean Coastal (Blue/White)</option>
                  <option value="SafariTemplate">Safari Expedition (Earthy)</option>
                  <option value="MaharajaTemplate">Maharaja Heritage (Royal Indian)</option>
                  <option value="NordicTemplate">Nordic Aurora (Dark Minimal)</option>
                  <option value="CosmopolitanTemplate">Cosmopolitan (City Chic)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Margin Size</label>
                <select value={safeStr(current.margin_size)} onChange={upd('margin_size')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm">
                  <option value="Small">Small (Compact)</option>
                  <option value="Standard">Standard (Recommended)</option>
                  <option value="Large">Large (Spacious/Editorial)</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Document Watermark Text</label>
                <input type="text" placeholder="e.g. APPROVED or CONFIDENTIAL or VOYANTA LUXURY" value={safeStr(current.watermark_text)} onChange={upd('watermark_text')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm font-bold tracking-widest uppercase text-slate-700" />
              </div>
              {renderWatermarkTargets()}
            </div>
          </div>
        )}

        {activeSubTab === 'legal' && (
          <div className="space-y-6 animate-fade-in">
            <h4 className="text-lg font-serif font-bold text-on-surface mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">gavel</span>
              Business Legal & Registration Details
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/60">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Company Legal Name</label>
                <input type="text" placeholder="e.g. Voyanta Luxury Travel Ltd." value={safeStr(current.company_legal_name)} onChange={upd('company_legal_name')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm" />
              </div>
              {renderWatermarkTargets()}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Default Tax Rate (%)</label>
                <input type="number" max="50" step="0.5" placeholder="e.g. 5 for GST 5%" value={safeStr(current.default_tax_rate !== undefined ? current.default_tax_rate : 5)} onChange={upd('default_tax_rate')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">GST Number / Tax ID</label>
                <input type="text" placeholder="e.g. 07AAAAA0000A1Z5" value={safeStr(current.gst_number)} onChange={upd('gst_number')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm font-mono font-bold text-primary" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Trade Code / Registration No.</label>
                <input type="text" placeholder="e.g. LIC-DL-2026-8890" value={safeStr(current.trade_code)} onChange={upd('trade_code')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm font-mono" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Branding Position (GST & License)</label>
                <select value={safeStr(current.branding_position) || 'bottom'} onChange={upd('branding_position')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm">
                  <option value="top">Top (Header)</option>
                  <option value="bottom">Bottom (Footer)</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Trademarks & Accreditations</label>
                <input type="text" placeholder="e.g. IATA Approved Agency • TAFI Member • ISO 9001 Certified" value={safeStr(current.trademarks)} onChange={upd('trademarks')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Invoice Default Notes</label>
                <input type="text" placeholder="e.g. Thank you for booking with Voyanta Concierge." value={safeStr(current.invoice_default_notes)} onChange={upd('invoice_default_notes')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm" />
              </div>
              
              <div className="md:col-span-2 pt-4 border-t border-outline-variant/40">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Authentic Payment / UPI QR Code Image</label>
                <p className="text-xs text-on-surface-variant mb-2">Upload your official agency Bank or UPI payment QR code image. This authentic QR code will be embedded directly on all generated invoices and receipts.</p>
                <div className="max-w-xs">
                  <ImageUploadInput
                    label="Upload Payment QR Code"
                    value={safeStr(current.payment_qr_code || localStorage.getItem('voyanta_payment_qr_code') || '')}
                    onChange={(val) => {
                      setForm(s => ({ ...(s || settings || {}), payment_qr_code: val }));
                      try { localStorage.setItem('voyanta_payment_qr_code', val || ''); } catch {}
                    }}
                    hideStockSearch={true}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSubTab === 'social' && (
          <div className="space-y-6 animate-fade-in">
            <h4 className="text-lg font-serif font-bold text-on-surface mb-3 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">share</span>
              Social Media Links
            </h4>
            <p className="text-xs text-on-surface-variant mb-4">
              Add your social media URLs here. When sharing invoices or proposals via email, interactive social logo buttons will automatically appear at the bottom of the email body for the links you provide.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/60">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1 flex items-center gap-1">📘 Facebook URL</label>
                <input type="url" placeholder="https://facebook.com/youragency" value={safeStr(current.social_facebook)} onChange={upd('social_facebook')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1 flex items-center gap-1">📸 Instagram URL</label>
                <input type="url" placeholder="https://instagram.com/youragency" value={safeStr(current.social_instagram)} onChange={upd('social_instagram')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1 flex items-center gap-1">💼 LinkedIn URL</label>
                <input type="url" placeholder="https://linkedin.com/company/youragency" value={safeStr(current.social_linkedin)} onChange={upd('social_linkedin')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm" />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1 flex items-center gap-1">🐦 Twitter / X URL</label>
                <input type="url" placeholder="https://twitter.com/youragency" value={safeStr(current.social_twitter)} onChange={upd('social_twitter')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1 flex items-center gap-1">▶️ YouTube Channel URL</label>
                <input type="url" placeholder="https://youtube.com/@youragency" value={safeStr(current.social_youtube)} onChange={upd('social_youtube')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityLogs() {
  const toast = useToast();
  const [logs, setLogs] = useState([]);
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const loadLogs = async () => {
    try {
      const data = await getActivityLogs();
      setLogs(Array.isArray(data) ? data : []);
    } catch {
      setLogs([]);
    }
  };

  useEffect(() => {
    loadLogs();
    window.addEventListener('voyanta:activity-log-updated', loadLogs);
    return () => window.removeEventListener('voyanta:activity-log-updated', loadLogs);
  }, []);

  const handleClear = async () => {
    if (window.confirm('Are you sure you want to clear all audit & activity logs?')) {
      await clearActivityLogs();
      setLogs([]);
      setPage(0);
      toast.info('Activity logs cleared.');
    }
  };

  const totalPages = Math.max(1, Math.ceil(logs.length / pageSize));
  const paginatedLogs = logs.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-2xl font-serif font-bold">Audit & Activity Logs</h3>
          <p className="text-xs text-on-surface-variant">Real-time chronological log of agency actions, client approvals, modifications, and team changes.</p>
        </div>
        {logs.length > 0 && (
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-1.5 bg-error/10 hover:bg-error/20 text-error font-bold text-xs rounded-lg uppercase tracking-wider transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">delete_sweep</span> Clear Logs
          </button>
        )}
      </div>
      <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden shadow-sm flex flex-col">
        <table className="w-full text-left">
          <thead className="bg-surface-container-highest border-b border-outline-variant">
            <tr>
              <th className="p-4 font-medium text-on-surface-variant text-xs uppercase tracking-wider">Timestamp</th>
              <th className="p-4 font-medium text-on-surface-variant text-xs uppercase tracking-wider">Type / Source</th>
              <th className="p-4 font-medium text-on-surface-variant text-xs uppercase tracking-wider">Action Description</th>
              <th className="p-4 font-medium text-on-surface-variant text-xs uppercase tracking-wider">Client / Entity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {paginatedLogs.map(log => (
              <tr key={log.id} className="hover:bg-surface-container-highest/50 text-sm transition-colors">
                <td className="p-4 whitespace-nowrap text-on-surface-variant text-xs font-mono">{new Date(log.timestamp || log.created_at || Date.now()).toLocaleString()}</td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    log.type === 'approval' ? 'bg-green-500/10 text-green-600' :
                    log.type === 'modification' ? 'bg-amber-500/10 text-amber-600' :
                    log.type === 'pdf' ? 'bg-blue-500/10 text-blue-600' :
                    log.type === 'subscription' ? 'bg-purple-500/10 text-purple-600' : 'bg-surface-container-high text-on-surface'
                  }`}>
                    {log.type || 'System'}
                  </span>
                </td>
                <td className="p-4 font-medium text-on-surface">{log.description || log.action}</td>
                <td className="p-4 text-on-surface-variant text-xs font-semibold">{log.clientName || 'Agency Team'}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan="4" className="p-8 text-center text-on-surface-variant">No activity recorded yet. Create proposals or share links to generate logs.</td></tr>
            )}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div className="px-4 py-3 flex items-center justify-between border-t border-outline-variant bg-surface-container-lowest">
            <span className="text-xs font-semibold text-on-surface-variant">
              Showing {page * pageSize + 1} to {Math.min((page + 1) * pageSize, logs.length)} of {logs.length} entries
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs font-bold text-on-surface disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container transition-colors flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">chevron_left</span> Prev
              </button>
              <span className="px-3 py-1 text-xs font-extrabold text-primary font-mono">
                Page {page + 1} of {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-3 py-1.5 rounded-lg border border-outline-variant bg-surface text-xs font-bold text-on-surface disabled:opacity-40 disabled:cursor-not-allowed hover:bg-surface-container transition-colors flex items-center gap-1"
              >
                Next <span className="material-symbols-outlined text-[16px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
