import { z } from 'zod';

export const ProposalHotelSchema = z.object({
  name: z.string(),
  category: z.string().nullable().optional(),
  price_per_night: z.number().nullable().optional(),
  location: z.string().nullable().optional(),
  meal_plan: z.string().nullable().optional(),
  inclusions: z.array(z.string()).default([]),
  image_url: z.string().nullable().optional().default(""),
}).passthrough();

export const ProposalActivitySchema = z.object({
  name: z.string(),
  duration: z.string().nullable().optional(),
  timing: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  location: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  image_url: z.string().nullable().optional().default(""),
}).passthrough();

export const ProposalTransferSchema = z.object({
  transfer_type: z.string().nullable().optional(),
  vehicle: z.string().nullable().optional(),
  from_location: z.string().nullable().optional(),
  to: z.string().nullable().optional(),
  timing: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
}).passthrough();

export const ProposalMealSchema = z.object({
  meal_type: z.string().nullable().optional(),
  venue: z.string().nullable().optional(),
  cuisine: z.string().nullable().optional(),
  price: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  image_url: z.string().nullable().optional().default(""),
}).passthrough();

export const ProposalDaySchema = z.object({
  day_number: z.number().optional(), // optional because frontend might just use day or rely on index
  title: z.string().optional(),
  description: z.string().nullable().optional().default(""),
  sub_destination: z.string().nullable().optional(),
  schedule: z.string().nullable().optional(),
  hotels: z.array(ProposalHotelSchema).default([]),
  activities: z.array(ProposalActivitySchema).default([]),
  transfers: z.array(ProposalTransferSchema).default([]),
  meals: z.array(ProposalMealSchema).default([]),
}).passthrough(); // allows other fields UI might add, like UI state, day, etc.

export const ProposalExtraSectionsSchema = z.object({
  what_to_pack: z.string().nullable().optional(),
  visa_guidelines: z.string().nullable().optional(),
  important_notes: z.string().nullable().optional(),
  damages: z.string().nullable().optional(),
  cancellation_policy: z.string().nullable().optional(),
  dos_and_donts: z.string().nullable().optional(),
  terms_of_payment: z.string().nullable().optional(),
  terms_and_conditions: z.string().nullable().optional(),
  amendment: z.string().nullable().optional(),
  refund: z.string().nullable().optional(),
  about_transport: z.string().nullable().optional(),
  arrival_requirements: z.string().nullable().optional(),
}).catchall(z.any()); // allow arbitrary extra sections

export const FinalProposalSchema = z.object({
  destination: z.string().optional(), // making optional to handle partial frontend saves
  sub_destinations: z.array(z.string()).default([]),
  overview: z.string().nullable().optional().default(""),
  duration_days: z.number().optional(),
  currency: z.string().default("INR"),
  total_price: z.number().nullable().optional(),
  price_per_person: z.number().nullable().optional(),
  days: z.array(ProposalDaySchema).default([]),
  hotels: z.array(ProposalHotelSchema).default([]),
  inclusions: z.array(z.string()).default([]),
  exclusions: z.array(z.string()).default([]),
  extra_sections: ProposalExtraSectionsSchema.default({}),
  model_used: z.string().nullable().optional(),
}).passthrough(); // pass through DB fields like id, client_id, etc.
