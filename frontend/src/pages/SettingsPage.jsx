import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { supabase, DEFAULT_AGENCY_ID } from '../lib/supabaseClient.js';
import { settingsService } from '../services/resourceService.js';
import LogoUploader from '../components/LogoUploader.jsx';
import MobileLivePreview from '../components/MobileLivePreview.jsx';

export default function SettingsPage() {
  const wrapperRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { signOut, isDemo, user } = useAuth();
  
  const [activeTab, setActiveTab] = useState('agency');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings state
  const [settings, setSettings] = useState({
    agency_name: '',
    logo_url: '',
    address: '',
    contact_email: '',
    contact_phone: '',
    website: '',
    gst_number: '',
    default_currency: 'INR',
    customer_email_notifications: '',
    theme_preferences: 'light',
    notification_preferences: {
      proposal_accepted: true,
      proposal_declined: true,
      flight_updates: false,
      weekly_digest: true
    },
    social_facebook: '',
    social_instagram: '',
    social_linkedin: '',
    font_family: '',
    primary_color: '#0b1c30',
    google_calendar_connected: false,
    gmail_connected: false,
    custom_blocks: []
  });

  // User Profile state
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  
  // Password change state
  const [passwordState, setPasswordState] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [changingPassword, setChangingPassword] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await settingsService.get();
      setSettings(data);
      
      // Load user profile defaults
      if (user) {
        setProfileName(user.user_metadata?.full_name || '');
        setProfileEmail(user.email || '');
      } else if (isDemo) {
        setProfileName('Demo User');
        setProfileEmail('demo@voyanta.app');
      }
    } catch (e) {
      toast.error('Failed to load settings: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, [user, isDemo, toast]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const onSaveSettings = async () => {
    setSaving(true);
    try {
      await settingsService.update(settings);
      toast.success('Settings saved successfully');
    } catch (e) {
      toast.error('Failed to save settings: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  const onUpdateProfile = async (e) => {
    e.preventDefault();
    if (isDemo) {
      toast.info('Profile updates are simulated in Demo Mode');
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: profileName }
      });
      if (error) throw error;
      toast.success('Profile updated successfully');
    } catch (e) {
      toast.error('Failed to update profile: ' + e.message);
    }
  };

  const onChangePassword = async (e) => {
    e.preventDefault();
    if (isDemo) {
      toast.info('Password changes are simulated in Demo Mode');
      return;
    }
    if (passwordState.newPassword !== passwordState.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordState.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordState.newPassword
      });
      if (error) throw error;
      toast.success('Password changed successfully');
      setPasswordState({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e) {
      toast.error('Failed to change password: ' + e.message);
    } finally {
      setChangingPassword(false);
    }
  };

  const onExportData = async () => {
    try {
      // Export agency settings + standard tables
      const dump = {
        exported_at: new Date().toISOString(),
        agency_id: DEFAULT_AGENCY_ID,
        settings,
      };

      if (supabase) {
        // Fetch proposals
        const { data: proposals } = await supabase.from('proposals').select('*');
        dump.proposals = proposals || [];
        
        // Fetch templates
        const { data: templates } = await supabase.from('templates').select('*');
        dump.templates = templates || [];
      }

      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(dump, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `voyanta_export_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success('Data exported successfully');
    } catch (e) {
      toast.error('Export failed: ' + e.message);
    }
  };

  const [mountNode, setMountNode] = useState(null);

  // Mutate sidebar chrome and page headers
  useEffect(() => {
    const canvas = document.querySelector('main .max-w-7xl'); if (!canvas) return;
    
    // Highlight "Settings" link in Sidebar
    document.querySelectorAll('aside a').forEach((a) => {
      const lab = a.querySelector('.font-label-md'); if (!lab) return;
      const t = lab.textContent.trim();
      a.className = (t === 'Settings')
        ? 'flex items-center gap-md bg-surface-container-high text-primary font-semibold border-l-4 border-primary rounded-r-lg py-md px-lg transition-transform scale-[0.98]'
        : 'flex items-center gap-md text-on-surface-variant py-md px-lg hover:bg-surface-container-low transition-all duration-200';
    });

    const h2 = canvas.querySelector('h2'); if (h2) h2.textContent = 'Settings';
    const p  = h2?.parentElement?.querySelector('p'); if (p) p.textContent = 'Manage your agency settings, integrations, and preferences.';
    
    // Hide standard top level action button
    const cta = canvas.querySelector('button.bg-primary');
    if (cta) { cta.style.display = 'none'; }
    
    canvas.querySelectorAll(':scope > div.grid, :scope > .bento-grid').forEach((n) => n.remove());
    let mount = canvas.querySelector('#settings-mount');
    if (!mount) { mount = document.createElement('div'); mount.id = 'settings-mount'; canvas.appendChild(mount); }
    setMountNode(mount);
  });

  // Sign-out action in sidebar card click
  useEffect(() => {
    const card = document.querySelector('aside .px-lg.pt-xl div.flex.items-center.gap-md'); if (!card) return;
    const onClick = async () => { await signOut(); navigate('/login'); };
    card.style.cursor = 'pointer'; card.addEventListener('click', onClick);
    const name = card.querySelector('p.font-label-md');
    const role = card.querySelector('p.font-label-sm');
    if (name) name.textContent = user?.user_metadata?.full_name || (isDemo ? 'Demo User' : 'Voyanta Agent');
    if (role) role.textContent = isDemo ? 'Demo Session' : (user?.email || 'Premium Agent');
    return () => card.removeEventListener('click', onClick);
  }, [signOut, navigate, isDemo, user]);

  const upd = (k) => (e) => setSettings((s) => ({ ...s, [k]: e.target.value }));
  const updNested = (parent, k) => (e) => setSettings((s) => ({
    ...s,
    [parent]: {
      ...s[parent],
      [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value
    }
  }));

  return (
    <div ref={wrapperRef} style={{ display: 'contents' }}>
      {mountNode && createPortal(
        <div className="flex flex-col gap-lg" data-testid="settings-page">
          {/* Tab Navigation */}
          <div className="flex items-center gap-md border-b border-outline-variant pb-xs">
            <button
              onClick={() => setActiveTab('agency')}
              className={`py-md px-lg text-label-md font-bold border-b-2 transition-all ${activeTab === 'agency' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'}`}
            >
              Agency Information
            </button>
            <button
              onClick={() => setActiveTab('profile')}
              className={`py-md px-lg text-label-md font-bold border-b-2 transition-all ${activeTab === 'profile' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'}`}
            >
              User Profile & Security
            </button>
            <button
              onClick={() => setActiveTab('preferences')}
              className={`py-md px-lg text-label-md font-bold border-b-2 transition-all ${activeTab === 'preferences' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'}`}
            >
              Preferences
            </button>
            <button
              onClick={() => setActiveTab('integrations')}
              className={`py-md px-lg text-label-md font-bold border-b-2 transition-all ${activeTab === 'integrations' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-primary'}`}
            >
              Integrations & System
            </button>
          </div>

          {loading ? (
            <p className="glass-card p-lg rounded-xl text-center">Loading settings…</p>
          ) : (
            <div className="glass-card p-lg rounded-xl space-y-md">
              {/* TAB 1: AGENCY SETTINGS */}
              {activeTab === 'agency' && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr,360px] gap-xl">
                  <div className="space-y-md">
                    <h3 className="font-headline-sm text-headline-sm text-primary">Agency Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                    <Field label="Agency Name" value={settings.agency_name} onChange={upd('agency_name')} testid="settings-agency-name" />
                    
                    <div className="flex flex-col gap-xs">
                      <span className="font-label-md text-label-md text-on-surface">Default Theme</span>
                      <select value={settings.template_style || 'classic'} onChange={upd('template_style')}
                        className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md">
                        <option value="modern">Modern Luxury</option>
                        <option value="minimal">Minimal Editorial</option>
                        <option value="dark">Dark Luxury</option>
                        <option value="classic">Classic European</option>
                        <option value="tropical">Tropical Escape</option>
                        <option value="corporate">Corporate Executive</option>
                      </select>
                    </div>

                    <Field label="Website" value={settings.website} onChange={upd('website')} testid="settings-website" />
                    
                    <div className="md:col-span-2">
                      <LogoUploader
                        value={settings.logo_url}
                        onChange={(v) => setSettings((s) => ({ ...s, logo_url: v }))}
                        label="Agency Logo"
                        testid="settings-logo-uploader"
                        folder="logos"
                      />
                    </div>

                    <Field label="Agency Address" value={settings.address} onChange={upd('address')} testid="settings-address" />
                    <Field label="GST Number" value={settings.gst_number} onChange={upd('gst_number')} testid="settings-gst" />
                    <Field label="Contact Email" type="email" value={settings.contact_email} onChange={upd('contact_email')} testid="settings-email" />
                    <Field label="Contact Phone" value={settings.contact_phone} onChange={upd('contact_phone')} testid="settings-phone" />
                    
                    <div>
                      <label className="flex flex-col gap-xs">
                        <span className="font-label-md text-label-md text-on-surface">Default Currency</span>
                        <select
                          value={settings.default_currency}
                          onChange={upd('default_currency')}
                          data-testid="settings-currency"
                          className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md"
                        >
                          <option value="INR">₹ INR (Indian Rupee)</option>
                          <option value="USD">$ USD (US Dollar)</option>
                          <option value="EUR">€ EUR (Euro)</option>
                          <option value="GBP">£ GBP (British Pound)</option>
                        </select>
                      </label>
                    </div>

                    <Field
                      label="Customer Notifications Email"
                      type="email"
                      value={settings.customer_email_notifications || ''}
                      onChange={(e) => setSettings((s) => ({ ...s, customer_email_notifications: e.target.value }))}
                      testid="settings-customer-email"
                      placeholder="e.g. clients@myagency.com"
                    />

                    <Field
                      label="WhatsApp Number (for Sharing)"
                      type="tel"
                      value={settings.whatsapp_number || ''}
                      onChange={(e) => setSettings((s) => ({ ...s, whatsapp_number: e.target.value }))}
                      testid="settings-whatsapp-number"
                      placeholder="e.g. +1234567890"
                    />
                    
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-md mt-sm border-t border-outline-variant pt-sm">
                      <Field label="Facebook (URL)" value={settings.social_facebook || ''} onChange={upd('social_facebook')} testid="settings-facebook" />
                      <Field label="Instagram (URL)" value={settings.social_instagram || ''} onChange={upd('social_instagram')} testid="settings-instagram" />
                      <Field label="LinkedIn (URL)" value={settings.social_linkedin || ''} onChange={upd('social_linkedin')} testid="settings-linkedin" />
                    </div>
                  </div>
                  
                  <div className="pt-xl border-t border-outline-variant space-y-md">
                    <h4 className="font-headline-sm text-headline-sm text-primary">Custom Branding Sections</h4>
                    <p className="text-body-sm text-on-surface-variant">Add extra text or image sections that will appear on the branding page for all proposals.</p>
                    <div className="space-y-md">
                      {(settings.custom_blocks || []).map((block, idx) => (
                        <div key={idx} className="flex gap-md items-end bg-surface-container-low p-md rounded-lg border border-outline-variant">
                          <label className="flex flex-col gap-xs flex-1">
                            <span className="font-label-md text-label-md text-on-surface">Section Name</span>
                            <input type="text" value={block.label} onChange={(e) => {
                              const nb = [...settings.custom_blocks];
                              nb[idx].label = e.target.value;
                              setSettings({ ...settings, custom_blocks: nb });
                            }} className="px-md py-sm bg-white border border-outline-variant rounded-lg font-body-md" placeholder="e.g. Testimonials" />
                          </label>
                          <label className="flex flex-col gap-xs">
                            <span className="font-label-md text-label-md text-on-surface">Type</span>
                            <select value={block.type} onChange={(e) => {
                              const nb = [...settings.custom_blocks];
                              nb[idx].type = e.target.value;
                              setSettings({ ...settings, custom_blocks: nb });
                            }} className="px-md py-sm bg-white border border-outline-variant rounded-lg font-body-md">
                              <option value="text">Text (Paragraph)</option>
                              <option value="image">Image (Upload)</option>
                            </select>
                          </label>
                          <button onClick={() => {
                            const nb = [...settings.custom_blocks];
                            nb.splice(idx, 1);
                            setSettings({ ...settings, custom_blocks: nb });
                          }} className="px-md py-sm text-red-600 border border-red-200 rounded-lg font-label-md hover:bg-red-50">
                            Remove
                          </button>
                        </div>
                      ))}
                      <button onClick={() => {
                        const newId = 'custom_' + Date.now();
                        setSettings({ ...settings, custom_blocks: [...(settings.custom_blocks || []), { id: newId, label: 'New Section', type: 'text' }] });
                      }} className="px-md py-sm bg-surface-container-high text-on-surface rounded-lg font-label-md hover:bg-surface-variant flex items-center gap-xs">
                        <span className="material-symbols-outlined text-[18px]">add</span> Add Custom Section
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end gap-md pt-md border-t border-outline-variant">
                    <button onClick={loadSettings} className="px-lg py-md border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low">Reset</button>
                    <button onClick={onSaveSettings} disabled={saving} data-testid="settings-save-agency"
                      className="px-lg py-md bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 disabled:opacity-60">
                      {saving ? 'Saving…' : 'Save Details'}
                    </button>
                  </div>
                </div>
                
                {/* Right Side: Mobile Live Preview */}
                <div className="hidden lg:block sticky top-6 h-[800px]">
                  <MobileLivePreview branding={settings} />
                </div>
              </div>
              )}

              {/* TAB 2: USER PROFILE & SECURITY */}
              {activeTab === 'profile' && (
                <div className="space-y-lg">
                  {/* Edit Profile */}
                  <form onSubmit={onUpdateProfile} className="space-y-md">
                    <h3 className="font-headline-sm text-headline-sm text-primary">User Profile</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                      <label className="flex flex-col gap-xs">
                        <span className="font-label-md text-label-md text-on-surface">Full Name</span>
                        <input type="text" value={profileName} onChange={(e) => setProfileName(e.target.value)} required
                          className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" />
                      </label>
                      <label className="flex flex-col gap-xs">
                        <span className="font-label-md text-label-md text-on-surface">Email Address</span>
                        <input type="email" value={profileEmail} disabled
                          className="px-md py-md bg-slate-100 border border-outline-variant rounded-lg font-body-md text-slate-500 cursor-not-allowed" />
                      </label>
                    </div>
                    <div className="flex justify-end">
                      <button type="submit" className="px-lg py-md bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90">
                        Update Profile
                      </button>
                    </div>
                  </form>

                  {/* Auth Status */}
                  <div className="pt-md border-t border-outline-variant space-y-sm">
                    <h4 className="font-title-md text-title-md text-on-surface font-semibold">Google Authentication Status</h4>
                    <div className="flex items-center gap-md bg-surface-container-low p-md rounded-lg border border-outline-variant">
                      <span className={`material-symbols-outlined text-[24px] ${user?.app_metadata?.provider === 'google' ? 'text-green-600' : 'text-on-surface-variant'}`}>
                        {user?.app_metadata?.provider === 'google' ? 'verified' : 'account_circle'}
                      </span>
                      <div>
                        <p className="font-label-md text-on-surface">
                          {user?.app_metadata?.provider === 'google' ? 'Connected via Google' : 'Standard Password Login'}
                        </p>
                        <p className="text-body-sm text-on-surface-variant">
                          {user?.app_metadata?.provider === 'google' 
                            ? `Your account is authenticated via Google. Provider: ${user.app_metadata.provider}` 
                            : 'To secure your account further, OAuth connections can be managed via auth flows.'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Change Password */}
                  {user?.app_metadata?.provider !== 'google' && (
                    <form onSubmit={onChangePassword} className="pt-md border-t border-outline-variant space-y-md">
                      <h3 className="font-headline-sm text-headline-sm text-primary">Change Password</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
                        <label className="flex flex-col gap-xs">
                          <span className="font-label-md text-label-md text-on-surface">Current Password</span>
                          <input type="password" value={passwordState.currentPassword}
                            onChange={(e) => setPasswordState(s => ({ ...s, currentPassword: e.target.value }))}
                            className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" />
                        </label>
                        <label className="flex flex-col gap-xs">
                          <span className="font-label-md text-label-md text-on-surface">New Password</span>
                          <input type="password" value={passwordState.newPassword}
                            onChange={(e) => setPasswordState(s => ({ ...s, newPassword: e.target.value }))}
                            className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" />
                        </label>
                        <label className="flex flex-col gap-xs">
                          <span className="font-label-md text-label-md text-on-surface">Confirm New Password</span>
                          <input type="password" value={passwordState.confirmPassword}
                            onChange={(e) => setPasswordState(s => ({ ...s, confirmPassword: e.target.value }))}
                            className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" />
                        </label>
                      </div>
                      <div className="flex justify-end">
                        <button type="submit" disabled={changingPassword}
                          className="px-lg py-md bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 disabled:opacity-60">
                          {changingPassword ? 'Updating…' : 'Change Password'}
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* TAB 3: PREFERENCES */}
              {activeTab === 'preferences' && (
                <div className="space-y-md">
                  <h3 className="font-headline-sm text-headline-sm text-primary">Theme & Notifications</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-xl">
                    {/* Theme Preferences */}
                    <div className="space-y-sm">
                      <h4 className="font-title-md text-title-md text-on-surface font-semibold">Theme Preference</h4>
                      <label className="flex flex-col gap-xs">
                        <span className="font-label-sm text-on-surface-variant">Select Application Theme</span>
                        <select
                          value={settings.theme_preferences}
                          onChange={upd('theme_preferences')}
                          data-testid="settings-theme"
                          className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md"
                        >
                          <option value="light">Light Theme (Default)</option>
                          <option value="dark">Dark Theme (Beta)</option>
                          <option value="system">Follow System Settings</option>
                        </select>
                      </label>
                    </div>

                    {/* Notification Preferences */}
                    <div className="space-y-sm">
                      <h4 className="font-title-md text-title-md text-on-surface font-semibold">Email Notifications</h4>
                      <div className="space-y-xs">
                        <label className="flex items-center gap-md font-body-md text-on-surface select-none cursor-pointer">
                          <input type="checkbox" checked={settings.notification_preferences.proposal_accepted}
                            onChange={updNested('notification_preferences', 'proposal_accepted')}
                            className="w-5 h-5 rounded text-primary border-outline-variant focus:ring-primary/20" />
                          <span>Notify when a client accepts a proposal</span>
                        </label>
                        <label className="flex items-center gap-md font-body-md text-on-surface select-none cursor-pointer">
                          <input type="checkbox" checked={settings.notification_preferences.proposal_declined}
                            onChange={updNested('notification_preferences', 'proposal_declined')}
                            className="w-5 h-5 rounded text-primary border-outline-variant focus:ring-primary/20" />
                          <span>Notify when a client declines a proposal</span>
                        </label>
                        <label className="flex items-center gap-md font-body-md text-on-surface select-none cursor-pointer">
                          <input type="checkbox" checked={settings.notification_preferences.flight_updates}
                            onChange={updNested('notification_preferences', 'flight_updates')}
                            className="w-5 h-5 rounded text-primary border-outline-variant focus:ring-primary/20" />
                          <span>Get instant alerts on flight schedule changes</span>
                        </label>
                        <label className="flex items-center gap-md font-body-md text-on-surface select-none cursor-pointer">
                          <input type="checkbox" checked={settings.notification_preferences.weekly_digest}
                            onChange={updNested('notification_preferences', 'weekly_digest')}
                            className="w-5 h-5 rounded text-primary border-outline-variant focus:ring-primary/20" />
                          <span>Receive weekly agency pipeline digest reports</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-md pt-md border-t border-outline-variant">
                    <button onClick={loadSettings} className="px-lg py-md border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low">Reset</button>
                    <button onClick={onSaveSettings} disabled={saving} data-testid="settings-save-prefs"
                      className="px-lg py-md bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 disabled:opacity-60">
                      {saving ? 'Saving…' : 'Save Preferences'}
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: INTEGRATIONS & SYSTEM */}
              {activeTab === 'integrations' && (
                <div className="space-y-lg">
                  {/* Connected Integrations */}
                  <div className="space-y-sm">
                    <h3 className="font-headline-sm text-headline-sm text-primary">Connected Integrations</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                      <div className="flex items-center justify-between p-md bg-surface-container-low border border-outline-variant rounded-xl">
                        <div className="flex items-center gap-md">
                          <span className="material-symbols-outlined text-[28px] text-red-500">calendar_today</span>
                          <div>
                            <p className="font-label-md font-bold text-on-surface">Google Calendar</p>
                            <p className="text-body-sm text-on-surface-variant">Sync client bookings to calendar</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSettings(s => ({ ...s, google_calendar_connected: !s.google_calendar_connected }))}
                          className={`px-md py-sm rounded-lg font-label-sm border transition-colors ${settings.google_calendar_connected ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' : 'border-outline-variant hover:bg-surface-container-high'}`}
                        >
                          {settings.google_calendar_connected ? 'Connected' : 'Connect'}
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-md bg-surface-container-low border border-outline-variant rounded-xl">
                        <div className="flex items-center gap-md">
                          <span className="material-symbols-outlined text-[28px] text-blue-500">mail</span>
                          <div>
                            <p className="font-label-md font-bold text-on-surface">Gmail Integration</p>
                            <p className="text-body-sm text-on-surface-variant">Send proposals via agency Gmail</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setSettings(s => ({ ...s, gmail_connected: !s.gmail_connected }))}
                          className={`px-md py-sm rounded-lg font-label-sm border transition-colors ${settings.gmail_connected ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' : 'border-outline-variant hover:bg-surface-container-high'}`}
                        >
                          {settings.gmail_connected ? 'Connected' : 'Connect'}
                        </button>
                      </div>
                    </div>
                    {/* Auto save connection state adjustments */}
                    {(settings.gmail_connected !== settings.gmail_connected || settings.google_calendar_connected !== settings.google_calendar_connected) && (
                      <div className="flex justify-end pt-sm">
                        <button onClick={onSaveSettings} className="px-md py-xs bg-primary text-white rounded text-label-sm">Save Connections</button>
                      </div>
                    )}
                  </div>

                  {/* System & Data Actions */}
                  <div className="pt-md border-t border-outline-variant space-y-sm">
                    <h3 className="font-headline-sm text-headline-sm text-primary">System Operations</h3>
                    <div className="p-md bg-surface-container-low border border-outline-variant rounded-xl flex items-center justify-between flex-wrap gap-md">
                      <div>
                        <p className="font-label-md font-bold text-on-surface">Export Workspace Data</p>
                        <p className="text-body-sm text-on-surface-variant">Export all proposals, templates, and settings as a portable JSON file.</p>
                      </div>
                      <button onClick={onExportData} className="px-lg py-md bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 flex items-center gap-xs">
                        <span className="material-symbols-outlined text-[18px]">download</span> Export JSON
                      </button>
                    </div>
                  </div>

                  {/* About Section */}
                  <div className="pt-md border-t border-outline-variant space-y-sm">
                    <h3 className="font-headline-sm text-headline-sm text-primary">About Application</h3>
                    <div className="p-md bg-surface-container-low border border-outline-variant rounded-xl space-y-xs text-body-sm text-on-surface-variant">
                      <p><strong>Voyanta Travel Concierge</strong> — Premium Agency Platform</p>
                      <p>Version: 1.2.0-production</p>
                      <p>Frameworks: React 18, Vite 5, Tailwind-Lite, Supabase JS</p>
                      <p className="text-[11px] pt-xs border-t border-outline-variant mt-sm">© 2026 Voyanta Technologies. All rights reserved.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>,
        mountNode
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', testid }) {
  return (
    <label className="flex flex-col gap-xs">
      <span className="font-label-md text-label-md text-on-surface">{label}</span>
      <input type={type} value={value ?? ''} onChange={onChange} data-testid={testid}
        className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20" />
    </label>
  );
}
