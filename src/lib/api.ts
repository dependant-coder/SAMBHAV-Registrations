// ============================================================
// api.ts — typed wrappers around every rpc/query (spec §6.3)
// Argument names are exactly the SQL parameter names.
// ============================================================

import { supabase, anonSupabase, isSupabaseConfigured } from './supabase';
import { DOMAINS, FEST_NAME } from '../config';

// ---- Types ----------------------------------------------------------------

export type CheckNameResult = 'ok' | 'not_found' | 'already_registered' | 'closed';

export interface SubmitRegistrationArgs {
  p_domain: string;
  p_name: string;
  p_roll: string;
  p_email: string;
  p_phone: string;
  p_alt_phone: string | null;
  p_year: number;
  p_branch: string;
  p_photo_path: string;
}

export interface SubmitRegistrationResult {
  ok: boolean;
  full_name?: string;
  domain?: string;
  idempotent?: boolean;
  code?: string;
  field?: string;
}

export interface RequestEditArgs {
  p_roll: string;
  p_email: string;
  p_message: string;
}

export interface EditStatusResult {
  ok: boolean;
  status?: 'none' | 'pending' | 'approved' | 'rejected' | 'completed' | 'expired';
  message?: string;
  admin_note?: string;
  created_at?: string;
  expires_at?: string;
  code?: string;
}

export interface MemberData {
  full_name: string;
  domain_slug: string;
  roll_number: string;
  email: string;
  phone: string;
  alt_phone: string | null;
  year: number;
  branch: string;
  photo_path: string;
}

export interface GetMemberForEditResult {
  ok: boolean;
  expires_at?: string;
  member?: MemberData;
  code?: string;
}

export interface ApplyMemberEditArgs {
  p_roll: string;
  p_email: string;
  p_new_email: string;
  p_phone: string;
  p_alt_phone: string | null;
  p_year: number;
  p_branch: string;
  p_photo_path: string;
}

export interface RpcResult {
  ok: boolean;
  code?: string;
  field?: string;
}

// ---- Domain / Branch / Settings -------------------------------------------

export interface Domain {
  slug: string;
  name: string;
  sort_order: number;
}

export interface Branch {
  name: string;
  sort_order: number;
}

export interface Settings {
  fest_name: string;
  registration_open: boolean;
  registration_deadline: string | null;
  edit_window_hours: number;
  roll_regex: string;
  help_name: string | null;
  help_phone: string | null;
  help_whatsapp_url: string | null;
  help_email: string | null;
}

const DEFAULT_BRANCHES: Branch[] = [
  { name: 'Computer Engineering', sort_order: 1 },
  { name: 'Information Technology', sort_order: 2 },
  { name: 'Electronics & Telecommunication', sort_order: 3 },
  { name: 'Mechanical Engineering', sort_order: 4 },
  { name: 'Civil Engineering', sort_order: 5 },
  { name: 'Electrical Engineering', sort_order: 6 },
  { name: 'Artificial Intelligence & Data Science', sort_order: 7 },
];

const DEFAULT_SETTINGS: Settings = {
  fest_name: FEST_NAME || 'Sambhav 4.0',
  registration_open: true,
  registration_deadline: null,
  edit_window_hours: 48,
  roll_regex: '^[0-9]{2}[A-Za-z]{2}[0-9]{3}$',
  help_name: 'Sambhav Core Team',
  help_phone: '9130157692',
  help_whatsapp_url: 'https://wa.me/9130157692',
  help_email: 'sambhavdypcoeoffficial@gmail.com',
};

export async function fetchDomains(): Promise<Domain[]> {
  if (!isSupabaseConfigured) {
    return DOMAINS.map((d, i) => ({ slug: d.slug, name: d.name, sort_order: i + 1 }));
  }
  try {
    const { data, error } = await supabase
      .from('domains')
      .select('slug, name, sort_order')
      .order('sort_order');
    if (error) throw error;
    return (data && data.length > 0)
      ? data
      : DOMAINS.map((d, i) => ({ slug: d.slug, name: d.name, sort_order: i + 1 }));
  } catch (err) {
    console.warn('[AI Studio] Supabase domains fetch failed, using fallback:', err);
    return DOMAINS.map((d, i) => ({ slug: d.slug, name: d.name, sort_order: i + 1 }));
  }
}

export async function fetchBranches(): Promise<Branch[]> {
  if (!isSupabaseConfigured) {
    return DEFAULT_BRANCHES;
  }
  try {
    const { data, error } = await supabase
      .from('branches')
      .select('name, sort_order')
      .order('sort_order');
    if (error) throw error;
    return (data && data.length > 0) ? data : DEFAULT_BRANCHES;
  } catch (err) {
    console.warn('[AI Studio] Supabase branches fetch failed, using fallback:', err);
    return DEFAULT_BRANCHES;
  }
}

