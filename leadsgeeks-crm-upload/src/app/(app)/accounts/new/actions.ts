"use server";
import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { CHECKLIST_ITEMS, neededItems, type CheckStatus } from "@/lib/constants";
import { notifySlack } from "@/lib/slack";

export async function createAccount(formData: FormData) {
  const supabase = await createClient();
  const me = await getProfile();
  if (!me || !["admin", "lead", "cs"].includes(me.role)) throw new Error("Not allowed");
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  const services = formData.getAll("services").map(String);
  const platform = s("platform") || "WordPress";
  const cs_id = me.role === "cs" ? me.id : s("cs_id") || null;
  const lead_id = s("lead_id") || (me.role === "lead" ? me.id : null);
  if (me.role === "cs" && !lead_id) throw new Error("Pick a team lead");
  const approved = me.role === "admin";

  const { data: a, error } = await supabase
    .from("accounts")
    .insert({
      business: s("business"), industry: s("industry"), industry_other: s("industry_other") || null, status: s("status") || "Signed",
      phone: s("phone") || null, email: s("email") || null, website: s("website") || null, gbp_url: s("gbp_url") || null,
      street: s("street") || null, city: s("city"), state: s("state"), zip: s("zip") || null,
      platform, built_by: s("built_by") || "us", built_by_name: s("built_by_name") || null,
      hosted_by: s("hosted_by") || "us", hosted_by_name: s("hosted_by_name") || null,
      domain_by: s("domain_by") || "client", domain_by_name: s("domain_by_name") || null,
      services, service_other: s("service_other") || null, cs_id, lead_id, sales_id: s("sales_id") || null,
      client_since: s("client_since") || new Date().toISOString().slice(0, 10),
      approval: approved ? "approved" : "pending", approval_requested_by: me.id, approval_requested_at: new Date().toISOString(),
      approval_decided_by: approved ? me.id : null, approval_decided_at: approved ? new Date().toISOString() : null, created_by: me.id,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  // primary contact
  if (s("contact_name")) {
    await supabase.from("account_contacts").insert({ account_id: a.id, name: s("contact_name"), title: s("contact_title") || "Owner", phone: s("contact_phone") || null, email: s("contact_email") || null, is_primary: true });
  }
  // backend team (admins and leads only)
  if (me.role !== "cs") {
    const rows: { user_id: string; specialty: string }[] = [];
    formData.getAll("backend_user").forEach((u, i) => {
      const sp = String(formData.getAll("backend_specialty")[i] ?? "SEO");
      if (u && !rows.some((r) => r.user_id === u && r.specialty === sp)) rows.push({ user_id: String(u), specialty: sp });
    });
    if (rows.length) await supabase.from("account_backend").insert(rows.map((r) => ({ ...r, account_id: a.id })));
  }
  // checklist seeded from the "what we'll need" panel
  const needed = new Set(neededItems(services, platform).map((i) => i.key));
  const items = CHECKLIST_ITEMS.map((i) => {
    const st = (s(`check_${i.key}`) || (needed.has(i.key) ? "pending" : "none")) as CheckStatus;
    return { account_id: a.id, item_key: i.key, status: needed.has(i.key) ? st : "none", updated_by: me.id };
  });
  await supabase.from("checklist_items").insert(items);
  await supabase.from("change_log").insert({ account_id: a.id, by: me.id, area: "Account", text: "Account created", to_value: approved ? "live" : "pending approval" });

  // notifications
  const notify: { user_id: string; type: string; text: string; account_id: string }[] = [];
  if (!approved) {
    const { data: admins } = await supabase.from("profiles").select("id").eq("role", "admin").eq("active", true);
    (admins ?? []).forEach((ad) => notify.push({ user_id: ad.id, type: "approval", text: `${me.name} created ${s("business")}, awaiting your approval`, account_id: a.id }));
  }
  if (lead_id && lead_id !== me.id && me.role === "cs") notify.push({ user_id: lead_id, type: "assigned", text: `${me.name} created ${s("business")}. Assign the backend team.`, account_id: a.id });
  if (notify.length) await supabase.from("notifications").insert(notify);
  await notifySlack(`:new: ${me.name} created *${s("business")}*${approved ? "" : " (waiting for admin approval)"}`, a.id);

  redirect(`/accounts/${a.id}`);
}
