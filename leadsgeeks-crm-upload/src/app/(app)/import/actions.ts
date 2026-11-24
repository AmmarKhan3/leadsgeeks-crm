"use server";
import * as XLSX from "xlsx";
import { createClient, getProfile } from "@/lib/supabase/server";
import { CHECKLIST_ITEMS, INDUSTRIES, STATUSES, US_STATES, neededItems, type CheckStatus } from "@/lib/constants";

export type ImportResult = { created: string[]; skipped: { row: number; business: string; reason: string }[]; errors: { row: number; business: string; reason: string }[] };

// template column header (row 2) -> field
const ACCESS_COLS: [string, string][] = [
  ["Access: Website / CMS login", "cms"], ["Access: Hosting panel", "hosting"], ["Access: Domain registrar / DNS", "domain"],
  ["Access: Google Business Profile", "gbp"], ["Access: Google Analytics", "ga"], ["Access: Search Console", "gsc"],
  ["Access: Facebook / Instagram", "fb"], ["Access: LinkedIn", "linkedin"], ["Access: Yelp", "yelp"], ["Access: Google Ads", "gads"],
  ["Access: Meta Ads", "mads"], ["Access: Local Services Ads", "lsa"], ["Access: GHL sub-account created", "ghl"], ["Access: AI chat bot", "chatbot"],
];
const STATUS_MAP: Record<string, CheckStatus> = { "have it": "have", "set up": "have", yes: "have", requested: "requested", pending: "pending", denied: "denied", removed: "removed", "not needed": "none", no: "none", "": "pending" };
const OWNER_MAP: Record<string, string> = { leadsgeeks: "us", us: "us", client: "client", "another agency": "agency", "third party": "agency", other: "agency" };

