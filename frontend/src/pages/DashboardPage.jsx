import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import StitchPage from '../components/StitchPage.jsx';
import navMap from '../lib/navMap.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { VoyantaDashboard_bodyClass, VoyantaDashboard_extraStyles, VoyantaDashboard_html } from './_html/voyanta_dashboard.js';
import { fetchDashboardSummary } from '../services/dashboardService.js';

export default function DashboardPage() {
  const wrapperRef = useRef(null);
  const navigate = useNavigate();
  const toast = useToast();
  const { signOut, isDemo, user } = useAuth();

  // Hydrate stats + recent proposals from the service layer
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchDashboardSummary();
        if (cancelled || !wrapperRef.current) return;
        const root = wrapperRef.current;

        const statNodes = root.querySelectorAll('.glass-card .font-display.text-headline-lg');
        const stats = [data.totalProposals, data.totalTemplates, data.activeClients];
        statNodes.forEach((n, i) => { if (stats[i] != null) n.textContent = stats[i]; });

        const tbody = root.querySelector('table tbody');
        if (tbody) {
          if (!data.recentProposals.length) {
            tbody.innerHTML = '<tr><td colspan="4" class="px-lg py-xl text-center text-on-surface-variant font-body-md" data-testid="dash-empty">No proposals yet.</td></tr>';
          } else {
            tbody.innerHTML = data.recentProposals.map((p) => `
              <tr data-pid="${p.id}" class="hover:bg-surface-container-low transition-colors group cursor-pointer">
                <td class="px-lg py-md"><div class="font-label-md text-label-md text-primary group-hover:underline">${escapeHtml(p.name)}</div></td>
                <td class="px-lg py-md font-body-md text-body-md text-on-surface">${escapeHtml(p.client_name || p.client || '—')}</td>
                <td class="px-lg py-md"><span class="px-md py-xs ${statusChipClass(p.status)} text-[11px] font-bold rounded-full uppercase tracking-widest">${escapeHtml(p.status || 'Draft')}</span></td>
                <td class="px-lg py-md font-body-md text-body-md text-on-surface-variant">${escapeHtml(p.date || '—')}</td>
              </tr>`).join('');
          }
        }
      } catch (e) {
        if (!cancelled) toast.error(e.message || 'Failed to load dashboard');
      }
    })();
    return () => { cancelled = true; };
  }, [toast]);

  // Wire CTAs and sidebar interactions
  useEffect(() => {
    const root = wrapperRef.current;
    if (!root) return;

    // "Create New Proposal" CTA  → wizard
    root.querySelectorAll('button').forEach((btn) => {
      const t = (btn.textContent || '').trim();
      if (/create new proposal|new proposal/i.test(t)) {
        btn.onclick = () => navigate('/proposals/wizard');
      }
      if (/view all/i.test(t)) {
        btn.onclick = () => navigate('/proposals');
      }
    });

    // Floating "+" FAB
    const fab = root.querySelector('button.fixed.bottom-lg');
    if (fab) fab.onclick = () => navigate('/proposals/wizard');

    // Recent-proposal rows → open wizard at preview step (step 8)
    root.querySelectorAll('tbody tr[data-pid]').forEach((tr) => {
      tr.addEventListener('click', () => navigate(`/proposals/wizard?id=${encodeURIComponent(tr.dataset.pid)}&step=8`));
    });

    // Sign-out via user card
    const card = root.querySelector('aside .px-lg.pt-xl div.flex.items-center.gap-md');
    if (card) {
      card.style.cursor = 'pointer';
      card.title = 'Sign out';
      card.onclick = async () => { await signOut(); toast.success('Signed out'); navigate('/login'); };
      // Reflect demo or real user name
      const name = card.querySelector('p.font-label-md');
      const role = card.querySelector('p.font-label-sm');
      if (name) name.textContent = user?.user_metadata?.full_name || (isDemo ? 'Demo User' : (user?.email || 'Voyanta Agent'));
      if (role) role.textContent = isDemo ? 'Demo Session' : (user?.email || 'Premium Agent');
    }
  }, [navigate, signOut, toast, isDemo, user]);

  return (
    <div ref={wrapperRef} style={{ display: 'contents' }}>
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
    case 'sent':     return 'bg-primary-container text-on-primary-container';
    case 'draft':    return 'bg-surface-variant text-on-surface-variant';
    case 'declined': return 'bg-error-container text-on-error-container';
    default:         return 'bg-surface-container text-on-surface-variant';
  }
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
