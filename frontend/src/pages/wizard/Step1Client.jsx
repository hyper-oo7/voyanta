import { useEffect, useImperativeHandle, forwardRef, memo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { COUNTRY_CODES } from '../../lib/countries.js';

const clientSchema = z.object({
  customer_name: z.string().min(1, 'Customer Name is required'),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.union([z.literal(''), z.string().email('Invalid email')]).optional(),
  destination: z.string().min(1, 'Destination is required'),
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
  budget: z.union([z.literal(''), z.number()]).optional(),
  special_notes: z.string().optional(),
}).refine(data => {
  if (data.date_mode === 'dates') {
    return !!data.start_date && !!data.end_date;
  }
  return true;
}, {
  message: 'Start and End dates are required',
  path: ['start_date']
});

const Field = memo(function Field({ label, register, name, type = 'text', testid, extraClass = '', error }) {
  return (
    <label className={'flex flex-col gap-xs ' + extraClass}>
      <span className="font-label-md text-label-md text-on-surface">{label}</span>
      <input type={type} {...register(name, { valueAsNumber: type === 'number' })} data-testid={testid}
        className={`px-md py-md bg-white border rounded-lg font-body-md focus:ring-2 focus:ring-primary/20 ${error ? 'border-error' : 'border-outline-variant'}`} />
      {error && <span className="text-xs text-error">{error.message}</span>}
    </label>
  );
});

export const Step1Client = forwardRef(function Step1Client({ client, setClient }, ref) {
  const { register, watch, handleSubmit, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      ...client,
      num_adults: parseInt(client.num_adults) || 1,
      num_children: parseInt(client.num_children) || 0,
      duration_days: parseInt(client.duration_days) || 1,
      duration_nights: parseInt(client.duration_nights) || 1,
    },
    mode: 'onChange'
  });

  const values = watch();

  useEffect(() => {
    // Keep parent state synced for auto-saving drafts
    setClient(values);
  }, [JSON.stringify(values), setClient]);

  useImperativeHandle(ref, () => ({
    validate: async () => {
      let isValid = false;
      await handleSubmit(
        (data) => { isValid = true; },
        (err) => { isValid = false; }
      )();
      return isValid;
    }
  }));

  const date_mode = watch('date_mode');
  const start_date = watch('start_date');
  const end_date = watch('end_date');

  const handleDateModeChange = (mode) => setValue('date_mode', mode, { shouldValidate: true });
  
  useEffect(() => {
    if (date_mode === 'dates' && start_date && end_date) {
      const ms = new Date(end_date).getTime() - new Date(start_date).getTime();
      const nights = Math.max(1, Math.round(ms / 86400000));
      setValue('duration_nights', nights, { shouldValidate: true });
      setValue('duration_days', nights + 1, { shouldValidate: true });
    }
  }, [start_date, end_date, date_mode, setValue]);

  return (
    <div className="glass-card rounded-xl p-lg space-y-md text-on-surface" data-testid="step-1">
      <h3 className="font-headline-sm text-headline-sm text-primary">Client Information</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
        <Field label="Customer Name *" name="customer_name" register={register} error={errors.customer_name} testid="customer-name" />
        <div className="flex gap-xs">
          <div>
            <label className="font-label-md text-label-md text-on-surface block mb-xs">Country Code</label>
            <select {...register('country')} data-testid="country-code"
              className="px-md py-md bg-white border border-outline-variant rounded-lg font-body-md">
              {COUNTRY_CODES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <Field label="Phone Number" name="phone" register={register} error={errors.phone} testid="phone" extraClass="flex-1" />
        </div>
        <Field label="Email" name="email" type="email" register={register} error={errors.email} testid="email" />
        <Field label="Destination *" name="destination" register={register} error={errors.destination} testid="destination" />
        
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
              <Field label="Number of Nights" name="duration_nights" type="number" register={register} error={errors.duration_nights} testid="duration-nights" extraClass="flex-1" />
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
          className="w-full px-md py-md bg-white border border-outline-variant rounded-lg font-body-md" />
      </div>
    </div>
  );
});
