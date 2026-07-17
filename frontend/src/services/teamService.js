import { supabase, getAgencyId, DEMO_AGENCY_ID } from '../lib/supabaseClient.js';

const MEMBERS_KEY = 'voyanta_team_members';
const INVITES_KEY = 'voyanta_team_invites';

function notifyDbError(resource, error) {
  console.error(`Supabase DB Error in ${resource}:`, error);
  window.dispatchEvent(
    new CustomEvent('voyanta:database-error', {
      detail: { resource, error: error?.message || String(error) },
    })
  );
}

function getLocalMembers() {
  try {
    const raw = localStorage.getItem(MEMBERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return [
    { id: 'u_demo_1', name: 'Raman Sharma', email: 'raman@voyanta.com', role: 'Owner', status: 'Active' },
    { id: 'u_demo_2', name: 'Priya Verma', email: 'priya@voyanta.com', role: 'Admin', status: 'Active' },
  ];
}

function getLocalInvites() {
  try {
    const raw = localStorage.getItem(INVITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocalMembers(members) {
  try {
    localStorage.setItem(MEMBERS_KEY, JSON.stringify(members));
  } catch {}
}

function saveLocalInvites(invites) {
  try {
    localStorage.setItem(INVITES_KEY, JSON.stringify(invites));
  } catch {}
}

export async function getTeam() {
  const agencyId = getAgencyId();
  const isProd = supabase && agencyId !== DEMO_AGENCY_ID;

  if (isProd) {
    try {
      const [membersRes, invitesRes] = await Promise.all([
        supabase.from('users').select('*').eq('agency_id', agencyId),
        supabase.from('team_invitations').select('*').eq('agency_id', agencyId).eq('status', 'pending'),
      ]);

      if (membersRes.error) throw membersRes.error;
      if (invitesRes.error) throw invitesRes.error;

      const members = (membersRes.data || []).map((u) => ({
        id: u.id,
        name: u.full_name || u.email?.split('@')[0] || 'Team Member',
        email: u.email,
        role: u.role || 'Editor',
        status: 'Active',
        isInvite: false,
      }));

      const invitations = (invitesRes.data || []).map((inv) => ({
        id: inv.id,
        name: inv.email.split('@')[0],
        email: inv.email,
        role: inv.role || 'Editor',
        status: 'Invited',
        isInvite: true,
      }));

      saveLocalMembers(members);
      saveLocalInvites(invitations);
      return { members, invitations };
    } catch (e) {
      console.warn('Supabase getTeam failed, falling back to localStorage:', e);
    }
  }

  return {
    members: getLocalMembers(),
    invitations: getLocalInvites(),
  };
}

export async function inviteMember({ email, name, role = 'Editor' }) {
  const agencyId = getAgencyId();
  const isProd = supabase && agencyId !== DEMO_AGENCY_ID;
  const cleanEmail = email.trim().toLowerCase();

  if (isProd) {
    const { data, error } = await supabase
      .from('team_invitations')
      .insert({
        agency_id: agencyId,
        email: cleanEmail,
        role: role,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      notifyDbError('team_invitations', error);
      throw error;
    }

    const newInvite = {
      id: data.id,
      name: name || cleanEmail.split('@')[0],
      email: data.email,
      role: data.role,
      status: 'Invited',
      isInvite: true,
    };
    const updatedInvites = [...getLocalInvites(), newInvite];
    saveLocalInvites(updatedInvites);
    return newInvite;
  }

  // Demo fallback
  const invites = getLocalInvites();
  const newInvite = {
    id: 'inv_' + Date.now(),
    name: name || cleanEmail.split('@')[0],
    email: cleanEmail,
    role: role,
    status: 'Invited',
    isInvite: true,
  };
  const updated = [...invites, newInvite];
  saveLocalInvites(updated);
  return newInvite;
}

export async function updateMemberRole(id, newRole, isInvite = false) {
  if (!id || id === 'null' || id === 'undefined') {
    throw new Error('Invalid team member ID.');
  }
  const agencyId = getAgencyId();
  const isProd = supabase && agencyId !== DEMO_AGENCY_ID && !String(id).startsWith('u_demo');

  if (isProd) {
    const table = isInvite ? 'team_invitations' : 'users';
    const { error } = await supabase
      .from(table)
      .update({ role: newRole })
      .eq('id', id)
      .eq('agency_id', agencyId);

    if (error) {
      notifyDbError(table, error);
      throw error;
    }
    
    if (isInvite) {
      const invites = getLocalInvites().map((inv) => (inv.id === id ? { ...inv, role: newRole } : inv));
      saveLocalInvites(invites);
    } else {
      const members = getLocalMembers().map((m) => (m.id === id ? { ...m, role: newRole } : m));
      saveLocalMembers(members);
    }
    return true;
  }

  // Demo fallback
  if (isInvite) {
    const invites = getLocalInvites().map((inv) => (inv.id === id ? { ...inv, role: newRole } : inv));
    saveLocalInvites(invites);
  } else {
    const members = getLocalMembers().map((m) => (m.id === id ? { ...m, role: newRole } : m));
    saveLocalMembers(members);
  }
  return true;
}

export async function removeMember(id, isInvite = false) {
  if (!id || id === 'null' || id === 'undefined') {
    throw new Error('Invalid team member ID.');
  }
  const agencyId = getAgencyId();
  const isProd = supabase && agencyId !== DEMO_AGENCY_ID && !String(id).startsWith('u_demo');

  if (isProd) {
    if (isInvite) {
      const { error } = await supabase
        .from('team_invitations')
        .delete()
        .eq('id', id)
        .eq('agency_id', agencyId);
      if (error) {
        notifyDbError('team_invitations', error);
        throw error;
      }
      const invites = getLocalInvites().filter((inv) => inv.id !== id);
      saveLocalInvites(invites);
    } else {
      const { error } = await supabase
        .from('users')
        .update({ agency_id: null })
        .eq('id', id)
        .eq('agency_id', agencyId);
      if (error) {
        notifyDbError('users', error);
        throw error;
      }
      const members = getLocalMembers().filter((m) => m.id !== id);
      saveLocalMembers(members);
    }
    return true;
  }

  // Demo fallback
  if (isInvite) {
    const invites = getLocalInvites().filter((inv) => inv.id !== id);
    saveLocalInvites(invites);
  } else {
    const members = getLocalMembers().filter((m) => m.id !== id);
    saveLocalMembers(members);
  }
  return true;
}
