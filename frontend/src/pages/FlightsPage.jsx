import { useState } from 'react';
import ResourceModulePage from '../components/ResourceModulePage.jsx';
import { flightsService } from '../services/resourceService.js';

// Flights page adds a From / To / Date / Persons toolbar above the table.
// On submit it filters the imported rows; the same form is the docking point
// for a future realtime API (just swap filter() for an async fetch).
export default function FlightsPage() {
  const [crit, setCrit] = useState({ from: '', to: '', date: '', persons: 1 });

  const filterRows = (rows) => rows.filter((r) => {
    const f = (crit.from || '').trim().toLowerCase();
    const t = (crit.to   || '').trim().toLowerCase();
    const d = crit.date;
    if (f && !String(r.origin || '').toLowerCase().includes(f)) return false;
    if (t && !String(r.destination || '').toLowerCase().includes(t)) return false;
    if (d && r.depart_date && String(r.depart_date).slice(0, 10) !== d) return false;
    return true;
  });

  return <ResourceModulePage
    resource="flights" service={flightsService}
    title="Flights" subtitle="Imported airline / consolidator inventory."
    sidebarLabel="Flights" itemKind="flight"
    toLabel={(r) => `${r.airline || 'Flight'} ${r.flight_no || ''} ${r.origin || ''}→${r.destination || ''}`.trim()}
    toUnitPrice={(r) => Number(r.cost || 0) * Number(crit.persons || 1)}
    filterRows={filterRows}
    renderToolbar={() => (
      <form onSubmit={(e) => e.preventDefault()} className="grid grid-cols-2 md:grid-cols-5 gap-md p-md bg-surface-container-lowest rounded-xl border border-outline-variant" data-testid="flight-search">
        <Field label="From"     value={crit.from}    onChange={(v) => setCrit((c) => ({ ...c, from: v }))} placeholder="JFK / New York"   testid="from" />
        <Field label="To"       value={crit.to}      onChange={(v) => setCrit((c) => ({ ...c, to:   v }))} placeholder="CDG / Paris"      testid="to" />
        <Field label="Date"     type="date" value={crit.date} onChange={(v) => setCrit((c) => ({ ...c, date: v }))} testid="date" />
        <Field label="Persons"  type="number" value={crit.persons} onChange={(v) => setCrit((c) => ({ ...c, persons: Math.max(1, parseInt(v||'1',10)) }))} testid="persons" />
        <button data-testid="search-btn" className="self-end px-lg py-md bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 h-fit">
          <span className="material-symbols-outlined mr-xs text-[18px]">search</span>Search
        </button>
      </form>
    )}
  />;
}

function Field({ label, value, onChange, type = 'text', placeholder, testid }) {
  return (
    <label className="flex flex-col gap-xs">
      <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest">{label}</span>
      <input type={type} value={value} placeholder={placeholder} data-testid={`flight-${testid}`}
        onChange={(e) => onChange(e.target.value)}
        className="px-md py-sm bg-white border border-outline-variant rounded-lg font-body-md focus:ring-2 focus:ring-primary/20" />
    </label>
  );
}