function cellDate(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export async function importClients(_prev: ImportResult | null, formData: FormData): Promise<ImportResult> {
  const me = await getProfile();
  if (!me || me.role !== "admin") throw new Error("Admins only");
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("Choose the filled-in template first");
  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  const ws = wb.Sheets["Clients"] ?? wb.Sheets[wb.SheetNames[0]!];
  if (!ws) throw new Error("No Clients sheet found");
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const header = (rows[1] ?? []).map((h) => String(h ?? "").trim()); // row 2 holds the column names
  const col = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const get = (r: unknown[], name: string) => { const i = col(name); return i < 0 ? "" : String(r[i] ?? "").trim(); };

  const supabase = await createClient();
  const [{ data: team }, { data: existing }] = await Promise.all([supabase.from("profiles").select("id, name, role"), supabase.from("accounts").select("business")]);
  const byName = (n: string) => (team ?? []).find((u) => u.name.toLowerCase() === n.toLowerCase())?.id ?? null;
  const taken = new Set((existing ?? []).map((a) => a.business.toLowerCase()));
  const result: ImportResult = { created: [], skipped: [], errors: [] };

  for (let i = 3; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const rowNo = i + 1;
    const business = get(r, "Business name *");
    if (!business || business.startsWith("EXAMPLE")) continue;
    if (taken.has(business.toLowerCase())) { result.skipped.push({ row: rowNo, business, reason: "already exists" }); continue; }
    try {
      const industryRaw = get(r, "Industry *");
      const industry = INDUSTRIES.find((x) => x.toLowerCase() === industryRaw.toLowerCase()) ?? "Other (specify)";
      const status = STATUSES.find((x) => x.toLowerCase() === get(r, "Status *").toLowerCase()) ?? "Signed";
      const stateRaw = get(r, "State *");
      const state = US_STATES.find(([c, n]) => c === stateRaw.toUpperCase() || n.toLowerCase() === stateRaw.toLowerCase())?.[0];
      if (!state) throw new Error(`unknown state "${stateRaw}"`);
      const services = get(r, "Services (comma separated) *").split(",").map((x) => x.trim()).filter(Boolean);
      const platform = get(r, "Platform *") || "WordPress";
      const cs_id = byName(get(r, "CS owner *")), lead_id = byName(get(r, "Team lead *")), sales_id = byName(get(r, "Sales rep"));
      if (get(r, "CS owner *") && !cs_id) throw new Error(`CS owner "${get(r, "CS owner *")}" is not a team member yet (invite them first)`);
      const owner = (v: string) => OWNER_MAP[v.toLowerCase()] ?? "client";
      const thirdParty = get(r, "Agency / registrar name (if third party)") || null;

      const { data: a, error } = await supabase.from("accounts").insert({
        business, industry, industry_other: industry === "Other (specify)" ? industryRaw : null, status,
        phone: get(r, "Business phone *") || null, email: get(r, "Business email") || null, website: get(r, "Website") || null, gbp_url: get(r, "Google Business Profile link") || null,
        street: get(r, "Street address") || null, city: get(r, "City *"), state, zip: get(r, "ZIP *") || null, platform,
        built_by: owner(get(r, "Website built by *")), built_by_name: owner(get(r, "Website built by *")) === "agency" ? thirdParty : null,
        hosted_by: owner(get(r, "Website hosted by *")), hosted_by_name: owner(get(r, "Website hosted by *")) === "agency" ? thirdParty : null,
        domain_by: owner(get(r, "Domain held by *")), domain_by_name: owner(get(r, "Domain held by *")) === "agency" ? thirdParty : null,
        services, cs_id, lead_id, sales_id, client_since: cellDate(r[col("Client since (date) *")]) ?? new Date().toISOString().slice(0, 10),
        approval: "approved", approval_requested_by: me.id, approval_requested_at: new Date().toISOString(), approval_decided_by: me.id, approval_decided_at: new Date().toISOString(), created_by: me.id,
      }).select("id").single();
      if (error) throw new Error(error.message);

      // contacts
      const contacts = [];
      if (get(r, "Primary contact name *")) contacts.push({ account_id: a.id, name: get(r, "Primary contact name *"), title: get(r, "Primary contact title") || null, phone: get(r, "Primary contact phone") || null, email: get(r, "Primary contact email") || null, is_primary: true });
      const second = get(r, "Second contact (name, title, phone, email)");
      if (second) { const [n, t, p, e] = second.split(",").map((x) => x.trim()); if (n) contacts.push({ account_id: a.id, name: n, title: t || null, phone: p || null, email: e || null, is_primary: false }); }
      if (contacts.length) await supabase.from("account_contacts").insert(contacts);

      // backend team
      const be: { account_id: string; user_id: string; specialty: string }[] = [];
      for (const sp of ["SEO", "GBP", "Ads", "Website", "GHL"]) { const uid = byName(get(r, `Backend: ${sp}${sp === "SEO" ? " *" : ""}`)); if (uid) be.push({ account_id: a.id, user_id: uid, specialty: sp }); }
      if (be.length) await supabase.from("account_backend").insert(be);

      // billing (admin importing, so allowed)
      const mrr = Number(get(r, "Monthly charge ($) *").replace(/[^0-9.]/g, ""));
      if (mrr > 0) await supabase.from("billing").insert({ account_id: a.id, mrr, billing_day: Math.min(28, Math.max(1, Number(get(r, "Billing day (1-28) *")) || 1)), method: get(r, "Billing method *") || "Card", started_on: cellDate(r[col("Client since (date) *")]) });

      // checklist
      const needed = new Set(neededItems(services, platform).map((x) => x.key));
      const items = CHECKLIST_ITEMS.map((it) => {
        const colName = ACCESS_COLS.find(([, k]) => k === it.key)?.[0];
        const raw = colName ? get(r, colName).toLowerCase() : "";
        const st: CheckStatus = raw ? STATUS_MAP[raw] ?? "pending" : needed.has(it.key) ? "pending" : "none";
        return { account_id: a.id, item_key: it.key, status: st, updated_by: me.id };
      });
      await supabase.from("checklist_items").insert(items);

      const note = get(r, "Notes for the import");
      if (note && !/delete this row/i.test(note)) await supabase.from("notes").insert({ account_id: a.id, author: me.id, body: note, kind: "note" });
      await supabase.from("change_log").insert({ account_id: a.id, by: me.id, area: "Account", text: "Imported from spreadsheet", to_value: file.name });
      taken.add(business.toLowerCase());
      result.created.push(business);
    } catch (e) {
      result.errors.push({ row: rowNo, business, reason: (e as Error).message });
    }
  }
  return result;
}
