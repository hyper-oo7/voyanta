import { useMemo, useState } from 'react';

// Generic data table:
//  - auto-derives columns from row keys (or accepts an explicit `columns` prop)
//  - search across all string fields, sortable headers, basic filter, pagination, bulk-select
//  - row-action slot for per-row buttons
//
// Skips internal/system fields by default (id, agency_id, created_at, raw).

const HIDDEN = new Set(['id', 'agency_id', 'created_at', 'updated_at', 'raw', 'created_by']);

export default function DynamicTable({
  rows = [], loading = false, columns: explicit, onAdd, onRowAction, onEditRow,
  selection, onSelectionChange, pageSize = 10, emptyMessage = 'No records yet.',
  toolbarRight,
}) {
  const columns = useMemo(() => {
    if (explicit) return explicit;
    const keys = new Set();
    rows.forEach((r) => Object.keys(r).forEach((k) => { if (!HIDDEN.has(k)) keys.add(k); }));
    return Array.from(keys);
  }, [rows, explicit]);

  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let r = rows;
    if (q) {
      const needle = q.toLowerCase();
      r = r.filter((row) => Object.values(row).some((v) => String(v ?? '').toLowerCase().includes(needle)));
    }
    if (sortKey) {
      r = [...r].sort((a, b) => {
        const av = a[sortKey] ?? '', bv = b[sortKey] ?? '';
        const an = parseFloat(av), bn = parseFloat(bv);
        const cmp = (!isNaN(an) && !isNaN(bn)) ? an - bn : String(av).localeCompare(String(bv));
        return sortDir === 'asc' ? cmp : -cmp;
      });
    }
    return r;
  }, [rows, q, sortKey, sortDir]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);
  const allOnPage = pageRows.length > 0 && pageRows.every((r) => selection?.has(r.id));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    const next = new Set(selection);
    if (allOnPage) pageRows.forEach((r) => next.delete(r.id));
    else pageRows.forEach((r) => next.add(r.id));
    onSelectionChange(next);
  };
  const toggleOne = (id) => {
    if (!onSelectionChange) return;
    const next = new Set(selection);
    next.has(id) ? next.delete(id) : next.add(id);
    onSelectionChange(next);
  };

  const setSort = (k) => {
    if (sortKey === k) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(k); setSortDir('asc'); }
  };

  return (
    <div className="glass-card rounded-xl overflow-hidden flex flex-col" data-testid="dynamic-table">
      <div className="px-lg py-md border-b border-outline-variant flex items-center gap-md flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <span className="material-symbols-outlined absolute left-md top-1/2 -translate-y-1/2 text-on-surface-variant">search</span>
          <input data-testid="table-search" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Search…" className="w-full bg-surface-container-low pl-xl pr-md py-sm rounded-full font-body-md focus:ring-2 focus:ring-primary/20" />
        </div>
        <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-widest" data-testid="table-count">
          {loading ? 'Loading…' : `${filtered.length} of ${rows.length}`}
        </span>
        {toolbarRight}
        {onAdd && (
          <button onClick={onAdd} data-testid="add-record-btn" className="px-lg py-sm bg-primary text-on-primary rounded-lg font-label-md hover:opacity-90 flex items-center gap-xs">
            <span className="material-symbols-outlined text-[18px]">add</span> New
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-surface-container">
              {onSelectionChange && (
                <th className="px-lg py-md w-10">
                  <input type="checkbox" checked={allOnPage} onChange={toggleAll} data-testid="select-all" />
                </th>
              )}
              {columns.map((c) => (
                <th key={c} onClick={() => setSort(c)} data-testid={`th-${c}`}
                  className="px-lg py-md font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider cursor-pointer select-none">
                  <span className="inline-flex items-center gap-xs">
                    {c.replace(/_/g, ' ')}
                    {sortKey === c && <span className="material-symbols-outlined text-[14px]">{sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward'}</span>}
                  </span>
                </th>
              ))}
              {onRowAction && <th className="px-lg py-md text-right" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface-container">
            {loading && (
              <tr><td colSpan={columns.length + 2} className="px-lg py-xl text-center text-on-surface-variant" data-testid="table-loading">Loading…</td></tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr><td colSpan={columns.length + 2} className="px-lg py-xl text-center text-on-surface-variant" data-testid="table-empty">{emptyMessage}</td></tr>
            )}
            {pageRows.map((r) => (
              <tr key={r.id} data-testid={`row-${r.id}`} className={'hover:bg-surface-container-low ' + (selection?.has(r.id) ? 'bg-primary-fixed/30' : '')}>
                {onSelectionChange && (
                  <td className="px-lg py-md">
                    <input type="checkbox" checked={selection?.has(r.id) || false} onChange={() => toggleOne(r.id)} data-testid={`select-${r.id}`} />
                  </td>
                )}
                {columns.map((c) => (
                  <td key={c} className="px-lg py-md font-body-md text-body-md text-on-surface max-w-[260px] truncate" title={String(r[c] ?? '')}>
                    {formatCell(r[c])}
                  </td>
                ))}
                {onRowAction && (
                  <td className="px-lg py-md text-right">
                    <div className="flex justify-end gap-xs">
                      {onEditRow && (
                        <button title="Edit" data-testid={`edit-${r.id}`} onClick={(e) => { e.stopPropagation(); onEditRow(r); }}
                          className="w-8 h-8 inline-flex items-center justify-center rounded-full hover:bg-surface-container-high">
                          <span className="material-symbols-outlined text-[18px]">edit</span>
                        </button>
                      )}
                      {onRowAction(r)}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="px-lg py-md border-t border-outline-variant flex justify-between items-center">
          <span className="font-label-sm text-on-surface-variant">Page {page} of {pages}</span>
          <div className="flex gap-xs">
            <button data-testid="page-prev" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-md py-sm border border-outline-variant rounded font-label-md disabled:opacity-50">Prev</button>
            <button data-testid="page-next" disabled={page === pages} onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="px-md py-sm border border-outline-variant rounded font-label-md disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatCell(v) {
  if (v == null) return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  const s = String(v);
  return s.length > 60 ? s.slice(0, 57) + '…' : s;
}
