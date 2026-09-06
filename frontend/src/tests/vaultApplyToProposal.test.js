import { describe, it, expect, beforeEach, beforeAll } from 'vitest';

// The store reads localStorage at module-init and this suite runs without a DOM,
// so the shim has to be installed before the dynamic import below.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

let useProposalStore;
beforeAll(async () => {
  ({ useProposalStore } = await import('../store/proposalStore.js'));
});

// Trimmed from a real /api/vault/packages response.
const VAULT_PACKAGE = {
  id: 'pkg-1',
  cover_image_url: 'https://example.test/shillong.jpg',
  parsed_data: {
    destination: 'Shillong',
    sub_destinations: ['Cherrapunji', 'Dawki'],
    duration_days: 5,
    currency: 'INR',
    total_price: 48000,
    overview: 'Five days across the Khasi hills.',
    inclusions: ['Breakfast and dinner', 'Private cab'],
    exclusions: ['Airfare'],
    days: [
      { day_number: 1, title: 'Day 1: Arrival in Shillong', description: 'Transfer and check in.' },
      { day_number: 2, title: 'Day 2: Cherrapunji', description: 'Waterfalls and living root bridges.' },
    ],
  },
  extra_sections: { what_to_pack: 'Raincoat\nSturdy shoes' },
};

describe('applying a vault package to the proposal canvas', () => {
  beforeEach(() => {
    useProposalStore.setState({ proposal: null, items: [], client: {} });
  });

  it('setField alone cannot seed a proposal from an empty canvas', () => {
    // Regression guard: the canvas renders off `proposal`, but setField only
    // merges into it when one already exists. Applying a package through
    // setField therefore used to leave the canvas blank.
    expect(useProposalStore.getState().proposal).toBeNull();

    useProposalStore.getState().setField('days', VAULT_PACKAGE.parsed_data.days);
    useProposalStore.getState().setField('destination', 'Shillong');

    expect(useProposalStore.getState().proposal).toBeNull();
    expect(useProposalStore.getState().client.destination).toBe('Shillong');
  });

  it('committing the package as a whole proposal populates the canvas', () => {
    const data = VAULT_PACKAGE.parsed_data;
    const durationDays = data.duration_days || data.days.length;

    useProposalStore.setState({
      proposal: {
        ...data,
        extra_sections: VAULT_PACKAGE.extra_sections,
        cover_image_url: VAULT_PACKAGE.cover_image_url,
      },
      items: [],
      client: {
        ...useProposalStore.getState().client,
        destination: data.destination,
        duration_days: durationDays,
        budget: data.total_price,
      },
    });

    const { proposal, client } = useProposalStore.getState();

    // What UnifiedItineraryCanvas actually reads: `const p = proposal || {}`
    // and `const daysList = p.days || []`.
    expect(proposal).not.toBeNull();
    expect(proposal.days).toHaveLength(2);
    expect(proposal.days[0].title).toBe('Day 1: Arrival in Shillong');
    expect(proposal.destination).toBe('Shillong');
    expect(proposal.duration_days).toBe(5);
    expect(proposal.total_price).toBe(48000);
    expect(proposal.inclusions).toEqual(['Breakfast and dinner', 'Private cab']);
    expect(proposal.extra_sections.what_to_pack).toContain('Raincoat');
    expect(client.destination).toBe('Shillong');
    expect(client.budget).toBe(48000);
  });
});
