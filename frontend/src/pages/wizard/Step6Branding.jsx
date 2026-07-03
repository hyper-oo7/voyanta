import { memo } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import LogoUploader from '../../components/LogoUploader.jsx';
import { TEMPLATE_LIST } from '../../templates/registry.js';

const safeStr = (v) => Array.isArray(v) ? v.join('\n') : (v && typeof v === 'object' ? JSON.stringify(v) : (v ?? ''));

const Field = memo(function Field({ label, value, onChange, type = 'text', testid, extraClass = '' }) {
  return (
    <label className={'flex flex-col gap-xs ' + extraClass}>
      <span className="font-label-md text-label-md text-on-surface">{label}</span>
      <input type={type} value={safeStr(value)} onChange={onChange} data-testid={testid}
        className="px-md py-md bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20" />
    </label>
  );
});

const Textarea = memo(function Textarea({ label, value, onChange, testid, placeholder = '' }) {
  return (
    <label className="flex flex-col gap-xs">
      <span className="font-label-md text-label-md text-on-surface">{label}</span>
      <textarea value={safeStr(value)} onChange={onChange} rows={3} placeholder={placeholder} data-testid={testid}
        className="w-full px-md py-md bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20" />
    </label>
  );
});

function TextareaWithAI({ label, value, onChange, testid, onAI }) {
  return (
    <label className="flex flex-col gap-xs">
      <span className="flex items-center justify-between font-label-md text-label-md text-on-surface">
        <span>{label}</span>
        <button type="button" onClick={onAI} data-testid={`${testid}-ai`}
          className="inline-flex items-center gap-xs px-md py-xs bg-primary/10 text-primary rounded-full font-label-sm hover:bg-primary/15">
          <span className="material-symbols-outlined text-[16px]">auto_awesome</span>
          Draft with AI
        </button>
      </span>
      <textarea value={safeStr(value)} onChange={onChange} rows={3} data-testid={testid}
        className="w-full px-md py-md bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20" />
    </label>
  );
}

