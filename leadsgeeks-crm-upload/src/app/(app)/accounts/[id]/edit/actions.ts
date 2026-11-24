"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient, getProfile } from "@/lib/supabase/server";

const LABELS: Record<string, string> = {
  business: "Business name", industry: "Industry", industry_other: "Industry (other)", phone: "Phone", email: "Email", street: "Street", city: "City",
  state: "State", zip: "ZIP", website: "Website", gbp_url: "GBP link", client_since: "Client since", platform: "Platform", built_by: "Built by",
  built_by_name: "Built by (name)", hosted_by: "Hosted by", hosted_by_name: "Hosted by (name)", domain_by: "Domain held by", domain_by_name: "Domain holder (name)",
  service_other: "Other service",
};

export async function updateAccount(accountId: string, formData: FormData) {
  const supabase = await createClient();
  const me = await getProfile();
  if (!me || me.role === "sales") throw new Error("Not allowed");
  const s = (k: string) => String(formData.get(k) ?? "").trim();
  const { data: before } = await supabase.from("accounts").select("*").eq("id", accountId).single();
  if (!before) throw new Error("Account not found");

  const next: Record<string, string | string[] | null> = {
    business: s("business"), industry: s("industry"), industry_other: s("industry_other") || null, phone: s("phone") || null, email: s("email") || null,
    street: s("street") || null, city: s("city"), state: s("state"), zip: s("zip") || null, website: s("website") || null, gbp_url: s("gbp_url") || null,
    client_since: s("client_since") || before.client_since, platform: s("platform"), built_by: s("built_by"), built_by_name: s("built_by_name") || null,
    hosted_by: s("hosted_by"), hosted_by_name: s("hosted_by_name") || null, domain_by: s("domain_by"), domain_by_name: s("domain_by_name") || null,
    services: formData.getAll("services").map(String), service_other: s("service_other") || null,
  };
  const { error } = await supabase.from("accounts").update(next).eq("id", accountId);
  if (error) throw new Error(error.message);

  const changes: { account_id: string; by: string; area: string; text: string; from_value: string; to_value: string }[] = [];
  for (const [k, v] of Object.entries(next)) {
    if (k === "services") {
      const a = [...(before.services as string[])].sort().join(", "), b = [...(v as string[])].sort().join(", ");
      if (a !== b) changes.push({ account_id: accountId, by: me.id, area: "Details", text: "Services changed", from_value: a, to_value: b });
    } else if ((before[k] ?? "") !== (v ?? "")) {
      changes.push({ account_id: accountId, by: me.id, area: "Details", text: `${LABELS[k] ?? k} changed`, from_value: String(before[k] ?? ""), to_value: String(v ?? "") });
    }
  }

  // contacts: rows in order; first is primary; empty name = removed
  const ids = formData.getAll("contact_id").map(String);
  const names = formData.getAll("contact_name").map((x) => String(x).trim());
  const titles = formData.getAll("contact_title").map((x) => String(x).trim());
  const phones = formData.getAll("contact_phone").map((x) => String(x).trim());
  const emails = formData.getAll("contact_email").map((x) => String(x).trim());
  const { data: oldContacts } = await supabase.from("account_contacts").select("id, name").eq("account_id", accountId);
  const keep = new Set<string>();
  for (let i = 0; i < names.length; i++) {
    const row = { account_id: accountId, name: names[i], title: titles[i] || null, phone: phones[i] || null, email: emails[i] || null, is_primary: i === 0 };
    if (!names[i]) continue;
    if (ids[i]) {
      await supabase.from("account_contacts").update(row).eq("id", ids[i]);
      keep.add(ids[i]);
    } else {
      const { data: ins } = await supabase.from("account_contacts").insert(row).select("id").single();
      if (ins) keep.add(ins.id);
      changes.push({ account_id: accountId, by: me.id, area: "Contacts", text: `Contact added`, from_value: "", to_value: names[i] });
    }
  }
  for (const c of oldContacts ?? []) {
    if (!keep.has(c.id)) {
      await supabase.from("account_contacts").delete().eq("id", c.id);
      changes.push({ account_id: accountId, by: me.id, area: "Contacts", text: `Contact removed`, from_value: c.name, to_value: "" });
    }
  }
  if (changes.length) await supabase.from("change_log").insert(changes);
  revalidatePath(`/accounts/${accountId}`);
  redirect(`/accounts/${accountId}`);
}
