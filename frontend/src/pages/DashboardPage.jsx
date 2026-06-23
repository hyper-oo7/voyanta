import { useEffect, useRef } from 'react';
import StitchPage from '../components/StitchPage.jsx';
import navMap from '../lib/navMap.js';
import { VoyantaDashboard_bodyClass, VoyantaDashboard_extraStyles, VoyantaDashboard_html } from './_html/voyanta_dashboard.js';
import { fetchDashboardSummary } from '../services/dashboardService.js';

// The dashboard page wraps the Stitch HTML but hydrates the four data points
// (stats + recent proposals table + activity feed) from the service layer so
// they can later be swapped to Supabase without touching JSX.
export default function DashboardPage() {
  const wrapperRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await fetchDashboardSummary();
      if (cancelled || !wrapperRef.current) return;
      const root = wrapperRef.current;

      // Hydrate stat numbers (3 of them, in order)
      const statNodes = root.querySelectorAll('.glass-card .font-display.text-headline-lg');
      const stats = [data.totalProposals, data.totalTemplates, data.activeClients];
      statNodes.forEach((node, i) => {
        if (stats[i] != null) node.textContent = stats[i];
      });

      // Hydrate Recent Proposals table rows
      const tbody = root.querySelector('table tbody');
      if (tbody && data.recentProposals?.length) {
        tbody.innerHTML = data.recentProposals.map((p) => `
          <tr class="hover:bg-surface-container-low transition-colors group">
            <td class="px-lg py-md">
              <div class="font-label-md text-label-md text-primary group-hover:underline cursor-pointer">${p.name}</div>
            </td>
            <td class="px-lg py-md font-body-md text-body-md text-on-surface">${p.client}</td>
            <td class="px-lg py-md">
              <span class="px-md py-xs ${statusChipClass(p.status)} text-[11px] font-bold rounded-full uppercase tracking-widest">${p.status}</span>
            </td>
            <td class="px-lg py-md font-body-md text-body-md text-on-surface-variant">${p.date}</td>
          </tr>
        `).join('');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <div ref={wrapperRef}>
      <StitchPage
        styleId="stitch-style-dashboard"
        bodyClass={VoyantaDashboard_bodyClass}
        extraStyles={VoyantaDashboard_extraStyles}
        html={VoyantaDashboard_html}
        navMap={navMap}
      />
    </div>
  );
}

function statusChipClass(status) {
  switch ((status || '').toLowerCase()) {
    case 'accepted': return 'bg-surface-container-highest text-primary';
    case 'sent': return 'bg-primary-container text-on-primary-container';
    case 'draft': return 'bg-surface-variant text-on-surface-variant';
    default: return 'bg-surface-container text-on-surface-variant';
  }
}
