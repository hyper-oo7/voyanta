import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext.jsx';
import { supabase, DEFAULT_AGENCY_ID } from '../lib/supabaseClient.js';
import { useToast } from '../context/ToastContext.jsx';

// ---- Fetch Functions ----
const fetchAgency = async () => {
  const { data, error } = await supabase.from('agencies').select('*').eq('id', DEFAULT_AGENCY_ID).single();
  if (error) throw error;
  return data;
};

const fetchSubscription = async () => {
  const { data, error } = await supabase.from('subscriptions').select('*').eq('agency_id', DEFAULT_AGENCY_ID).maybeSingle();
  if (error) throw error;
  return data || { plan: 'Starter' }; // Mock fallback
};

const fetchTeam = async () => {
  const { data, error } = await supabase.from('users').select('*').eq('agency_id', DEFAULT_AGENCY_ID);
  if (error) throw error;
  return data;
};

const fetchActivityLogs = async () => {
  const { data, error } = await supabase.from('activity_logs').select('*').eq('agency_id', DEFAULT_AGENCY_ID).order('created_at', { ascending: false }).limit(20);
  if (error) throw error;
  return data;
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
          Plan & Billing
        </NavButton>
        <NavButton active={activeTab === 'profile'} onClick={() => setActiveTab('profile')} icon="👤">
          My Profile
        </NavButton>

        {isEnterprise && (
          <>
            <div className="text-xs font-bold text-on-surface-variant uppercase tracking-widest mt-6 mb-2">Enterprise</div>
            <NavButton active={activeTab === 'team'} onClick={() => setActiveTab('team')} icon="👥">
              Team Management
            </NavButton>
            <NavButton active={activeTab === 'branding'} onClick={() => setActiveTab('branding')} icon="🎨">
              White-label Branding
            </NavButton>
            <NavButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon="📋">
              Activity Logs
            </NavButton>
          </>
        )}
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
            {activeTab === 'team' && isEnterprise && <TeamSettings />}
            {activeTab === 'branding' && isEnterprise && <BrandingSettings />}
            {activeTab === 'logs' && isEnterprise && <ActivityLogs />}
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
  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-serif font-bold">Plan & Billing</h3>
      <div className="p-6 bg-surface-container rounded-xl border border-outline-variant">
        <h4 className="text-lg font-bold">Current Plan: {subscription?.plan || 'Starter'}</h4>
        <p className="text-on-surface-variant mt-2 mb-6">
          {subscription?.plan === 'Enterprise' 
            ? 'You have access to all premium features including Team Management and Audit Logs.'
            : 'Upgrade to Enterprise to unlock Team Management, strict RBAC, and White-label branding.'}
        </p>
        <button className="px-6 py-2 bg-primary text-on-primary rounded-lg font-medium shadow-md hover:bg-primary/90 transition-colors">
          Manage Subscription
        </button>
      </div>
    </div>
  );
}

