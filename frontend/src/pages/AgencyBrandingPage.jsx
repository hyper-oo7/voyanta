// Agency Branding page — bound to public.agencies table. Saved values are
// inherited by future proposals via the wizard's Step 6 (Branding).

import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';


import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { supabase, DEFAULT_AGENCY_ID } from '../lib/supabaseClient.js';
import LogoUploader from '../components/LogoUploader.jsx';
import ColorPicker from '../components/ColorPicker.jsx';
import { FONT_CATALOG } from '../lib/fonts.js';


export default function AgencyBrandingPage() {
  const wrapperRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { signOut, isDemo, user } = useAuth();
  const [b, setB] = useState({
    agency_name: '', logo_url: '', address: '',
    contact_email: '', contact_phone: '', website: '', primary_color: '#0b1c30',
    social_facebook: '', social_instagram: '', social_linkedin: '',
    font_family: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    try {
      const { data } = await supabase.from('agencies').select('*').eq('id', DEFAULT_AGENCY_ID).maybeSingle();
      if (data) {
        const social = data.social_links || data.preferences?.social_links || {};
        setB({
          agency_name: data.name || '',
          logo_url: data.logo_url || '',
          address: data.address || data.preferences?.address || '',
          contact_email: data.contact_email || data.preferences?.contact_email || '',
          contact_phone: data.contact_phone || data.preferences?.contact_phone || '',
          website: data.website || data.preferences?.website || '',
          primary_color: data.primary_color || '#0b1c30',
          social_facebook:  social.facebook  || '',
          social_instagram: social.instagram || '',
          social_linkedin:  social.linkedin  || '',
          font_family: data.font_family || data.preferences?.font_family || '',
        });
      }
    } catch (e) { toast.error(e.message); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { reload(); }, [reload]);

  const onSave = async () => {
    if (!supabase) return;
    setSaving(true);
    try {
      // Use a generic update; only `name`, `logo_url`, `primary_color` are guaranteed
      // columns in v1 schema. Everything else nests under preferences jsonb (no schema
      // change required).
      const patch = {
        name: b.agency_name,
        logo_url: b.logo_url || null,
        primary_color: b.primary_color || null,
        // best-effort columns (silently dropped if column missing)
        address: b.address || null,
        contact_email: b.contact_email || null,
        contact_phone: b.contact_phone || null,
        website: b.website || null,
        social_links: {
          facebook: b.social_facebook,
          instagram: b.social_instagram,
          linkedin: b.social_linkedin,
        },
        font_family: b.font_family || null,
      };
      // Try full update first; if columns missing, fall back to safe subset + preferences jsonb
      let { error } = await supabase.from('agencies').update(patch).eq('id', DEFAULT_AGENCY_ID);
      if (error) {
        const safe = { name: patch.name, logo_url: patch.logo_url, primary_color: patch.primary_color };
        const { error: e2 } = await supabase.from('agencies').update(safe).eq('id', DEFAULT_AGENCY_ID);
        if (e2) throw e2;
      }
      toast.success('Branding saved');
    } catch (e) { toast.error(e.message); }
    finally { setSaving(false); }
  };

  const [mountNode, setMountNode] = useState(null);

  // Mutate dashboard chrome
  useEffect(() => {
    const canvas = document.querySelector('main .max-w-7xl'); if (!canvas) return;
    document.querySelectorAll('aside a').forEach((a) => {
      const lab = a.querySelector('.font-label-md'); if (!lab) return;
      const t = lab.textContent.trim();
      a.className = (t === 'Branding')
        ? 'flex items-center gap-md bg-surface-container-high text-primary font-semibold border-l-4 border-primary rounded-r-lg py-md px-lg transition-transform scale-[0.98]'
        : 'flex items-center gap-md text-on-surface-variant py-md px-lg hover:bg-surface-container-low transition-all duration-200';
    });
    const h2 = canvas.querySelector('h2'); if (h2) h2.textContent = 'Agency Branding';
    const p  = h2?.parentElement?.querySelector('p'); if (p) p.textContent = 'These values appear on every proposal you generate.';
    const cta = canvas.querySelector('button.bg-primary');
    if (cta) { cta.style.display = 'inline-flex'; cta.innerHTML = '<span class="material-symbols-outlined">save</span> Save Changes'; cta.onclick = onSave; }
    canvas.querySelectorAll(':scope > div.grid, :scope > .bento-grid').forEach((n) => n.remove());
    let mount = canvas.querySelector('#brand-mount');
    if (!mount) { mount = document.createElement('div'); mount.id = 'brand-mount'; canvas.appendChild(mount); }
    setMountNode(mount);
  });

  // Sign-out
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

  const upd = (k) => (e) => setB((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div ref={wrapperRef} style={{ display: 'contents' }}>
      {mountNode && createPortal(
        <div className="glass-card p-lg rounded-xl space-y-md" data-testid="branding-page">
          {loading ? <p>Loading…</p> : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                <Field label="Agency Name" value={b.agency_name} onChange={upd('agency_name')} testid="brand-name" />
                <div className="flex flex-col gap-xs">
                  <span className="font-label-md text-label-md text-on-surface">Brand Font</span>
                  <select value={b.font_family} onChange={upd('font_family')} data-testid="brand-font"
                    className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md"
                    style={{ fontFamily: b.font_family || undefined }}>
                    <option value="">— Use template default —</option>
                    {FONT_CATALOG.map((f) => (
                      <option key={f.key} value={f.value} style={{ fontFamily: f.value }}>{f.label}</option>
                    ))}
                  </select>
                </div>
                <div className="md:col-span-2">
                  <LogoUploader value={b.logo_url} onChange={(v) => setB((s) => ({ ...s, logo_url: v }))} label="Agency Logo" testid="brand-logo-uploader" folder="logos" />
                </div>
                <Field label="Address"     value={b.address}     onChange={upd('address')}     testid="brand-address" />
                <ColorPicker value={b.primary_color} onChange={upd('primary_color')} testid="brand-color" />
                <Field label="Contact Email" type="email" value={b.contact_email} onChange={upd('contact_email')} testid="brand-email" />
                <Field label="Contact Phone" value={b.contact_phone} onChange={upd('contact_phone')} testid="brand-phone" />
                <Field label="Website" value={b.website} onChange={upd('website')} testid="brand-website" />
                <Field label="Facebook"  value={b.social_facebook}  onChange={upd('social_facebook')}  testid="brand-fb" />
                <Field label="Instagram" value={b.social_instagram} onChange={upd('social_instagram')} testid="brand-ig" />
                <Field label="LinkedIn"  value={b.social_linkedin}  onChange={upd('social_linkedin')}  testid="brand-li" />
              </div>
              <div className="flex justify-end gap-md">
                <button onClick={reload} className="px-lg py-md border border-outline-variant rounded-lg font-label-md hover:bg-surface-container-low">Reset</button>
                <button onClick={onSave} disabled={saving} data-testid="brand-save"
                  className="px-lg py-md bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 disabled:opacity-60">
                  {saving ? 'Saving…' : 'Save Branding'}
                </button>
              </div>
            </>
          )}
        </div>, mountNode
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
