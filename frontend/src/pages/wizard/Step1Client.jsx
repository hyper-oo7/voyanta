import { useEffect, useState, useRef, useImperativeHandle, forwardRef, memo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { COUNTRY_CODES } from '../../lib/countries.js';
import { findClientByContact } from '../../services/crmService.js';
import ContactPicker from '../../components/common/ContactPicker.jsx';

const GROUP_TYPES = ['Solo', 'Couple', 'Family', 'Friends', 'Corporate Group'];

const TOUR_CATEGORIES = [
  'Honeymoon', 'Adventure', 'Luxury', 'Wellness', 'Pilgrimage',
  'Cruise', 'Wildlife Safari', 'Cultural', 'Beach & Islands', 'Mountain & Trekking', 'Custom'
];

const clientSchema = z.object({
  customer_name: z.string().min(1, 'Customer Name is required'),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.union([z.literal(''), z.string().email('Invalid email')]).optional(),
  destination: z.string().min(1, 'Destination is required'),
  group_type: z.string().optional(),
  tour_category: z.string().optional(),
  date_mode: z.enum(['dates', 'days']),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  duration_days: z.number().min(1),
  duration_nights: z.number().min(1),
  arrival_city: z.string().optional(),
  arrival_airport: z.string().optional(),
  departure_city: z.string().optional(),
  departure_airport: z.string().optional(),
  num_adults: z.number().min(1, 'At least 1 adult required'),
  num_children: z.number().min(0).optional(),
  budget: z.union([z.number(), z.nan(), z.string()]).optional().transform(v => Number.isNaN(v) ? undefined : v),
  special_notes: z.string().optional(),
  dietary: z.string().optional(),
  pace: z.string().optional(),
  dislikes: z.array(z.string()).optional().default([]),
}).refine(data => {
  if (data.date_mode === 'dates' && (data.start_date || data.end_date)) {
    return !!data.start_date && !!data.end_date;
  }
  return true;
}, {
  message: 'Start and End dates are required if specifying dates',
  path: ['start_date']
});

const Field = memo(function Field({ label, register, name, type = 'text', testid, extraClass = '', error, disabled = false }) {
  // Fix Issue 4: Strip leading zeros for numeric inputs on focus/change
  const handleNumericInput = (e) => {
    if (type === 'number') {
      let val = e.target.value;
      if (val.length > 1 && val.startsWith('0') && !val.includes('.')) {
        val = val.replace(/^0+/, '');
        e.target.value = val;
      }
    }
  };

  return (
    <label className={'flex flex-col gap-xs ' + extraClass}>
      <span className="font-label-md text-label-md text-on-surface">{label}</span>
      <input type={type} disabled={disabled} {...register(name, { valueAsNumber: type === 'number' })} data-testid={testid}
        onInput={handleNumericInput}
        className={`px-md py-md bg-surface-container-lowest border rounded-lg font-body-md focus:ring-2 focus:ring-primary/20 ${disabled ? 'opacity-70 cursor-not-allowed bg-surface-container/40' : ''} ${error ? 'border-error' : 'border-outline-variant'}`} />
      {error && <span className="text-xs text-error">{error.message}</span>}
    </label>
  );
});

const TagInput = memo(function TagInput({ label, value = [], onChange, suggestions = [] }) {
  const [inputVal, setInputVal] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef(null);

  const filtered = suggestions.filter(s => 
    s.toLowerCase().includes(inputVal.toLowerCase()) && 
    !value.some(existing => existing.toLowerCase() === s.toLowerCase())
  );

  const addTag = (tag) => {
    const trimmed = tag.trim();
    if (trimmed && !value.some(existing => existing.toLowerCase() === trimmed.toLowerCase())) {
      onChange([...value, trimmed]);
    }
    setInputVal('');
    setShowSuggestions(false);
    setHighlightedIndex(-1);
  };

  const removeTag = (tagToRemove) => {
    onChange(value.filter(t => t !== tagToRemove));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filtered.length) {
        addTag(filtered[highlightedIndex]);
      } else if (inputVal.trim()) {
        addTag(inputVal);
      }
    } else if (e.key === ',') {
      e.preventDefault();
      if (inputVal.trim()) {
        addTag(inputVal);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setShowSuggestions(true);
      setHighlightedIndex(prev => Math.min(prev + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => Math.max(prev - 1, -1));
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
      setHighlightedIndex(-1);
    }
  };

  useEffect(() => {
    const clickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', clickOutside);
    return () => document.removeEventListener('mousedown', clickOutside);
  }, []);

  return (
    <div className="flex flex-col gap-xs relative w-full" ref={containerRef}>
      <span className="font-label-md text-label-md text-on-surface">{label}</span>
      <div className="flex flex-wrap gap-xs p-xs min-h-[3.25rem] bg-surface-container-lowest border border-outline-variant rounded-lg focus-within:ring-2 focus-within:ring-primary/20">
        {value.map(tag => (
          <span key={tag} className="flex items-center gap-xs px-sm py-xs bg-surface-container-low text-primary text-xs font-semibold rounded-md border border-outline-variant/40 animate-scale-in">
            {tag}
            <button type="button" onClick={() => removeTag(tag)} className="hover:text-error text-on-surface-variant flex items-center justify-center font-bold">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </span>
        ))}
        <input 
          type="text" 
          value={inputVal}
          onChange={(e) => {
            setInputVal(e.target.value);
            setShowSuggestions(true);
            setHighlightedIndex(-1);
          }}
          onFocus={() => setShowSuggestions(true)}
          onKeyDown={handleKeyDown}
          placeholder={value.length === 0 ? "Type and press Enter or comma..." : ""}
          className="flex-1 min-w-[120px] px-sm py-xs outline-none bg-transparent font-body-md border-0 focus:ring-0 focus:outline-none"
        />
      </div>

      {showSuggestions && filtered.length > 0 && (
        <ul className="absolute z-50 top-[100%] left-0 right-0 mt-xs bg-surface-container-lowest border border-outline-variant/60 rounded-lg shadow-lg max-h-48 overflow-y-auto divide-y divide-outline-variant/30 backdrop-blur-md">
          {filtered.map((suggestion, idx) => (
            <li 
              key={suggestion}
              onClick={() => addTag(suggestion)}
              onMouseEnter={() => setHighlightedIndex(idx)}
              className={`px-md py-md font-body-md cursor-pointer transition-colors ${idx === highlightedIndex ? 'bg-primary/10 text-primary' : 'text-on-surface hover:bg-surface-container-low'}`}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
});

const SubDestinationPicker = memo(function SubDestinationPicker({ destinationName, selectedSubDests = [], onToggleSubDest }) {
  const [subDests, setSubDests] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!destinationName || destinationName.trim().length < 2) {
      setSubDests([]);
      return;
    }

    let isMounted = true;
    setLoading(true);

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/destinations/sub-destinations?destination_name=${encodeURIComponent(destinationName.trim())}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setSubDests(data.sub_destinations || []);
          }
        }
      } catch (err) {
        console.error("Failed to fetch sub-destinations:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [destinationName]);

  if (!destinationName || (subDests.length === 0 && !loading)) return null;

  return (
    <div className="mt-xs p-sm bg-surface-container-low border border-outline-variant/40 rounded-lg space-y-xs">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-primary flex items-center gap-xs">
          <span className="material-symbols-outlined text-[14px]">map</span>
          Select Sub-destinations in {destinationName}:
        </span>
        {loading && <span className="text-[11px] text-on-surface-variant animate-pulse">Loading places...</span>}
      </div>

      <div className="flex flex-wrap gap-xs">
        {subDests.map((sub) => {
          const isSelected = selectedSubDests.includes(sub.name);
          return (
            <button
              key={sub.id || sub.name}
              type="button"
              onClick={() => onToggleSubDest(sub.name)}
              className={`px-sm py-xs text-xs rounded-full border transition-all flex items-center gap-xs ${
                isSelected 
                  ? 'bg-primary text-on-primary border-primary shadow-sm font-medium' 
                  : 'bg-surface-container-lowest text-on-surface border-outline-variant hover:border-primary/50'
              }`}
            >
              <span className="material-symbols-outlined text-[12px]">{isSelected ? 'check_circle' : 'add_circle'}</span>
              {sub.name}
            </button>
          );
        })}
      </div>
    </div>
  );
});

export const Step1Client = forwardRef(function Step1Client({ client, setClient, isNew, proposal }, ref) {
  const { register, watch, handleSubmit, trigger, setValue, reset, formState: { errors } } = useForm({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      ...client,
      date_mode: client.date_mode || 'days',
      num_adults: parseInt(client.num_adults) || 1,
      num_children: parseInt(client.num_children) || 0,
      duration_days: parseInt(client.duration_days) || 5,
      duration_nights: parseInt(client.duration_nights) || 4,
      dietary: client.dietary || '',
      pace: client.pace || '',
      dislikes: client.dislikes || [],
    },
    mode: 'onChange'
  });

  const values = watch();
  const valuesString = JSON.stringify(values);

  useImperativeHandle(ref, () => ({
    validate: async () => {
      const isValid = await trigger();
      return isValid;
    }
  }), [trigger]);

  useEffect(() => {
    if (values && (values.customer_name !== undefined || values.destination !== undefined)) {
      setClient(prev => {
        const next = { ...prev, ...values };
        if (JSON.stringify(prev) !== JSON.stringify(next)) {
          return next;
        }
        return prev;
      });
    }
  }, [valuesString, setClient]);

  const [dislikesTags, setDislikesTags] = useState(client.dislikes || []);
  const [availableTags, setAvailableTags] = useState([]);
  const [prefLoadedNote, setPrefLoadedNote] = useState('');

  const lastProposalIdRef = useRef(proposal?.id || null);

  useEffect(() => {
    const currentPid = proposal?.id || null;
    if (currentPid !== lastProposalIdRef.current) {
      lastProposalIdRef.current = currentPid;
      reset({
        ...client,
        num_adults: parseInt(client.num_adults) || 1,
        num_children: parseInt(client.num_children) || 0,
        duration_days: parseInt(client.duration_days) || 1,
        duration_nights: parseInt(client.duration_nights) || 1,
        dietary: client.dietary || '',
        pace: client.pace || '',
        dislikes: client.dislikes || [],
      });
      setDislikesTags(client.dislikes || []);
    }
  }, [proposal?.id, client, reset]);

  // Sync the form value whenever dislikesTags changes
  useEffect(() => {
    register('dislikes');
    setValue('dislikes', dislikesTags, { shouldValidate: true });
  }, [dislikesTags, register, setValue]);

  // Load distinct object_tags for autocomplete suggestions
  useEffect(() => {
    let isMounted = true;
    (async () => {
      let tags = ['museums', 'adventure', 'relaxed', 'active', 'family', 'couple', 'luxury', 'budget', 'mid', 'nature', 'city', 'history', 'wildlife'];
      try {
        const supa = (await import('../../lib/supabaseClient.js')).supabase;
        const isDemo = (await import('../../lib/supabaseClient.js')).isDemoSession();
        if (supa && !isDemo) {
          const { data } = await supa.from('object_tags').select('tag');
          if (data && isMounted) {
            const unique = Array.from(new Set(data.map(t => t.tag))).sort();
            if (unique.length > 0) {
              tags = unique;
            }
          }
        }
      } catch (err) {
        console.warn("Failed to fetch autocomplete tags", err);
      }
      if (isMounted) {
        setAvailableTags(tags);
      }
    })();
    return () => { isMounted = false; };
  }, []);

  // Watch contact details to trigger debounced prefill
  const emailVal = watch('email');
  const phoneVal = watch('phone');

  useEffect(() => {
    if (!isNew) return;
    if (!emailVal && !phoneVal) {
      setPrefLoadedNote('');
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const foundClient = await findClientByContact({ phone: phoneVal, email: emailVal });
        if (foundClient && foundClient.preferences) {
          const prefs = foundClient.preferences;
          if (prefs.dietary) {
            setValue('dietary', prefs.dietary, { shouldValidate: true });
          }
          if (prefs.pace) {
            setValue('pace', prefs.pace, { shouldValidate: true });
          }
          if (prefs.dislikes && Array.isArray(prefs.dislikes)) {
            setDislikesTags(prefs.dislikes);
          }
          setPrefLoadedNote(`Loaded preferences from ${foundClient.name}'s last trip.`);
        }
      } catch (err) {
        console.warn('Failed to prefill client preferences:', err);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [emailVal, phoneVal, isNew, setValue]);

  const date_mode = watch('date_mode');
  const start_date = watch('start_date');
  const end_date = watch('end_date');
  const destination = watch('destination');
  const group_type = watch('group_type');
  const tour_category = watch('tour_category');
  const duration_days = watch('duration_days');

  // Requirement 1: Conditional Tour Category ("Honeymoon" removal for Solo/Corporate/Family/Friends)
  const nonHoneymoonGroups = ['Solo', 'Corporate Group', 'Family', 'Friends'];
  const availableTourCategories = nonHoneymoonGroups.includes(group_type)
    ? TOUR_CATEGORIES.filter(t => t !== 'Honeymoon')
    : TOUR_CATEGORIES;

  useEffect(() => {
    if (nonHoneymoonGroups.includes(group_type) && tour_category === 'Honeymoon') {
      setValue('tour_category', '', { shouldValidate: true });
    }
  }, [group_type, tour_category, setValue]);

  const [seasonalWarnings, setSeasonalWarnings] = useState([]);

  useEffect(() => {
    if (!destination || !start_date) {
      setSeasonalWarnings([]);
      return;
    }

    let isMounted = true;
    let month = null;
    try {
      const dt = new Date(start_date);
      if (!isNaN(dt.getTime())) {
        month = dt.getMonth() + 1; // 1-indexed
      }
    } catch {}

    if (!month) {
      setSeasonalWarnings([]);
      return;
    }

    try {
      const { getClimateClassification } = await import('../../lib/viClimateIntelligence.js');
      const climate = getClimateClassification(destination, start_date);
      const warnings = [];
      if (climate.isHot || climate.isMonsoon || climate.isSnow) {
        warnings.push({ text: climate.profileNotes || `Expected Season: ${climate.seasonName}` });
      }
      setSeasonalWarnings(warnings);
    } catch (err) {
      console.error("Failed to fetch seasonal rules:", err);
      setSeasonalWarnings([]);
    }

    return () => { isMounted = false; };
  }, [destination, start_date]);

  const handleDateModeChange = (mode) => setValue('date_mode', mode, { shouldValidate: true });
  
  useEffect(() => {
    if (date_mode === 'dates' && start_date && end_date) {
      const ms = new Date(end_date).getTime() - new Date(start_date).getTime();
      const nights = Math.max(0, Math.round(ms / 86400000));
      setValue('duration_nights', nights, { shouldValidate: true });
      setValue('duration_days', nights + 1, { shouldValidate: true });
    } else if (date_mode === 'days' && duration_days > 0) {
      const nights = Math.max(0, parseInt(duration_days, 10) - 1);
      setValue('duration_nights', nights, { shouldValidate: true });
    }
  }, [start_date, end_date, date_mode, duration_days, setValue]);

  return (
    <div className="glass-card rounded-xl p-lg space-y-md text-on-surface" data-testid="step-1">
      {seasonalWarnings.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 px-lg py-md rounded-xl flex items-start gap-md animate-fade-in no-print mb-4">
          <span className="material-symbols-outlined text-amber-600 mt-xs">warning</span>
          <div className="flex-1 space-y-xs">
            <h4 className="font-label-md font-bold text-amber-900">Seasonal Advisory</h4>
            <ul className="list-disc list-inside space-y-1 text-xs text-amber-800">
              {seasonalWarnings.map((w, idx) => (
                <li key={idx} className="font-medium">{w.message}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h3 className="font-headline-sm text-headline-sm text-primary">Client Information</h3>
        <ContactPicker 
          onSelect={(c) => {
            setValue('customer_name', c.name || '', { shouldValidate: true });
            setValue('email', c.email || '', { shouldValidate: true });
            setValue('phone', c.phone || '', { shouldValidate: true });
            if (c.destination) {
              setValue('destination', c.destination, { shouldValidate: true });
            }
          }}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <Field label="Customer Name *" name="customer_name" register={register} error={errors.customer_name} testid="customer-name" />
        <div className="flex gap-xs">
          <div>
            <label className="font-label-md text-label-md text-on-surface block mb-xs">Country Code</label>
            <select {...register('country')} data-testid="country-code"
              className="px-md py-md bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md">
              {COUNTRY_CODES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <Field label="Phone Number" name="phone" register={register} error={errors.phone} testid="phone" extraClass="flex-1" />
        </div>
        <Field label="Email" name="email" type="email" register={register} error={errors.email} testid="email" />
        <div className="col-span-1 md:col-span-2 space-y-xs">
          <label className="font-label-md text-label-md text-on-surface block">Destination *</label>
          <input 
            type="text" 
            {...register('destination')} 
            data-testid="destination" 
            placeholder="e.g. Meghalaya, Kerala, Rajasthan, Goa, Ladakh..."
            className={`w-full px-md py-md bg-surface-container-lowest border rounded-lg font-body-md focus:ring-2 focus:ring-primary/20 ${errors.destination ? 'border-error' : 'border-outline-variant'}`} 
          />
          {errors.destination && <span className="text-xs text-error">{errors.destination.message}</span>}

          {/* Sub-destination suggestion pills */}
          <SubDestinationPicker 
            destinationName={destination} 
            selectedSubDests={client.selected_sub_destinations || []}
            onToggleSubDest={(subName) => {
              const current = client.selected_sub_destinations || [];
              const updated = current.includes(subName)
                ? current.filter(s => s !== subName)
                : [...current, subName];
              setValue('selected_sub_destinations', updated, { shouldValidate: true });
              setClient(prev => ({ ...prev, selected_sub_destinations: updated }));
            }}
          />
        </div>
        <div>
          <label className="font-label-md text-label-md text-on-surface block mb-xs">Who's Travelling?</label>
          <select {...register('group_type')} data-testid="group-type"
            className="w-full px-md py-md bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20">
            <option value="">(Select group)</option>
            {GROUP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="font-label-md text-label-md text-on-surface block mb-xs">Tour Category</label>
          <select {...register('tour_category')} data-testid="tour-category"
            className="w-full px-md py-md bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20">
            <option value="">(Select category)</option>
            {availableTourCategories.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        
        {/* Date Options */}
        <div className="col-span-1 md:col-span-2 border border-outline-variant p-md rounded-lg space-y-sm bg-surface-container-lowest">
          <label className="font-label-md text-label-md text-on-surface font-semibold block">Travel Dates</label>
          <div className="flex gap-md mb-xs">
            <label className="flex items-center gap-xs cursor-pointer">
              <input type="radio" checked={date_mode === 'dates'} onChange={() => handleDateModeChange('dates')} className="accent-primary" />
              <span className="font-body-md">Option A: Start / End Dates</span>
            </label>
            <label className="flex items-center gap-xs cursor-pointer">
              <input type="radio" checked={date_mode === 'days'} onChange={() => handleDateModeChange('days')} className="accent-primary" />
              <span className="font-body-md">Option B: Number of Days</span>
            </label>
          </div>
          
          {date_mode === 'dates' ? (
            <div className="flex gap-md">
              <Field label="Start Date" name="start_date" type="date" register={register} error={errors.start_date} testid="start-date" extraClass="flex-1" />
              <Field label="End Date" name="end_date" type="date" register={register} error={errors.end_date} testid="end-date" extraClass="flex-1" />
              <div className="flex-1 flex flex-col justify-end pb-sm">
                <span className="font-label-md text-on-surface-variant">Auto-calculated: {watch('duration_days')} Days, {watch('duration_nights')} Nights</span>
              </div>
            </div>
          ) : (
            <div className="flex gap-md">
              <Field label="Number of Days" name="duration_days" type="number" register={register} error={errors.duration_days} testid="duration-days" extraClass="flex-1" />
              <Field label="Number of Nights (Auto: Days - 1)" name="duration_nights" type="number" register={register} error={errors.duration_nights} testid="duration-nights" extraClass="flex-1" disabled={true} />
            </div>
          )}
        </div>

        <Field label="Arrival City" name="arrival_city" register={register} error={errors.arrival_city} testid="arrival-city" />
        <Field label="Arrival Airport/Station" name="arrival_airport" register={register} error={errors.arrival_airport} testid="arrival-airport" />
        <Field label="Departure City" name="departure_city" register={register} error={errors.departure_city} testid="departure-city" />
        <Field label="Departure Airport/Station" name="departure_airport" register={register} error={errors.departure_airport} testid="departure-airport" />

        <Field label="Adults" name="num_adults" type="number" register={register} error={errors.num_adults} testid="adults" />
        <Field label="Children" name="num_children" type="number" register={register} error={errors.num_children} testid="children" />
        <Field label="Budget (max)" name="budget" type="number" register={register} error={errors.budget} testid="budget" />
      </div>
      <div>
        <label className="font-label-md text-label-md text-on-surface block mb-xs">Special Notes</label>
        <textarea {...register('special_notes')} rows={3} data-testid="special-notes"
          className="w-full px-md py-md bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md" />
      </div>

      {/* Client Preferences */}
      <div className="border-t border-outline-variant pt-lg space-y-md">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-primary text-xl">psychology</span>
          <h4 className="font-headline-sm text-headline-sm text-primary">Client Preferences</h4>
        </div>
        
        {prefLoadedNote && (
          <div className="text-xs font-semibold text-emerald-700 bg-emerald-500/10 border border-emerald-500/20 px-md py-xs rounded-lg flex items-center gap-xs max-w-max animate-fade-in">
            <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
            {prefLoadedNote}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
          <label className="flex flex-col gap-xs">
            <span className="font-label-md text-label-md text-on-surface">Dietary Preference</span>
            <input 
              type="text" 
              {...register('dietary')} 
              placeholder="e.g. Vegetarian, Vegan, Gluten-free, No seafood"
              className="px-md py-md bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <label className="flex flex-col gap-xs">
            <span className="font-label-md text-label-md text-on-surface">Pace Preference</span>
            <select 
              {...register('pace')}
              className="px-md py-md bg-surface-container-lowest border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20"
            >
              <option value="">(Select Pace)</option>
              <option value="relaxed">Relaxed</option>
              <option value="moderate">Moderate</option>
              <option value="active">Active</option>
              <option value="fast-paced">Fast-paced</option>
            </select>
          </label>

          <div className="col-span-1 md:col-span-2">
            <TagInput 
              label="Dislikes / Avoid Tags" 
              value={dislikesTags} 
              onChange={(newTags) => setDislikesTags(newTags)} 
              suggestions={availableTags}
            />
          </div>
        </div>
      </div>
    </div>
  );
});