function ProfileSettings({ user, signOut, isDemo }) {
  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-serif font-bold">My Profile</h3>
      <div className="p-6 bg-surface-container rounded-xl border border-outline-variant space-y-4">
        <div>
          <label className="text-sm font-medium text-on-surface-variant">Name</label>
          <div className="mt-1 text-on-surface font-medium">{user?.user_metadata?.full_name || (isDemo ? 'Demo User' : 'Voyanta Agent')}</div>
        </div>
        <div>
          <label className="text-sm font-medium text-on-surface-variant">Email</label>
          <div className="mt-1 text-on-surface font-medium">{user?.email || 'Demo Session'}</div>
        </div>
        <div className="pt-4 border-t border-outline-variant">
          <button onClick={signOut} className="text-error font-medium hover:underline">
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

function TeamSettings() {
  const { data: team = [], isLoading } = useQuery({ queryKey: ['team'], queryFn: fetchTeam });
  const [inviteEmail, setInviteEmail] = useState('');
  const toast = useToast();

  const handleInvite = (e) => {
    e.preventDefault();
    toast.success(`Invitation sent to ${inviteEmail}`);
    setInviteEmail('');
  };

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-serif font-bold">Team Management</h3>
      
      <div className="p-6 bg-surface-container rounded-xl border border-outline-variant">
        <h4 className="text-lg font-bold mb-4">Invite Agent</h4>
        <form onSubmit={handleInvite} className="flex gap-4">
          <input 
            type="email" 
            placeholder="agent@example.com" 
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            className="flex-1 px-4 py-2 border border-outline rounded-lg focus:border-primary outline-none"
            required
          />
          <button type="submit" className="px-6 py-2 bg-black text-white rounded-lg font-medium hover:bg-gray-800">
            Send Invite
          </button>
        </form>
      </div>

      <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-surface-container-highest border-b border-outline-variant">
            <tr>
              <th className="p-4 font-medium text-on-surface-variant text-sm">Name</th>
              <th className="p-4 font-medium text-on-surface-variant text-sm">Role</th>
              <th className="p-4 font-medium text-on-surface-variant text-sm">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {isLoading ? <tr><td colSpan="3" className="p-4 text-center">Loading team...</td></tr> : null}
            {team.map(member => (
              <tr key={member.id} className="hover:bg-surface-container-highest/50">
                <td className="p-4">
                  <div className="font-medium text-on-surface">{member.full_name || 'Unnamed Agent'}</div>
                  <div className="text-xs text-on-surface-variant">{member.email}</div>
                </td>
                <td className="p-4">
                  <span className="px-2 py-1 bg-primary/10 text-primary text-xs rounded-full uppercase tracking-wider font-bold">
                    {member.role}
                  </span>
                </td>
                <td className="p-4">
                  <button className="text-error text-sm font-medium hover:underline">Revoke Access</button>
                </td>
              </tr>
            ))}
            {team.length === 0 && !isLoading && (
              <tr><td colSpan="3" className="p-4 text-center text-on-surface-variant">No team members found.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BrandingSettings() {
  const { data: agency } = useQuery({ queryKey: ['agency'], queryFn: fetchAgency });
  
  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-serif font-bold">White-label Branding</h3>
      <div className="p-6 bg-surface-container rounded-xl border border-outline-variant space-y-4">
        <div>
          <label className="block text-sm font-medium text-on-surface-variant mb-1">Agency Name</label>
          <input type="text" defaultValue={agency?.name || ''} className="w-full px-4 py-2 border border-outline rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium text-on-surface-variant mb-1">Primary Color (Hex)</label>
          <div className="flex gap-4">
            <input type="color" defaultValue={agency?.primary_color || '#000000'} className="h-10 w-10 p-1 rounded border border-outline cursor-pointer" />
            <input type="text" defaultValue={agency?.primary_color || '#000000'} className="flex-1 px-4 py-2 border border-outline rounded-lg font-mono" />
          </div>
        </div>
        <div className="pt-4">
          <button className="px-6 py-2 bg-primary text-on-primary rounded-lg font-medium shadow-md hover:bg-primary/90 transition-colors">
            Save Brand Guidelines
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivityLogs() {
  const { data: logs = [], isLoading } = useQuery({ queryKey: ['activity_logs'], queryFn: fetchActivityLogs });

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-serif font-bold">Audit & Activity Logs</h3>
      <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-surface-container-highest border-b border-outline-variant">
            <tr>
              <th className="p-4 font-medium text-on-surface-variant text-sm">Timestamp</th>
              <th className="p-4 font-medium text-on-surface-variant text-sm">Action</th>
              <th className="p-4 font-medium text-on-surface-variant text-sm">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {isLoading ? <tr><td colSpan="3" className="p-4 text-center">Loading logs...</td></tr> : null}
            {logs.map(log => (
              <tr key={log.id} className="hover:bg-surface-container-highest/50 text-sm">
                <td className="p-4 whitespace-nowrap text-on-surface-variant">{new Date(log.created_at).toLocaleString()}</td>
                <td className="p-4 font-medium text-on-surface">{log.action}</td>
                <td className="p-4 text-on-surface-variant font-mono text-xs">{JSON.stringify(log.details)}</td>
              </tr>
            ))}
            {logs.length === 0 && !isLoading && (
              <tr><td colSpan="3" className="p-4 text-center text-on-surface-variant">No activity recorded yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
