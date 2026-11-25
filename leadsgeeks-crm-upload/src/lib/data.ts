import { createClient, type Profile } from "@/lib/supabase/server";
import { BILLABLE_STATUSES, type AccountStatus, type CheckStatus } from "@/lib/constants";
import { thisMonth, lastMonth } from "@/lib/format";

export type AccountRow = {
  id: string;
  business: string;
  industry: string;
  status: AccountStatus;
  city: string | null;
  state: string | null;
  approval: "approved" | "pending" | "rejected";
  approval_requested_by: string | null;
  approval_requested_at: string | null;
  created_at: string;
  cs_id: string | null;
  lead_id: string | null;
  sales_id: string | null;
  services: string[];
  platform: string;
  client_since: string;
  cs: { name: string } | null;
  lead: { name: string } | null;
  requester: { name: string } | null;
  backend: { user_id: string; specialty: string; profile: { name: string } | null }[];
};

const ACCOUNT_LIST_COLS = `id, business, industry, status, city, state, approval, approval_requested_by, approval_requested_at, created_at, cs_id, lead_id, sales_id, services, platform, client_since,
  cs:profiles!accounts_cs_id_fkey(name), lead:profiles!accounts_lead_id_fkey(name), requester:profiles!accounts_approval_requested_by_fkey(name),
  backend:account_backend(user_id, specialty, profile:profiles(name))`;

export type AccountFilters = { q?: string; status?: string; service?: string; industry?: string; state?: string; owner?: string };

export async function listAccounts(opts: AccountFilters = {}) {
  const supabase = await createClient();
  let query = supabase.from("accounts").select(ACCOUNT_LIST_COLS).order("business");
  if (opts.status) query = query.eq("status", opts.status);
  if (opts.industry) query = query.eq("industry", opts.industry);
  if (opts.state) query = query.eq("state", opts.state);
  if (opts.service) query = query.contains("services", [opts.service]);
  if (opts.q) query = query.or(`business.ilike.%${opts.q}%,city.ilike.%${opts.q}%,industry.ilike.%${opts.q}%,email.ilike.%${opts.q}%,phone.ilike.%${opts.q}%`);
  const { data, error } = await query;
  if (error) throw error;
  let rows = (data ?? []) as unknown as AccountRow[];
  if (opts.owner) rows = rows.filter((a) => a.cs_id === opts.owner || a.backend.some((b) => b.user_id === opts.owner));
  return rows;
}

/** Per-account rollups the lists and dashboard show: access progress, last report, billing status. */
export type AccountExtras = {
  access: { have: number; total: number; requested: number; pending: number };
  lastReport: string | null;
  missingReport: boolean;
  mrr: number;
  billingDay: number | null;
  method: string | null;
  pay: { state: "paid" | "due" | "overdue" | "na"; days?: number; date?: string };
};

export async function accountExtras(accounts: Pick<AccountRow, "id" | "status" | "approval" | "client_since">[], withBilling: boolean) {
  const supabase = await createClient();
  const ids = accounts.map((a) => a.id);
  const out = new Map<string, AccountExtras>();
  if (!ids.length) return out;
  const lm = lastMonth();
  const tm = thisMonth();
  const [{ data: checks }, { data: reports }, billing, upsells, payments] = await Promise.all([
    supabase.from("checklist_items").select("account_id, status").in("account_id", ids),
    supabase.from("reports").select("account_id, month").in("account_id", ids).order("month", { ascending: false }),
    withBilling ? supabase.from("billing").select("account_id, mrr, billing_day, method").in("account_id", ids) : Promise.resolve({ data: [] as { account_id: string; mrr: number; billing_day: number; method: string }[] }),
    withBilling ? supabase.from("upsells").select("account_id, amount, recurring").in("account_id", ids).eq("recurring", true) : Promise.resolve({ data: [] as { account_id: string; amount: number; recurring: boolean }[] }),
    withBilling ? supabase.from("payments").select("account_id, month, collected_on").in("account_id", ids).gte("month", tm + "-01") : Promise.resolve({ data: [] as { account_id: string; month: string; collected_on: string }[] }),
  ]);
  const today = new Date();
  for (const a of accounts) {
    const cs = (checks ?? []).filter((c) => c.account_id === a.id && c.status !== "none");
    const access = { have: cs.filter((c) => c.status === "have").length, total: cs.length, requested: cs.filter((c) => c.status === "requested").length, pending: cs.filter((c) => c.status === "pending").length };
    const rep = (reports ?? []).find((r) => r.account_id === a.id);
    const live = a.approval === "approved";
    const billable = BILLABLE_STATUSES.includes(a.status) && live;
    const needsReport = billable && a.client_since.slice(0, 7) < lm;
    const missingReport = needsReport && !(reports ?? []).some((r) => r.account_id === a.id && r.month.startsWith(lm));
    const b = (billing.data ?? []).find((x) => x.account_id === a.id);
    const mrr = b ? Number(b.mrr) + (upsells.data ?? []).filter((u) => u.account_id === a.id).reduce((s, u) => s + Number(u.amount), 0) : 0;
    let pay: AccountExtras["pay"] = { state: "na" };
    if (b && billable) {
      const paid = (payments.data ?? []).find((p) => p.account_id === a.id && p.month.startsWith(tm));
      if (paid) pay = { state: "paid", date: paid.collected_on };
      else {
        const due = new Date(today.getFullYear(), today.getMonth(), b.billing_day);
        const days = Math.round((due.getTime() - new Date(today.toDateString()).getTime()) / 86400000);
        pay = days >= 0 ? { state: "due", days, date: due.toISOString().slice(0, 10) } : { state: "overdue", days: -days, date: due.toISOString().slice(0, 10) };
      }
    }
    out.set(a.id, { access, lastReport: rep?.month ?? null, missingReport, mrr, billingDay: b?.billing_day ?? null, method: b?.method ?? null, pay });
  }
  return out;
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
  approval_decided_by: string | null;
  approval_decided_at: string | null;
  approval_reason: string | null;
  created_by: string | null;
  sales: { name: string } | null;
  decider: { name: string } | null;
  contacts: { id: string; name: string; title: string | null; phone: string | null; email: string | null; is_primary: boolean }[];
};

export async function getAccount(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("accounts")
    .select(`*, cs:profiles!accounts_cs_id_fkey(name), lead:profiles!accounts_lead_id_fkey(name), sales:profiles!accounts_sales_id_fkey(name),
      requester:profiles!accounts_approval_requested_by_fkey(name), decider:profiles!accounts_approval_decided_by_fkey(name),
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

export const ownerLabel = (k: string, name: string | null, domain = false) => (k === "us" ? "LeadsGeeks" : k === "client" ? "Client" : name ? `${domain ? "Third party" : "Another agency"} · ${name}` : domain ? "Third party" : "Another agency");

export const ord = (n: number) => n + (["th", "st", "nd", "rd"][n % 10 > 3 || Math.floor((n % 100) / 10) === 1 ? 0 : n % 10] ?? "th");
