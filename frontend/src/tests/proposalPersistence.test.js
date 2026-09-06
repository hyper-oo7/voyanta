import { describe, it, expect, beforeEach, beforeAll } from 'vitest';

// The store touches localStorage at module-init and this suite runs without a
// DOM, so the shim has to exist before the dynamic imports below.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

let useProposalStore;
let isSavedProposalId;
let hydrateProposalContent;

beforeAll(async () => {
  ({ useProposalStore, isSavedProposalId } = await import('../store/proposalStore.js'));
  ({ hydrateProposalContent } = await import('../services/proposalService.js'));
});

const VAULT_APPLIED_PROPOSAL = {
  // No id: a package applied from the vault is an unsaved draft.
  destination: 'Sri Lanka',
  duration_days: 8,
  currency: 'INR',
  total_price: 54999,
  overview: 'Eight days across beaches, hills and culture.',
  days: [
    { day_number: 1, title: 'Arrival in Sri Lanka', description: 'Transfer to Mirissa.' },
    { day_number: 8, title: 'Departure', description: 'Transfer to the airport.' },
  ],
  inclusions: ['All transfers in an air-conditioned vehicle'],
  exclusions: ['Airfare and visa fees'],
  extra_sections: { payment: 'Booking amount of 20,000.' },
};

describe('identifying a saved proposal', () => {
  it('accepts a database uuid', () => {
    expect(isSavedProposalId('a2d77a34-82a9-450f-a0e5-2cc9473a7592')).toBe(true);
  });

  it('rejects the id of a vault package', () => {
    // This is what "Use in Proposal" used to put on the canvas, and it made the
    // PDF renderer emit a one-page "Proposal not found" document.
    expect(isSavedProposalId('vault_1787509779893_0')).toBe(false);
  });

  it('rejects an empty id', () => {
    expect(isSavedProposalId(undefined)).toBe(false);
    expect(isSavedProposalId('')).toBe(false);
  });
});

describe('the proposal body survives a save', () => {
  beforeEach(() => {
    useProposalStore.setState({
      proposal: { ...VAULT_APPLIED_PROPOSAL },
      items: [],
      client: { customer_name: 'Test Client', destination: 'Sri Lanka', duration_days: 8 },
    });
  });

  it('buildPayload carries the days into the itinerary column', () => {
    // `proposals` has no column for days, so anything not placed inside
    // `itinerary` is simply dropped on save.
    const payload = useProposalStore.getState().buildPayload();

    expect(payload.itinerary.days).toHaveLength(2);
    expect(payload.itinerary.days[0].title).toBe('Arrival in Sri Lanka');
    expect(payload.itinerary.overview).toContain('Eight days');
    expect(payload.itinerary.inclusions).toEqual(['All transfers in an air-conditioned vehicle']);
    expect(payload.itinerary.extra_sections.payment).toContain('20,000');
  });

  it('a row read back from the database exposes days again', () => {
    const payload = useProposalStore.getState().buildPayload();

    // What the table hands back: columns, with the body still inside itinerary.
    const row = {
      id: 'a2d77a34-82a9-450f-a0e5-2cc9473a7592',
      destination: payload.destination,
      currency: payload.currency,
      itinerary: payload.itinerary,
    };

    const hydrated = hydrateProposalContent(row);

    // Templates read proposal.days; without hydration the PDF has no itinerary.
    expect(hydrated.days).toHaveLength(2);
    expect(hydrated.days[1].title).toBe('Departure');
    expect(hydrated.overview).toContain('Eight days');
    expect(hydrated.exclusions).toEqual(['Airfare and visa fees']);
  });

  it('tolerates the older shape where itinerary was the days array', () => {
    const hydrated = hydrateProposalContent({
      id: 'a2d77a34-82a9-450f-a0e5-2cc9473a7592',
      itinerary: [{ day_number: 1, title: 'Legacy day' }],
    });
    expect(hydrated.days).toHaveLength(1);
    expect(hydrated.days[0].title).toBe('Legacy day');
  });

  it('leaves a row with no itinerary untouched', () => {
    const row = { id: 'x', name: 'Empty' };
    expect(hydrateProposalContent(row)).toEqual(row);
  });
});