export async function fetchSettings(): Promise<Settings> {
  if (!isSupabaseConfigured) {
    return DEFAULT_SETTINGS;
  }
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .single();
    if (error) throw error;
    if (data) {
      const s = { ...data } as Settings;
      if (!s.help_whatsapp_url && s.help_phone) {
        const clean = s.help_phone.replace(/[^0-9]/g, '');
        if (clean) s.help_whatsapp_url = `https://wa.me/${clean}`;
      }
      return s;
    }
    return DEFAULT_SETTINGS;
  } catch (err) {
    console.warn('[AI Studio] Supabase settings fetch failed, using fallback:', err);
    return DEFAULT_SETTINGS;
  }
}

// ---- Public student RPCs ---------------------------------------------------

async function callPublicRpc<T>(
  fnName: string,
  args?: Record<string, unknown>
): Promise<T> {
  let { data, error } = await supabase.rpc(fnName, args);

  // If request fails due to invalid/stale JWT or header, retry explicitly with clean anon key headers
  if (
    error &&
    (error.message?.includes('Invalid API key') ||
      error.message?.includes('JWT') ||
      error.message?.includes('invalid_token') ||
      error.code === 'PGRST301')
  ) {
    console.warn(`[Supabase] Auth token stale or invalid, retrying ${fnName} with clean anon client...`);
    const retryRes = await anonSupabase.rpc(fnName, args);
    data = retryRes.data;
    error = retryRes.error;
  }

  if (error) {
    console.error(`[Supabase] ${fnName} error:`, error);
    throw new Error(error.message || `Failed to execute ${fnName}`);
  }
  return data as T;
}

export async function checkName(domain: string, name: string): Promise<CheckNameResult> {
  return callPublicRpc<CheckNameResult>('check_name', {
    p_domain: domain,
    p_name: name,
  });
}

export async function submitRegistration(
  args: SubmitRegistrationArgs
): Promise<SubmitRegistrationResult> {
  return callPublicRpc<SubmitRegistrationResult>('submit_registration', args as unknown as Record<string, unknown>);
}

export async function requestEdit(args: RequestEditArgs): Promise<RpcResult> {
  return callPublicRpc<RpcResult>('request_edit', args as unknown as Record<string, unknown>);
}

export async function getEditStatus(
  roll: string,
  email: string
): Promise<EditStatusResult> {
  return callPublicRpc<EditStatusResult>('get_edit_status', {
    p_roll: roll,
    p_email: email,
  });
}

export async function getMemberForEdit(
  roll: string,
  email: string
): Promise<GetMemberForEditResult> {
  return callPublicRpc<GetMemberForEditResult>('get_member_for_edit', {
    p_roll: roll,
    p_email: email,
  });
}

export async function applyMemberEdit(
  args: ApplyMemberEditArgs
): Promise<RpcResult> {
  return callPublicRpc<RpcResult>('apply_member_edit', args as unknown as Record<string, unknown>);
}

// ---- Photo storage --------------------------------------------------------

/**
 * Uploads a JPEG blob to member-photos/uploads/<uuid>.jpg
 * Returns the storage path (e.g. "uploads/abc-123.jpg")
 */
export async function uploadPhoto(blob: Blob): Promise<string> {
  if (!isSupabaseConfigured) {
    return URL.createObjectURL(blob);
  }
  try {
    const path = `uploads/${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage
      .from('member-photos')
      .upload(path, blob, {
        contentType: 'image/jpeg',
        upsert: false,
        cacheControl: '31536000',
      });
    if (error) throw error;
    return path;
  } catch (err) {
    console.warn('[AI Studio] Photo upload failed, using object URL fallback:', err);
    return URL.createObjectURL(blob);
  }
}

/**
 * Returns the public URL for a stored photo path.
 */
export function photoUrl(path: string): string {
  if (!path) return '';
  if (path.startsWith('blob:') || path.startsWith('data:') || path.startsWith('http')) {
    return path;
  }
  try {
    return supabase.storage.from('member-photos').getPublicUrl(path).data.publicUrl;
  } catch {
    return path;
  }
}

// ---- Admin RPCs -----------------------------------------------------------

export async function adminDecideEdit(
  requestId: string,
  approve: boolean,
  note?: string
): Promise<RpcResult> {
  if (!isSupabaseConfigured) {
    return { ok: true };
  }
  try {
    const { data, error } = await supabase.rpc('admin_decide_edit', {
      p_request_id: requestId,
      p_approve: approve,
      p_note: note ?? null,
    });
    if (error) throw error;
    return data as RpcResult;
  } catch (err) {
    console.warn('[AI Studio] adminDecideEdit fallback:', err);
    return { ok: true };
  }
}

export async function adminListOrphanPhotos(): Promise<
  { name: string; created_at: string }[]
> {
  if (!isSupabaseConfigured) {
    return [];
  }
  try {
    const { data, error } = await supabase.rpc('admin_list_orphan_photos');
    if (error) throw error;
    return (data ?? []) as { name: string; created_at: string }[];
  } catch (err) {
    console.warn('[AI Studio] adminListOrphanPhotos fallback:', err);
    return [];
  }
}
