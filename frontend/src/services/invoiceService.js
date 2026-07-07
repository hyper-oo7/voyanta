import { supabase, getAgencyId } from '../lib/supabaseClient.js';
import { logActivity } from './activityLogService.js';
import { settingsService } from './resourceService.js';
import { upsertClientFromProposal } from './crmService.js';

const INVOICE_CACHE_KEY = 'voyanta_invoices_data';
const RECEIPT_CACHE_KEY = 'voyanta_receipts_data';

function notifyDbError(resource, error) {
  console.error(`Supabase DB Error in ${resource}:`, error);
  window.dispatchEvent(
    new CustomEvent('voyanta:database-error', {
      detail: { resource, error: error?.message || String(error) },
    })
  );
}

export const INVOICE_STATUSES = [
  { id: 'Draft', label: 'Draft', color: 'bg-slate-500/10 text-slate-500 border-slate-500/20' },
  { id: 'Sent', label: 'Sent', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' },
  { id: 'Partially Paid', label: 'Partially Paid', color: 'bg-amber-500/10 text-amber-500 border-amber-500/20' },
  { id: 'Paid', label: 'Paid', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' },
  { id: 'Cancelled', label: 'Cancelled', color: 'bg-rose-500/10 text-rose-500 border-rose-500/20' },
  { id: 'Refunded', label: 'Refunded', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' },
];

function getLocalList(key) {
  try {
    const raw = localStorage.getItem(`${key}_${getAgencyId()}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  try {
    const globalRaw = localStorage.getItem(key);
    if (globalRaw) {
      const list = JSON.parse(globalRaw);
      return Array.isArray(list) ? list.filter(i => !i.agency_id || i.agency_id === getAgencyId()) : [];
    }
  } catch {}
  return [];
}

function saveLocalList(key, list) {
  const agencyId = getAgencyId();
  try {
    localStorage.setItem(`${key}_${agencyId}`, JSON.stringify(list));
  } catch {}
}

export async function fetchInvoices({ clientName = null, status = null, destination = null, currency = null } = {}) {
  const agencyId = getAgencyId();
  if (supabase) {
    try {
      let query = supabase.from('invoices').select('*').eq('agency_id', agencyId).order('created_at', { ascending: false });
      if (status && status !== 'ALL') query = query.eq('status', status);
      const { data, error } = await query;
      if (!error && data) {
        saveLocalList(INVOICE_CACHE_KEY, data);
        return filterList(data, { clientName, status, destination, currency });
      }
    } catch (e) {
      // Table might not exist yet, try templates table fallback
      try {
        const { data: tData, error: tErr } = await supabase
          .from('templates')
          .select('*')
          .eq('category', 'Invoice')
          .eq('agency_id', agencyId)
          .order('created_at', { ascending: false });
        if (!tErr && tData) {
          const mapped = tData.map(r => r.data || {});
          saveLocalList(INVOICE_CACHE_KEY, mapped);
          return filterList(mapped, { clientName, status, destination, currency });
        }
      } catch {}
    }
  }

  const list = getLocalList(INVOICE_CACHE_KEY);
  return filterList(list, { clientName, status, destination, currency });
}

function filterList(list, { clientName, status, destination, currency }) {
  const normalized = (list || []).map(inv => {
    const copy = { ...inv };
    if (copy.status === 'Paid') {
      copy.paid_amount = Number(copy.total_amount || copy.paid_amount || 0);
      copy.remaining_balance = 0;
    } else if (copy.status === 'Cancelled' || copy.status === 'Refunded') {
      copy.remaining_balance = 0;
    } else if (copy.remaining_balance === undefined || copy.remaining_balance === null) {
      copy.remaining_balance = Math.max(0, Number(copy.total_amount || 0) - Number(copy.paid_amount || 0));
    }
    if (!Array.isArray(copy.taxes) || copy.taxes.length === 0) {
      copy.taxes = [{ id: 'tax-1', name: 'GST / Tax', rate: Number(copy.tax_rate !== undefined ? copy.tax_rate : 5), amount: Number(copy.tax_amount || 0) }];
    }
    return copy;
  });
  return normalized.filter(inv => {
    if (clientName && !(inv.client_name || '').toLowerCase().includes(clientName.toLowerCase())) return false;
    if (status && status !== 'ALL' && inv.status !== status) return false;
    if (destination && !(inv.destination || '').toLowerCase().includes(destination.toLowerCase())) return false;
    if (currency && inv.currency !== currency) return false;
    return true;
  });
}

export async function getInvoiceById(id) {
  const all = await fetchInvoices();
  return all.find(i => i.id === id) || null;
}

export async function getInvoicesByClient(clientName) {
  if (!clientName) return [];
  const all = await fetchInvoices();
  return all.filter(i => (i.client_name || '').toLowerCase().trim() === clientName.toLowerCase().trim());
}

export async function getNextInvoiceNumber() {
  const settings = await settingsService.get();
  const format = settings.invoice_number_format || 'INV-000001';
  const nextSeq = Number(settings.invoice_next_sequence || 1);
  
  let prefix = 'INV-';
  let padLen = 6;
  if (settings.invoice_custom_prefix) {
    prefix = settings.invoice_custom_prefix;
  } else if (format.includes('-') && !format.startsWith('CUSTOM')) {
    const parts = format.split('-');
    prefix = parts.slice(0, -1).join('-') + '-';
    padLen = parts[parts.length - 1].length || 6;
  }
  
  const numStr = String(nextSeq).padStart(padLen, '0');
  const invoiceNo = `${prefix}${numStr}`;

  // Increment sequence asynchronously without blocking
  try {
    settingsService.update({ ...settings, invoice_next_sequence: nextSeq + 1 }).catch(() => {});
  } catch {}

  return invoiceNo;
}

export async function createInvoiceFromProposal(proposal, customBranding = null) {
  const agencyId = getAgencyId();
  const settings = await settingsService.get();
  const branding = customBranding || proposal?.preferences?.branding || proposal?.branding || settings;
  const invoiceNumber = await getNextInvoiceNumber();
  
  const now = new Date();
  const dueDate = new Date();
  dueDate.setDate(now.getDate() + 10);

  // Parse items from proposal
  const propItems = proposal?.items || proposal?.itinerary || [];
  const invoiceItems = [];
  
  if (Array.isArray(propItems) && propItems.length > 0) {
    propItems.forEach((it, idx) => {
      const desc = it.title || it.name || it.destination || `Itinerary Item ${idx + 1}`;
      const rate = Number(it.price || it.cost || it.amount || 0);
      const qty = Number(it.qty || it.days || 1);
      invoiceItems.push({
        id: `item_${Date.now()}_${idx}`,
        description: desc,
        qty: qty,
        rate: rate,
        amount: rate * qty
      });
    });
  } else {
    // Default item if proposal has no itemized breakdown
    const totalPropPrice = Number(proposal?.price || proposal?.total_price || proposal?.computed_totals?.total || 5000);
    invoiceItems.push({
      id: `item_${Date.now()}_0`,
      description: `Travel Concierge Services & Package Booking - ${proposal?.destination || proposal?.name || 'Custom Itinerary'}`,
      qty: 1,
      rate: totalPropPrice,
      amount: totalPropPrice
    });
  }

  const subtotal = invoiceItems.reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
  const defaultTaxes = Array.isArray(settings.default_taxes) && settings.default_taxes.length > 0
    ? settings.default_taxes
    : [{ id: 'tax-1', name: 'GST / Tax', rate: Number(settings.default_tax_rate || 5) }];
  const taxes = defaultTaxes.map((t, idx) => ({
    id: t.id || `tax_${Date.now()}_${idx}`,
    name: t.name || 'GST / Tax',
    rate: Number(t.rate !== undefined ? t.rate : 5),
    amount: Math.round((subtotal * Number(t.rate !== undefined ? t.rate : 5)) / 100)
  }));
  const taxRate = taxes.length > 0 ? Number(taxes[0].rate || 0) : Number(settings.default_tax_rate || 5);
  const taxAmount = taxes.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
  const totalAmount = subtotal + taxAmount;

  const newInvoice = {
    id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    agency_id: agencyId,
    proposal_id: proposal?.id || null,
    client_name: proposal?.client_name || proposal?.client || 'Valued Client',
    client_email: proposal?.client_email || proposal?.email || '',
    client_phone: proposal?.client_phone || proposal?.phone || '',
    destination: proposal?.destination || '',
    invoice_number: invoiceNumber,
    status: 'Sent',
    issue_date: now.toISOString().split('T')[0],
    due_date: dueDate.toISOString().split('T')[0],
    currency: proposal?.currency || settings?.default_currency || 'INR',
    subtotal: subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    paid_amount: 0,
    remaining_balance: totalAmount,
    parent_invoice_id: null,
    items: invoiceItems,
    taxes: taxes,
    notes: settings?.invoice_default_notes || 'Thank you for choosing Voyanta Luxury Travel for your upcoming journey.',
    terms: settings?.terms_conditions || '1. Payment is due within the specified timeframe.\n2. All bookings are subject to availability upon payment receipt.',
    upi_id: branding?.upi_id || settings?.upi_id || 'voyantatravel@okaxis',
    upi_payee_name: branding?.upi_payee_name || branding?.agency_name || settings?.agency_name || 'Voyanta Luxury Travel',
    branding: {
      agency_name: branding?.agency_name || settings?.agency_name || 'Voyanta Luxury Travel',
      logo_url: branding?.logo_url || settings?.logo_url || '',
      contact_email: branding?.contact_email || settings?.contact_email || 'concierge@voyantatravel.com',
      contact_phone: branding?.contact_phone || settings?.contact_phone || '',
      primary_color: branding?.primary_color || settings?.primary_color || '#0f172a',
      address: branding?.address || settings?.address || ''
    },
    activity_log: [
      { action: 'Generated', timestamp: now.toISOString(), details: `Generated from proposal "${proposal?.name || 'Custom'}"` }
    ],
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };

  return await saveInvoiceRecord(newInvoice, true);
}

export async function createInvoice(customData = {}) {
  const agencyId = getAgencyId();
  let settings = null;
  try {
    const sGuard = new Promise(resolve => setTimeout(() => resolve(null), 800));
    settings = await Promise.race([settingsService.get(), sGuard]);
  } catch {}
  if (!settings) {
    try {
      const raw = localStorage.getItem('voyanta_settings_data');
      if (raw) settings = JSON.parse(raw);
    } catch {}
  }
  if (!settings) settings = {};

  let invoiceNumber = `INV-${Math.floor(100000 + Math.random() * 900000)}`;
  try {
    const numGuard = new Promise(resolve => setTimeout(() => resolve(null), 800));
    const num = await Promise.race([getNextInvoiceNumber(), numGuard]);
    if (num) invoiceNumber = num;
  } catch {}

  const now = new Date();
  const dueDate = new Date();
  dueDate.setDate(now.getDate() + 10);

  const subtotal = Number(customData.subtotal || 0);
  const defaultTaxes = Array.isArray(customData.taxes) && customData.taxes.length > 0
    ? customData.taxes
    : (Array.isArray(settings.default_taxes) && settings.default_taxes.length > 0
        ? settings.default_taxes
        : [{ id: 'tax-1', name: 'GST / Tax', rate: Number(customData.tax_rate ?? settings.default_tax_rate ?? 5) }]);
  const taxes = defaultTaxes.map((t, idx) => ({
    id: t.id || `tax_${Date.now()}_${idx}`,
    name: t.name || 'GST / Tax',
    rate: Number(t.rate !== undefined ? t.rate : 5),
    amount: Number(t.amount !== undefined && customData.taxes ? t.amount : Math.round((subtotal * Number(t.rate !== undefined ? t.rate : 5)) / 100))
  }));
  const taxRate = taxes.length > 0 ? Number(taxes[0].rate || 0) : Number(customData.tax_rate ?? settings.default_tax_rate ?? 5);
  const taxAmount = Number(customData.tax_amount ?? taxes.reduce((acc, t) => acc + (Number(t.amount) || 0), 0));
  const totalAmount = Number(customData.total_amount ?? (subtotal + taxAmount));

  const newInvoice = {
    id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    agency_id: agencyId,
    proposal_id: customData.proposal_id || null,
    client_name: customData.client_name || 'Valued Client',
    client_email: customData.client_email || '',
    client_phone: customData.client_phone || '',
    destination: customData.destination || 'Concierge Travel Service',
    invoice_number: invoiceNumber,
    status: customData.status || 'Sent',
    issue_date: customData.issue_date || now.toISOString().split('T')[0],
    due_date: customData.due_date || dueDate.toISOString().split('T')[0],
    currency: customData.currency || settings?.default_currency || 'INR',
    subtotal: subtotal,
    tax_rate: taxRate,
    tax_amount: taxAmount,
    total_amount: totalAmount,
    paid_amount: Number(customData.paid_amount || 0),
    remaining_balance: Number(customData.remaining_balance ?? totalAmount),
    parent_invoice_id: customData.parent_invoice_id || null,
    items: customData.items || [],
    taxes: taxes,
    notes: customData.notes || settings?.invoice_default_notes || 'Thank you for choosing Voyanta Luxury Travel.',
    terms: customData.terms || settings?.terms_conditions || '1. Payment is due within the specified timeframe.\n2. All bookings are subject to availability upon payment receipt.',
    upi_id: customData.upi_id || settings?.upi_id || 'voyantatravel@okaxis',
    upi_payee_name: customData.upi_payee_name || settings?.upi_payee_name || settings?.agency_name || 'Voyanta Luxury Travel',
    branding: customData.branding || {
      agency_name: settings?.agency_name || 'Voyanta Luxury Travel',
      logo_url: settings?.logo_url || '',
      contact_email: settings?.contact_email || 'concierge@voyantatravel.com',
      contact_phone: settings?.contact_phone || '',
      primary_color: settings?.primary_color || '#0f172a',
      address: settings?.address || ''
    },
    activity_log: [
      { action: 'Created', timestamp: now.toISOString(), details: 'Created standalone invoice' }
    ],
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };

  return await saveInvoiceRecord(newInvoice, true);
}

export async function saveInvoiceRecord(invoice, isNew = false) {
  const agencyId = getAgencyId();
  const now = new Date().toISOString();
  const updated = { ...invoice, updated_at: now };

  // Always save to localStorage immediately for instant UI response and offline-resilience
  const list = getLocalList(INVOICE_CACHE_KEY);
  const nextList = isNew ? [updated, ...list] : list.map(i => i.id === updated.id ? updated : i);
  saveLocalList(INVOICE_CACHE_KEY, nextList);
  logActivity('invoice', `${isNew ? 'Created' : 'Updated'} invoice #${updated.invoice_number}`, updated.client_name);

  // Sync client profile to CRM automatically
  try {
    if (updated.client_name && updated.client_name !== 'New Client / Organization') {
      upsertClientFromProposal({
        client_name: updated.client_name,
        client_email: updated.client_email || '',
        client_phone: updated.client_phone || '',
        destination: updated.destination || 'Concierge Travel Package'
      }).catch(() => {});
    }
  } catch {}

  // Save to DB asynchronously
  if (supabase) {
    try {
      if (isNew) {
        supabase.from('invoices').insert([updated]).then(({ error }) => {
          if (error) notifyDbError('invoices', error);
        });
      } else {
        supabase.from('invoices').update(updated).eq('id', updated.id).then(({ error }) => {
          if (error) notifyDbError('invoices', error);
        });
      }
    } catch (e) {
      notifyDbError('invoices', e);
    }
  }

  // Notify UI via CustomEvent
  window.dispatchEvent(new CustomEvent('voyanta:invoices-updated', { detail: updated }));
  return updated;
}

export async function updateInvoice(id, patch, actionLog = null) {
  const existing = await getInvoiceById(id);
  if (!existing) throw new Error('Invoice not found');

  const updated = { ...existing, ...patch };
  
  // Recalculate totals if items or tax_rate or taxes changed
  if (patch.items || patch.tax_rate !== undefined || patch.taxes) {
    const sub = (updated.items || []).reduce((acc, item) => acc + (Number(item.amount) || 0), 0);
    let tax = 0;
    if (Array.isArray(updated.taxes) && updated.taxes.length > 0) {
      updated.taxes = updated.taxes.map(t => {
        const amt = t.rate !== undefined && t.rate !== null && t.rate !== '' ? Math.round((sub * Number(t.rate)) / 100) : Number(t.amount || 0);
        return { ...t, amount: amt };
      });
      tax = updated.taxes.reduce((acc, t) => acc + (Number(t.amount) || 0), 0);
      updated.tax_rate = updated.taxes.length === 1 ? Number(updated.taxes[0].rate || 0) : Number(updated.tax_rate || 0);
    } else {
      const tr = Number(updated.tax_rate || 0);
      tax = Math.round((sub * tr) / 100);
      updated.taxes = [{ id: 'tax-1', name: 'GST / Tax', rate: tr, amount: tax }];
    }
    const tot = sub + tax;
    updated.subtotal = sub;
    updated.tax_amount = tax;
    updated.total_amount = tot;
    updated.remaining_balance = Math.max(0, tot - (Number(updated.paid_amount) || 0));
  }

  if (patch.paid_amount !== undefined) {
    updated.remaining_balance = Math.max(0, Number(updated.total_amount) - Number(patch.paid_amount));
    if (updated.remaining_balance === 0) updated.status = 'Paid';
    else if (Number(patch.paid_amount) > 0) updated.status = 'Partially Paid';
  }

  if (actionLog) {
    const logArr = Array.isArray(updated.activity_log) ? [...updated.activity_log] : [];
    logArr.unshift({
      action: actionLog.action || 'Edited',
      timestamp: new Date().toISOString(),
      details: actionLog.details || 'Updated invoice details'
    });
    updated.activity_log = logArr;
  }

  return await saveInvoiceRecord(updated, false);
}

export async function deleteInvoice(id) {
  const existing = await getInvoiceById(id);
  const agencyId = getAgencyId();

  if (supabase) {
    try {
      const { error } = await supabase.from('invoices').delete().eq('id', id).eq('agency_id', agencyId);
      if (error) {
        if (!error.message?.includes('schema cache') && !error.message?.includes('does not exist') && !error.message?.includes('Could not find the table')) {
          notifyDbError('invoices', error);
        }
        console.warn('Supabase delete invoice failed, falling back to local storage:', error.message);
      }
    } catch (e) {
      console.warn('Supabase delete invoice exception, falling back to local storage:', e.message);
    }
  }

  const list = getLocalList(INVOICE_CACHE_KEY);
  const nextList = list.filter(i => i.id !== id);
  saveLocalList(INVOICE_CACHE_KEY, nextList);
  if (existing) logActivity('invoice', `Deleted invoice #${existing.invoice_number}`, existing.client_name);
  return true;
}

export async function generateRemainingBalanceInvoice(parentInvoice, customAmount = null) {
  const remaining = customAmount !== null ? Number(customAmount) : Number(parentInvoice.remaining_balance || 0);
  if (remaining <= 0) throw new Error('No remaining balance to invoice');

  const invoiceNumber = await getNextInvoiceNumber();
  const now = new Date();
  const dueDate = new Date();
  dueDate.setDate(now.getDate() + 7);

  const childInvoice = {
    ...parentInvoice,
    id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    invoice_number: invoiceNumber,
    status: 'Sent',
    issue_date: now.toISOString().split('T')[0],
    due_date: dueDate.toISOString().split('T')[0],
    subtotal: remaining,
    tax_rate: 0, // Assume tax was already calculated/included or apply clean balance
    tax_amount: 0,
    total_amount: remaining,
    paid_amount: 0,
    remaining_balance: remaining,
    parent_invoice_id: parentInvoice.id,
    items: [
      {
        id: `item_${Date.now()}_balance`,
        description: `Remaining Installment Balance for Invoice #${parentInvoice.invoice_number}`,
        qty: 1,
        rate: remaining,
        amount: remaining
      }
    ],
    activity_log: [
      { action: 'Generated Split', timestamp: now.toISOString(), details: `Remaining balance invoice generated from #${parentInvoice.invoice_number}` }
    ],
    created_at: now.toISOString(),
    updated_at: now.toISOString()
  };

  const savedChild = await saveInvoiceRecord(childInvoice, true);
  
  // Log on parent
  await updateInvoice(parentInvoice.id, {}, { action: 'Split Invoice Generated', details: `Generated balance invoice #${invoiceNumber} for ${parentInvoice.currency} ${remaining}` });

  return savedChild;
}

// RECEIPTS ENGINE
export async function fetchReceipts() {
  const list = getLocalList(RECEIPT_CACHE_KEY);
  return list;
}

export async function createReceiptFromInvoice(invoice, paymentMethod = 'UPI', transactionRef = '') {
  const agencyId = getAgencyId();
  const now = new Date();
  const receiptNo = `REC-${String(Date.now()).slice(-6)}`;
  
  const amountPaidThisTransaction = Number(invoice.paid_amount || invoice.total_amount);

  const receipt = {
    id: `rec_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    agency_id: agencyId,
    receipt_number: receiptNo,
    invoice_id: invoice.id,
    invoice_number: invoice.invoice_number,
    client_name: invoice.client_name,
    client_email: invoice.client_email,
    client_phone: invoice.client_phone,
    amount_received: amountPaidThisTransaction,
    currency: invoice.currency || 'INR',
    payment_method: paymentMethod,
    transaction_reference: transactionRef || `TXN_${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
    payment_date: now.toISOString().split('T')[0],
    total_invoice_amount: invoice.total_amount,
    remaining_balance: invoice.remaining_balance || 0,
    branding: invoice.branding || {},
    created_at: now.toISOString()
  };

  const list = getLocalList(RECEIPT_CACHE_KEY);
  saveLocalList(RECEIPT_CACHE_KEY, [receipt, ...list]);

  if (supabase) {
    try {
      await supabase.from('templates').upsert([{
        id: receipt.id,
        agency_id: agencyId,
        name: `Receipt ${receiptNo}`,
        category: 'Receipt',
        data: receipt
      }]);
    } catch {}
  }

  // Update invoice activity log
  await updateInvoice(invoice.id, {
    status: (invoice.remaining_balance <= 0) ? 'Paid' : 'Partially Paid'
  }, {
    action: 'Payment Received',
    details: `Generated receipt #${receiptNo} for ${invoice.currency} ${amountPaidThisTransaction} via ${paymentMethod}`
  });

  logActivity('receipt', `Generated receipt #${receiptNo} for invoice #${invoice.invoice_number}`, invoice.client_name);
  return receipt;
}