export function Step6Branding({ branding, setBranding, customBlocks }) {
  const toast = useToast();
  const upd = (k) => (e) => setBranding((s) => ({ ...s, [k]: e.target.value }));
  const aiDraft = (field, label) => () => {
    toast.info(`AI ${label} draft coming soon — for now, type your own.`);
  };

  return (
    <div className="glass-card rounded-xl p-lg space-y-md" data-testid="step-branding">
      <h3 className="font-headline-sm text-headline-sm text-primary">Agency Branding & Template</h3>
      <div className="space-y-sm">
        <label className="font-label-md text-sm font-bold text-on-surface block">Template Architecture Gallery</label>
        <p className="text-xs text-on-surface-variant m-0 mb-3">Select the design layout and typography system for this proposal's PDF export and live preview.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {TEMPLATE_LIST.map(tpl => {
            const isSelected = (safeStr(branding?.template_style || 'classic') === tpl.slug) || (tpl.slug === 'classic' && !branding?.template_style);
            return (
              <div
                key={tpl.slug}
                onClick={() => setBranding(s => ({ ...s, template_style: tpl.slug }))}
                className={`group relative rounded-xl border-2 overflow-hidden cursor-pointer transition-all ${isSelected ? 'border-primary shadow-md bg-primary/5' : 'border-outline-variant hover:border-primary/50 bg-surface-container-lowest'}`}
              >
                <div className="h-28 w-full overflow-hidden relative bg-slate-100">
                  <img src={tpl.thumbnail} alt={tpl.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-black/60 text-white backdrop-blur-sm">
                    {tpl.category}
                  </span>
                  {isSelected && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow">
                      <span className="material-symbols-outlined text-[16px]">check</span>
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <h4 className="font-bold text-sm text-on-surface m-0 mb-1 flex items-center justify-between">
                    {tpl.name}
                    {tpl.slug === 'editorial' && <span className="text-[9px] bg-rose-500 text-white font-extrabold px-1.5 py-0.5 rounded uppercase">New</span>}
                  </h4>
                  <p className="text-xs text-on-surface-variant line-clamp-2 m-0 leading-snug">{tpl.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <LogoUploader value={branding?.logo_url} onChange={(v) => setBranding((s) => ({ ...s, logo_url: v }))} label="Agency Logo" testid="brand-logo-uploader" folder="logos" />
        <LogoUploader value={branding?.cover_image_url} onChange={(v) => setBranding((s) => ({ ...s, cover_image_url: v }))} label="Cover Image" testid="brand-cover-uploader" folder="covers" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <Field label="Agency Name" value={branding?.agency_name} onChange={upd('agency_name')} testid="brand-name" />
        <Field label="Address"     value={branding?.address}     onChange={upd('address')}     testid="brand-address" />
        <Field label="Contact Email" type="email" value={branding?.contact_email} onChange={upd('contact_email')} testid="brand-email" />
        <Field label="Contact Phone" value={branding?.contact_phone} onChange={upd('contact_phone')} testid="brand-phone" />
        <Field label="Website" value={branding?.website} onChange={upd('website')} testid="brand-website" />
        <Field label="Facebook"  value={branding?.social_facebook}  onChange={upd('social_facebook')}  testid="brand-fb" />
        <Field label="Instagram" value={branding?.social_instagram} onChange={upd('social_instagram')} testid="brand-ig" />
        <Field label="LinkedIn"  value={branding?.social_linkedin}  onChange={upd('social_linkedin')}  testid="brand-li" />
      </div>
      <Textarea label="Highlights" value={branding?.highlights} onChange={upd('highlights')} testid="brand-highlights" placeholder="Bullet points of the trip's standout moments…" />
      <TextareaWithAI label="What's Included" value={branding?.inclusions} onChange={upd('inclusions')} testid="brand-inclusions" onAI={aiDraft('inclusions', 'inclusions')} />
      <TextareaWithAI label="What's Excluded" value={branding?.exclusions} onChange={upd('exclusions')} testid="brand-exclusions" onAI={aiDraft('exclusions', 'exclusions')} />
      <TextareaWithAI label="Terms of Payment" value={branding?.terms_of_payment} onChange={upd('terms_of_payment')} testid="brand-terms" onAI={aiDraft('terms_of_payment', 'terms')} />
      
      {/* Custom Branding Fields */}
      <div className="pt-md border-t border-outline-variant space-y-3">
        <div className="flex justify-between items-center">
          <div>
            <h4 className="font-headline-sm text-sm font-bold text-primary m-0">Custom Branding Fields</h4>
            <p className="text-xs text-on-surface-variant m-0">Add extra badges, license numbers, affiliations, or taglines to appear on all proposals.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              const current = Array.isArray(branding?.custom_fields) ? branding.custom_fields.filter(f => f && typeof f === 'object') : [];
              const next = [...current, { id: Date.now() + Math.random(), label: '', value: '' }];
              setBranding(s => ({ ...(s || {}), custom_fields: next }));
            }}
            className="px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">add</span> Add Field
          </button>
        </div>
        {(Array.isArray(branding?.custom_fields) ? branding.custom_fields.filter(f => f && typeof f === 'object') : []).map((cf, idx) => (
          <div key={cf.id || idx} className="flex gap-2 items-center bg-surface-container-lowest p-2 rounded-lg border border-outline-variant">
            <input
              type="text"
              placeholder="Label (e.g. IATA License)"
              value={cf.label || ''}
              onChange={(e) => {
                const current = Array.isArray(branding?.custom_fields) ? branding.custom_fields.filter(f => f && typeof f === 'object') : [];
                const next = current.map((item, i) => i === idx ? { ...item, label: e.target.value } : item);
                setBranding(s => ({ ...(s || {}), custom_fields: next }));
              }}
              className="w-1/3 px-3 py-1.5 rounded text-xs border border-outline-variant bg-surface-container-lowest"
            />
            <input
              type="text"
              placeholder="Value (e.g. 98-1-23456)"
              value={cf.value || ''}
              onChange={(e) => {
                const current = Array.isArray(branding?.custom_fields) ? branding.custom_fields.filter(f => f && typeof f === 'object') : [];
                const next = current.map((item, i) => i === idx ? { ...item, value: e.target.value } : item);
                setBranding(s => ({ ...(s || {}), custom_fields: next }));
              }}
              className="flex-1 px-3 py-1.5 rounded text-xs border border-outline-variant bg-surface-container-lowest"
            />
            <button
              type="button"
              onClick={() => {
                const current = Array.isArray(branding?.custom_fields) ? branding.custom_fields.filter(f => f && typeof f === 'object') : [];
                const next = current.filter((_, i) => i !== idx);
                setBranding(s => ({ ...(s || {}), custom_fields: next }));
              }}
              className="p-1 text-error hover:bg-error/10 rounded transition-colors"
              title="Remove Field"
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
            </button>
          </div>
        ))}
      </div>

      {customBlocks && customBlocks.length > 0 && (
        <div className="pt-md border-t border-outline-variant space-y-md">
          <h4 className="font-headline-sm text-headline-sm text-primary">Custom Sections</h4>
          {customBlocks.map((block, idx) => {
            const bId = String(block?.id || block?.label || idx);
            return (
              <div key={bId}>
                {block?.type === 'text' ? (
                   <Textarea label={block?.label || 'Custom'} value={branding?.[bId]} onChange={upd(bId)} testid={`brand-${bId}`} placeholder={`Enter content for ${block?.label || 'Custom'}...`} />
                ) : (
                   <LogoUploader value={branding?.[bId]} onChange={(v) => setBranding(s => ({ ...s, [bId]: v }))} label={block?.label || 'Custom Logo'} testid={`brand-${bId}`} folder="custom" />
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="font-label-sm text-on-surface-variant">Branding is stored on this proposal and used in the preview & export. Defaults are inherited from your Agency Branding page.</p>
    </div>
  );
}

export default Step6Branding;
