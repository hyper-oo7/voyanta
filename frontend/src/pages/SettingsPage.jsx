import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
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
  const { user, isDemo, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('plan');
  
  const { data: subscription } = useQuery({ queryKey: ['subscription'], queryFn: fetchSubscription });
  const isEnterprise = subscription?.plan === 'Enterprise';

  return (
    <div className="flex h-full bg-surface">
      {/* Sidebar Navigation */}
      <div className="w-64 border-r border-outline-variant bg-surface-container-lowest p-6 flex flex-col gap-2">
        <h2 className="text-xl font-serif font-bold text-on-surface mb-6">Settings</h2>
        
        <NavButton active={activeTab === 'plan'} onClick={() => setActiveTab('plan')} icon="⭐">
          My Plan & Billing
        </NavButton>
        <NavButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon="👤">
          My Profile
        </NavButton>
        <NavButton active={activeTab === 'branding'} onClick={() => setActiveTab('branding')} icon="🎨">
          Agency Branding
        </NavButton>
        <NavButton active={activeTab === 'team'} onClick={() => setActiveTab('team')} icon="👥">
          Team Management
        </NavButton>
        <NavButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon="📋">
          Activity Logs
        </NavButton>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-8 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="max-w-4xl"
          >
            {activeTab === 'plan' && <PlanSettings subscription={subscription} />}
            {activeTab === 'profile' && <ProfileSettings user={user} signOut={signOut} isDemo={isDemo} />}
            {activeTab === 'branding' && <BrandingSettings />}
            {activeTab === 'team' && <TeamSettings />}
            {activeTab === 'logs' && <ActivityLogs />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function NavButton({ active, onClick, icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
        active ? 'bg-primary/10 text-primary font-medium' : 'text-on-surface hover:bg-surface-container'
      }`}
    >
      <span>{icon}</span>
      {children}
    </button>
  );
}

// ---- Sub Pages ----

function PlanSettings({ subscription }) {
  const toast = useToast();
  const [activePlan, setActivePlan] = useState(() => localStorage.getItem('voyanta_active_plan') || subscription?.plan || 'Starter');

  const handleSwitchPlan = (planName) => {
    localStorage.setItem('voyanta_active_plan', planName);
    setActivePlan(planName);
    window.dispatchEvent(new CustomEvent('voyanta:plan-updated'));
    logActivity('subscription', `Switched active subscription tier to ${planName} from Settings`);
    toast.success(`Switched to ${planName} Plan! Features and limits updated immediately.`);
  };

  const plans = [
    {
      name: 'Starter',
      price: '$49/mo',
      allows: ['Up to 10 PDF downloads per month', 'Standard templates', 'Basic agency branding'],
      restricts: ['Team Management Locked', 'No Custom Branding Fields', 'No White-labeling'],
    },
    {
      name: 'Professional',
      price: '$129/mo',
      allows: ['Unlimited PDF downloads & proposals', 'Custom Branding Fields Unlocked', 'Priority email support', 'Analytics dashboard'],
      restricts: ['Team Management Locked', 'No White-labeling'],
    },
    {
      name: 'Enterprise',
      price: '$299/mo',
      allows: ['Unlimited PDF downloads & proposals', 'Team Management & RBAC Unlocked', 'Custom Branding Fields Unlocked', 'Full Audit Logs & White-labeling', 'Dedicated account manager'],
      restricts: [],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-serif font-bold">Plan & Billing</h3>
        <span className="px-4 py-1.5 bg-primary/10 text-primary font-bold rounded-full text-sm">
          Active Tier: <span className="underline">{activePlan}</span>
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((p) => {
          const isCurrent = activePlan === p.name;
          return (
            <div key={p.name} className={`p-6 rounded-2xl border flex flex-col justify-between transition-all ${isCurrent ? 'bg-primary/5 border-primary shadow-lg ring-2 ring-primary/20' : 'bg-surface-container border-outline-variant hover:border-outline'}`}>
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-xl font-bold font-serif">{p.name}</h4>
                  {isCurrent && <span className="bg-black text-white text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">Current</span>}
                </div>
                <div className="text-2xl font-black mb-4 text-primary">{p.price}</div>
                
                <div className="space-y-2 mb-6">
                  <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">What's Included:</p>
                  <ul className="space-y-1.5 text-sm">
                    {p.allows.map((allow, i) => (
                      <li key={i} className="flex items-center gap-2 text-on-surface">
                        <span className="material-symbols-outlined text-[18px] text-green-600">check_circle</span>
                        <span>{allow}</span>
                      </li>
                    ))}
                  </ul>
                  {p.restricts.length > 0 && (
                    <>
                      <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mt-4">Restrictions:</p>
                      <ul className="space-y-1.5 text-sm">
                        {p.restricts.map((rest, i) => (
                          <li key={i} className="flex items-center gap-2 text-on-surface-variant opacity-80">
                            <span className="material-symbols-outlined text-[18px] text-error">lock</span>
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
                className={`w-full py-2.5 rounded-xl font-bold text-sm transition-all ${isCurrent ? 'bg-gray-400 text-white cursor-not-allowed' : 'bg-primary text-on-primary hover:bg-primary/90 shadow-md cursor-pointer'}`}
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

function ProfileSettings({ user, signOut, isDemo }) {
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
            <div className="p-3 bg-surface rounded-lg border border-outline-variant">
              <div className="text-xs font-medium text-on-surface-variant mb-1 flex items-center justify-between">
                <span>Agency ID (Tenant ID)</span>
                <span className="text-[10px] px-1.5 py-0.5 bg-secondary/10 text-secondary rounded font-mono">Agency</span>
              </div>
              <div className="font-mono text-xs text-on-surface select-all break-all">{agencyId}</div>
            </div>
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
      logActivity('team', `Invited team member ${res.email} with role ${res.role}`);
      toast.success(`Invitation sent to ${res.email} as ${res.role}!`);
      setInviteEmail('');
      setInviteName('');
    },
    onError: (err) => {
      toast.error(err.message || 'Failed to send invitation');
    }
  });

  const handleInvite = (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    inviteMutation.mutate({ email: inviteEmail, name: inviteName, role: inviteRole });
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
      
      <div className="p-6 bg-surface-container rounded-xl border border-outline-variant">
        <h4 className="text-base font-bold mb-3">Invite New Travel Designer</h4>
        <form onSubmit={handleInvite} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input 
            type="text" 
            placeholder="Agent Name" 
            value={inviteName}
            onChange={e => setInviteName(e.target.value)}
            className="px-3 py-2 border border-outline rounded-lg bg-white text-sm focus:border-primary outline-none"
          />
          <input 
            type="email" 
            placeholder="agent@voyanta.com" 
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            className="px-3 py-2 border border-outline rounded-lg bg-white text-sm focus:border-primary outline-none"
            required
          />
          <select
            value={inviteRole}
            onChange={e => setInviteRole(e.target.value)}
            className="px-3 py-2 border border-outline rounded-lg bg-white text-sm focus:border-primary outline-none font-medium"
          >
            <option value="Editor">Editor (Create & Edit)</option>
            <option value="Admin">Admin (Full Access & Delete)</option>
          </select>
          <button type="submit" className="px-4 py-2 bg-primary text-on-primary rounded-lg font-bold text-sm hover:bg-primary/90 transition-colors shadow-sm">
            Send Invite
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
            ) : combinedTeam.map(member => (
              <tr key={member.id} className="hover:bg-surface-container-highest/50 transition-colors">
                <td className="p-4">
                  <div className="font-bold text-on-surface text-sm flex items-center gap-2">
                    {member.name}
                    {member.isInvite && <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase font-bold">Pending</span>}
                  </div>
                  <div className="text-xs text-on-surface-variant">{member.email}</div>
                </td>
                <td className="p-4">
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
                </td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${member.status === 'Active' ? 'bg-green-500/10 text-green-600' : 'bg-amber-500/10 text-amber-600'}`}>
                    {member.status}
                  </span>
                </td>
                <td className="p-4 text-right">
                  {member.email !== 'raman@voyanta.com' && member.role !== 'Owner' && (
                    <button type="button" onClick={() => handleRemove(member.id, member.isInvite)} className="text-error text-xs font-bold hover:underline">
                      {member.isInvite ? 'Revoke Invite' : 'Revoke Access'}
                    </button>
                  )}
                </td>
              </tr>
            ))}
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

  const current = form || settings || {};
  const upd = (k) => (e) => setForm((s) => ({ ...(s || settings || {}), [k]: e.target.value }));
  const safeStr = (v) => Array.isArray(v) ? v.join('\n') : (v && typeof v === 'object' ? String(v.url || v.src || v.text || v.label || JSON.stringify(v)) : String(v ?? ''));

  const mutation = useMutation({
    mutationFn: (newSettings) => settingsService.update(newSettings),
    onSuccess: () => {
      toast.success('Agency branding updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['agency_settings'] });
    },
    onError: (err) => toast.error('Failed to save branding: ' + err.message)
  });

  if (isLoading) return <div>Loading agency branding...</div>;

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-serif font-bold">Agency Branding & Default Template</h3>
      <div className="p-6 bg-surface-container rounded-xl border border-outline-variant space-y-4">
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
            />
            <ImageUploadInput
              label="Cover Image"
              value={safeStr(current.cover_image_url)}
              onChange={(val) => setForm(s => ({ ...(s || settings || {}), cover_image_url: val }))}
              placeholder="https://example.com/cover.jpg or upload..."
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
        <div>
          <label className="block text-sm font-medium text-on-surface-variant mb-1">Default Inclusions</label>
          <textarea rows="3" value={safeStr(current.inclusions)} onChange={upd('inclusions')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white" />
        </div>
        <div>
          <label className="block text-sm font-medium text-on-surface-variant mb-1">Default Exclusions</label>
          <textarea rows="3" value={safeStr(current.exclusions)} onChange={upd('exclusions')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white" />
        </div>
        <div>
          <label className="block text-sm font-medium text-on-surface-variant mb-1">Default Terms of Payment</label>
          <textarea rows="3" value={safeStr(current.terms_of_payment)} onChange={upd('terms_of_payment')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white" />
        </div>

        {/* Billing, Invoicing & UPI Payment Configuration */}
        <div className="pt-4 border-t border-outline-variant">
          <h4 className="text-lg font-serif font-bold text-on-surface mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">account_balance_wallet</span>
            Invoicing, UPI Payment & Billing Settings
          </h4>
          <p className="text-xs text-on-surface-variant mb-4">
            These settings link directly with your proposal branding and automatically populate all generated invoices and receipts.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/60">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">UPI ID / VPA (For Instant Payments)</label>
              <input
                type="text"
                placeholder="e.g. voyantatravel@okaxis or 9876543210@upi"
                value={safeStr(current.upi_id)}
                onChange={upd('upi_id')}
                className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm font-mono"
              />
              <span className="text-[10px] text-on-surface-variant/70 mt-0.5 block">Used for generating direct "Pay Now" UPI deep links & verification QR codes.</span>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">UPI Payee Name</label>
              <input
                type="text"
                placeholder="e.g. Voyanta Luxury Travel"
                value={safeStr(current.upi_payee_name || current.agency_name)}
                onChange={upd('upi_payee_name')}
                className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Invoice Numbering Format</label>
              <select
                value={current.invoice_number_format || 'INV-000001'}
                onChange={upd('invoice_number_format')}
                className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm font-medium"
              >
                <option value="INV-000001">INV-000001 (Recommended Standard)</option>
                <option value="2026-00054">2026-00054 (Yearly Sequence)</option>
                <option value="VOY-DEL-1045">VOY-DEL-1045 (Agency Prefix)</option>
                <option value="CUSTOM">CUSTOM (Type Custom Prefix Below)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Custom Invoice Prefix & Next No.</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Prefix (e.g. INV- or MYAGENCY-)"
                  value={safeStr(current.invoice_custom_prefix || (current.invoice_number_format === 'CUSTOM-0001' || current.invoice_number_format === 'CUSTOM' ? 'INV-' : current.invoice_number_format ? current.invoice_number_format.split('-')[0] + '-' : 'INV-'))}
                  onChange={upd('invoice_custom_prefix')}
                  className="w-2/3 px-3 py-2 border border-outline rounded-lg bg-white text-sm font-mono font-bold text-primary"
                />
                <input
                  type="number"
                  placeholder="Next #"
                  value={current.invoice_next_sequence || 1}
                  onChange={upd('invoice_next_sequence')}
                  className="w-1/3 px-3 py-2 border border-outline rounded-lg bg-white text-sm font-mono font-bold text-center"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Default Currency</label>
              <select
                value={current.default_currency || 'INR'}
                onChange={upd('default_currency')}
                className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm font-bold text-primary"
              >
                <option value="INR">₹ INR - Indian Rupee (Recommended Default)</option>
                <option value="USD">$ USD - US Dollar</option>
                <option value="EUR">€ EUR - Euro</option>
                <option value="GBP">£ GBP - British Pound</option>
                <option value="AUD">$ AUD - Australian Dollar</option>
                <option value="CAD">$ CAD - Canadian Dollar</option>
                <option value="AED">AED - UAE Dirham</option>
                <option value="SGD">$ SGD - Singapore Dollar</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Default Tax Rate (%)</label>
              <input
                type="number"
                min="0"
                max="50"
                step="0.5"
                placeholder="e.g. 5 for GST 5%"
                value={safeStr(current.default_tax_rate !== undefined ? current.default_tax_rate : 5)}
                onChange={upd('default_tax_rate')}
                className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Invoice Default Notes</label>
              <input
                type="text"
                placeholder="e.g. Thank you for booking with Voyanta Concierge."
                value={safeStr(current.invoice_default_notes)}
                onChange={upd('invoice_default_notes')}
                className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">GST Number / Tax ID</label>
              <input
                type="text"
                placeholder="e.g. 07AAAAA0000A1Z5"
                value={safeStr(current.gst_number)}
                onChange={upd('gst_number')}
                className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm font-mono font-bold text-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Trade Code / Registration No.</label>
              <input
                type="text"
                placeholder="e.g. LIC-DL-2026-8890"
                value={safeStr(current.trade_code)}
                onChange={upd('trade_code')}
                className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Trademarks & Accreditations</label>
              <input
                type="text"
                placeholder="e.g. IATA Approved Agency • TAFI Member • ISO 9001 Certified"
                value={safeStr(current.trademarks)}
                onChange={upd('trademarks')}
                className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1">Document Watermark Text</label>
              <input
                type="text"
                placeholder="e.g. APPROVED or CONFIDENTIAL or VOYANTA LUXURY"
                value={safeStr(current.watermark_text)}
                onChange={upd('watermark_text')}
                className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm font-bold tracking-widest uppercase text-slate-700"
              />
            </div>
            <div className="md:col-span-2 pt-2 border-t border-outline-variant/40">
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
                />
              </div>
            </div>
          </div>
        </div>

        {/* Social Media Links */}
        <div className="pt-4 border-t border-outline-variant">
          <h4 className="text-lg font-serif font-bold text-on-surface mb-3 flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">share</span>
            Social Media & Communication Links
          </h4>
          <p className="text-xs text-on-surface-variant mb-4">
            Add your social media URLs here. When sharing invoices or proposals via email, interactive social logo buttons will automatically appear at the bottom of the email body for the links you provide.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-surface-container-lowest p-4 rounded-xl border border-outline-variant/60">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1 flex items-center gap-1">
                <span>📘 Facebook URL</span>
              </label>
              <input type="url" placeholder="https://facebook.com/youragency" value={safeStr(current.social_facebook)} onChange={upd('social_facebook')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1 flex items-center gap-1">
                <span>📸 Instagram URL</span>
              </label>
              <input type="url" placeholder="https://instagram.com/youragency" value={safeStr(current.social_instagram)} onChange={upd('social_instagram')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1 flex items-center gap-1">
                <span>💼 LinkedIn URL</span>
              </label>
              <input type="url" placeholder="https://linkedin.com/company/youragency" value={safeStr(current.social_linkedin)} onChange={upd('social_linkedin')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1 flex items-center gap-1">
                <span>🐦 Twitter / X URL</span>
              </label>
              <input type="url" placeholder="https://twitter.com/youragency" value={safeStr(current.social_twitter)} onChange={upd('social_twitter')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm" />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-on-surface-variant mb-1 flex items-center gap-1">
                <span>▶️ YouTube Channel URL</span>
              </label>
              <input type="url" placeholder="https://youtube.com/@youragency" value={safeStr(current.social_youtube)} onChange={upd('social_youtube')} className="w-full px-4 py-2 border border-outline rounded-lg bg-white text-sm" />
            </div>
          </div>
        </div>

        <div className="pt-4">
          <button onClick={() => mutation.mutate(current)} disabled={mutation.isPending} className="px-6 py-2 bg-primary text-on-primary rounded-lg font-medium shadow-md hover:bg-primary/90 transition-colors disabled:opacity-50">
            {mutation.isPending ? 'Saving...' : 'Save Brand Guidelines & Billing Settings'}
          </button>
        </div>
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
