import { memo } from 'react';
import { useToast } from '../../context/ToastContext.jsx';
import LogoUploader from '../../components/LogoUploader.jsx';

const safeStr = (v) => Array.isArray(v) ? v.join('\n') : (v && typeof v === 'object' ? JSON.stringify(v) : (v ?? ''));

const Field = memo(function Field({ label, value, onChange, type = 'text', testid, extraClass = '' }) {
  return (
    <label className={'flex flex-col gap-xs ' + extraClass}>
      <span className="font-label-md text-label-md text-on-surface">{label}</span>
      <input type={type} value={safeStr(value)} onChange={onChange} data-testid={testid}
        className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20" />
    </label>
  );
});

const Textarea = memo(function Textarea({ label, value, onChange, testid, placeholder = '' }) {
  return (
    <label className="flex flex-col gap-xs">
      <span className="font-label-md text-label-md text-on-surface">{label}</span>
      <textarea value={safeStr(value)} onChange={onChange} rows={3} placeholder={placeholder} data-testid={testid}
        className="w-full px-md py-md bg-white border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20" />
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
        className="w-full px-md py-md bg-white border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20" />
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
      <div className="grid grid-cols-1 gap-md">
        <div>
          <label className="font-label-md text-label-md text-on-surface block mb-xs">Template Style</label>
          <select value={branding.template_style} onChange={upd('template_style')} data-testid="brand-tpl-style"
            className="w-full px-md py-md bg-white border border-outline-variant rounded-lg font-body-md">
            <option value="elegant">Elegant (cream, serif)</option>
            <option value="dark">Dark Premium</option>
            <option value="light">Light & Friendly</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <LogoUploader value={branding.logo_url} onChange={(v) => setBranding((s) => ({ ...s, logo_url: v }))} label="Agency Logo" testid="brand-logo-uploader" folder="logos" />
        <LogoUploader value={branding.cover_image_url} onChange={(v) => setBranding((s) => ({ ...s, cover_image_url: v }))} label="Cover Image" testid="brand-cover-uploader" folder="covers" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <Field label="Agency Name" value={branding.agency_name} onChange={upd('agency_name')} testid="brand-name" />
        <Field label="Address"     value={branding.address}     onChange={upd('address')}     testid="brand-address" />
        <Field label="Contact Email" type="email" value={branding.contact_email} onChange={upd('contact_email')} testid="brand-email" />
        <Field label="Contact Phone" value={branding.contact_phone} onChange={upd('contact_phone')} testid="brand-phone" />
        <Field label="Website" value={branding.website} onChange={upd('website')} testid="brand-website" />
        <Field label="Facebook"  value={branding.social_facebook}  onChange={upd('social_facebook')}  testid="brand-fb" />
        <Field label="Instagram" value={branding.social_instagram} onChange={upd('social_instagram')} testid="brand-ig" />
        <Field label="LinkedIn"  value={branding.social_linkedin}  onChange={upd('social_linkedin')}  testid="brand-li" />
      </div>
      <Textarea label="Highlights" value={branding.highlights} onChange={upd('highlights')} testid="brand-highlights" placeholder="Bullet points of the trip's standout moments…" />
      <TextareaWithAI label="What's Included" value={branding.inclusions} onChange={upd('inclusions')} testid="brand-inclusions" onAI={aiDraft('inclusions', 'inclusions')} />
      <TextareaWithAI label="What's Excluded" value={branding.exclusions} onChange={upd('exclusions')} testid="brand-exclusions" onAI={aiDraft('exclusions', 'exclusions')} />
      <TextareaWithAI label="Terms of Payment" value={branding.terms_of_payment} onChange={upd('terms_of_payment')} testid="brand-terms" onAI={aiDraft('terms_of_payment', 'terms')} />
      
      {customBlocks && customBlocks.length > 0 && (
        <div className="pt-md border-t border-outline-variant space-y-md">
          <h4 className="font-headline-sm text-headline-sm text-primary">Custom Sections</h4>
          {customBlocks.map(block => (
            <div key={block.id}>
              {block.type === 'text' ? (
                 <Textarea label={block.label} value={branding[block.id]} onChange={upd(block.id)} testid={`brand-${block.id}`} placeholder={`Enter content for ${block.label}...`} />
              ) : (
                 <LogoUploader value={branding[block.id]} onChange={(v) => setBranding(s => ({ ...s, [block.id]: v }))} label={block.label} testid={`brand-${block.id}`} folder="custom" />
              )}
            </div>
          ))}
        </div>
      )}

      <p className="font-label-sm text-on-surface-variant">Branding is stored on this proposal and used in the preview & export. Defaults are inherited from your Agency Branding page.</p>
    </div>
  );
}
