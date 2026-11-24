import { createClient, type Profile } from "@/lib/supabase/server";
import type { AccountStatus, CheckStatus } from "@/lib/constants";

export type AccountRow = {
  id: string;
  business: string;
  industry: string;
  status: AccountStatus;
  city: string | null;
  state: string | null;
  approval: "approved" | "pending" | "rejected";
  cs_id: string | null;
  lead_id: string | null;
  sales_id: string | null;
  services: string[];
  platform: string;
  cs: { name: string } | null;
  lead: { name: string } | null;
  backend: { user_id: string; specialty: string; profile: { name: string } | null }[];
};

const ACCOUNT_LIST_COLS = `id, business, industry, status, city, state, approval, cs_id, lead_id, sales_id, services, platform,
  cs:profiles!accounts_cs_id_fkey(name), lead:profiles!accounts_lead_id_fkey(name),
  backend:account_backend(user_id, specialty, profile:profiles(name))`;

export async function listAccounts(opts: { q?: string; status?: string } = {}) {
  const supabase = await createClient();
  let query = supabase.from("accounts").select(ACCOUNT_LIST_COLS).order("business");
  if (opts.status) query = query.eq("status", opts.status);
  if (opts.q) query = query.or(`business.ilike.%${opts.q}%,city.ilike.%${opts.q}%,industry.ilike.%${opts.q}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as AccountRow[];
}

export type Account = AccountRow & {
  industry_other: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  gbp_url: string | null;
  street: string | null;
  zip: string | null;
  built_by: string;
  built_by_name: string | null;
  hosted_by: string;
  hosted_by_name: string | null;
  domain_by: string;
  domain_by_name: string | null;
  service_other: string | null;
  client_since: string;
  approval_requested_by: string | null;
  approval_requested_at: string | null;
  approval_reason: string | null;
  created_by: string | null;
  created_at: string;
  sales: { name: string } | null;
  contacts: { id: string; name: string; title: string | null; phone: string | null; email: string | null; is_primary: boolean }[];
};

export async function getAccount(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounts")
    .select(`*, cs:profiles!accounts_cs_id_fkey(name), lead:profiles!accounts_lead_id_fkey(name), sales:profiles!accounts_sales_id_fkey(name),
      backend:account_backend(user_id, specialty, profile:profiles(name)), contacts:account_contacts(*)`)
    .eq("id", id)
    .maybeSingle();
  return (data as unknown as Account | null) ?? null;
}

export type ChecklistRow = {
  item_key: string;
  status: CheckStatus;
  note: string;
  external_link: string;
  updated_at: string;
  updated_by: string | null;
  updater: { name: string } | null;
};

export async function getChecklist(accountId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("checklist_items").select("item_key, status, note, external_link, updated_at, updated_by, updater:profiles(name)").eq("account_id", accountId);
  return (data ?? []) as unknown as ChecklistRow[];
}

/** Which items have a stored login (never the password). */
export async function getLoginIndex(accountId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("checklist_logins").select("item_key, login_url, username, updated_at").eq("account_id", accountId);
  return (data ?? []) as { item_key: string; login_url: string; username: string; updated_at: string }[];
}

export async function listTeam() {
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, name, email, role, active").order("name");
  return (data ?? []) as Profile[];
}
