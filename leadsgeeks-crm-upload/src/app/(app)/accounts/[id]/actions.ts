"use server";
import { revalidatePath } from "next/cache";
import { createClient, getProfile } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encrypt, decrypt } from "@/lib/crypto";
import { CHECK_STATUS, itemLabel, type CheckStatus } from "@/lib/constants";
import { canOpenLogins } from "@/lib/perms";
import { notifySlack } from "@/lib/slack";

async function teamFor(accountId: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("accounts").select("id, business, cs_id, lead_id, backend:account_backend(user_id)").eq("id", accountId).maybeSingle();
  return data as { id: string; business: string; cs_id: string | null; lead_id: string | null; backend: { user_id: string }[] } | null;
}

async function logChange(accountId: string, area: string, text: string, from = "", to = "") {
  const supabase = await createClient();
  const me = await getProfile();
  await supabase.from("change_log").insert({ account_id: accountId, by: me?.id, area, text, from_value: from, to_value: to });
}

export async function setChecklistStatus(accountId: string, itemKey: string, status: CheckStatus) {
  const supabase = await createClient();
  const me = await getProfile();
  if (!me || me.role === "sales") throw new Error("Not allowed");
  const { data: cur } = await supabase.from("checklist_items").select("status").eq("account_id", accountId).eq("item_key", itemKey).maybeSingle();
  const { error } = await supabase.from("checklist_items").upsert({ account_id: accountId, item_key: itemKey, status, updated_by: me.id, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  if (cur && cur.status !== status) await logChange(accountId, "Access", itemLabel(itemKey), CHECK_STATUS[cur.status as CheckStatus].label, CHECK_STATUS[status].label);
  revalidatePath(`/accounts/${accountId}`);
}

export async function saveChecklistItem(accountId: string, itemKey: string, formData: FormData) {
  const supabase = await createClient();
  const me = await getProfile();
  if (!me || me.role === "sales") throw new Error("Not allowed");
  const status = String(formData.get("status")) as CheckStatus;
  const note = String(formData.get("note") ?? "");
  const external_link = String(formData.get("external_link") ?? "").trim();
  const { data: cur } = await supabase.from("checklist_items").select("status, note, external_link").eq("account_id", accountId).eq("item_key", itemKey).maybeSingle();
  const { error } = await supabase.from("checklist_items").upsert({ account_id: accountId, item_key: itemKey, status, note, external_link, updated_by: me.id, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
  const lbl = itemLabel(itemKey);
  if (cur && cur.status !== status) await logChange(accountId, "Access", lbl, CHECK_STATUS[cur.status as CheckStatus].label, CHECK_STATUS[status].label);
  if (cur && cur.note !== note) await logChange(accountId, "Access", `${lbl} note`, cur.note, note);

  // login (vault) fields: only when the caller is on the account team
  const team = await teamFor(accountId);
  if (team && canOpenLogins(me, team) && formData.has("login_url")) {
    const login_url = String(formData.get("login_url") ?? "").trim();
    const username = String(formData.get("username") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const keep = formData.get("password_unchanged") === "1";
    const { data: old } = await supabase.from("checklist_logins").select("login_url, username, password_ciphertext").eq("account_id", accountId).eq("item_key", itemKey).maybeSingle();
    const has = !!(login_url || username || password || (keep && old?.password_ciphertext));
    if (!has && old) {
      await supabase.from("checklist_logins").delete().eq("account_id", accountId).eq("item_key", itemKey);
      await logChange(accountId, "Login", `${lbl} login removed`, old.login_url || old.username, "");
    } else if (has) {
      const password_ciphertext = keep && old ? old.password_ciphertext : password ? encrypt(password) : "";
      const { error: e2 } = await supabase.from("checklist_logins").upsert({ account_id: accountId, item_key: itemKey, login_url, username, password_ciphertext, updated_by: me.id, updated_at: new Date().toISOString() });
      if (e2) throw new Error(e2.message);
      if (!old) await logChange(accountId, "Login", `${lbl} login added`, "", login_url || username);
      else {
        const changed = [login_url !== old.login_url ? "URL" : "", username !== old.username ? "username" : "", !keep && password ? "password" : ""].filter(Boolean);
        if (changed.length) await logChange(accountId, "Login", `${lbl} login updated`, "", changed.join(", "));
      }
    }
  }
  revalidatePath(`/accounts/${accountId}`);
}

export type RevealResult = { url: string; username: string; password: string };

/** Decrypts a stored login for an allowed caller and writes the audit row. Never cached. */
export async function revealLogin(accountId: string, itemKey: string, action: "revealed the password" | "copied the password" | "copied the username" | "opened the login page"): Promise<RevealResult> {
  const me = await getProfile();
  if (!me) throw new Error("Not signed in");
  const team = await teamFor(accountId);
  if (!team || !canOpenLogins(me, team)) throw new Error("Only the account team and admins can open this login");
  const admin = createAdminClient();
  const { data } = await admin.from("checklist_logins").select("login_url, username, password_ciphertext").eq("account_id", accountId).eq("item_key", itemKey).maybeSingle();
  if (!data) throw new Error("No login stored");
  await admin.from("login_reveals").insert({ account_id: accountId, item_key: itemKey, user_id: me.id, action });
  const wantsPassword = action === "revealed the password" || action === "copied the password";
  return { url: data.login_url, username: data.username, password: wantsPassword && data.password_ciphertext ? decrypt(data.password_ciphertext) : "" };
}

export async function addNote(accountId: string, formData: FormData) {
  const supabase = await createClient();
  const me = await getProfile();
  if (!me || me.role === "sales") throw new Error("Not allowed");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;
  const kind = formData.get("kind") === "request" ? "request" : "note";
  const assignee = String(formData.get("assignee") ?? "") || null;
  const due_on = String(formData.get("due_on") ?? "") || null;
  const is_private = formData.get("is_private") === "1";
  const { error } = await supabase.from("notes").insert({
    account_id: accountId, author: me.id, body, kind, is_private,
    assignee: kind === "request" ? assignee : null, due_on: kind === "request" ? due_on : null, status: kind === "request" ? "open" : null,
  });
  if (error) throw new Error(error.message);
  if (kind === "request" && assignee) {
    const team = await teamFor(accountId);
    await supabase.from("notifications").insert({ user_id: assignee, type: "request", text: `${me.name} assigned you a request on ${team?.business ?? "an account"}`, account_id: accountId });
    await notifySlack(`:memo: ${me.name} opened a request on *${team?.business ?? "an account"}*: ${body.slice(0, 140)}`, accountId);
  }
  revalidatePath(`/accounts/${accountId}`);
}

export async function setRequestDone(accountId: string, noteId: string, done: boolean) {
  const supabase = await createClient();
  const me = await getProfile();
  if (!me || me.role === "sales") throw new Error("Not allowed");
  const { error } = await supabase.from("notes").update({ status: done ? "done" : "open", done_at: done ? new Date().toISOString() : null }).eq("id", noteId);
  if (error) throw new Error(error.message);
  revalidatePath(`/accounts/${accountId}`);
}

export async function togglePin(accountId: string, noteId: string, pinned: boolean) {
  const supabase = await createClient();
  await supabase.from("notes").update({ pinned }).eq("id", noteId);
  revalidatePath(`/accounts/${accountId}`);
}

export async function setStatus(accountId: string, status: string) {
  const supabase = await createClient();
  const me = await getProfile();
  if (!me || me.role === "sales") throw new Error("Not allowed");
  const { data: cur } = await supabase.from("accounts").select("status").eq("id", accountId).single();
  const { error } = await supabase.from("accounts").update({ status }).eq("id", accountId);
  if (error) throw new Error(error.message);
  if (cur && cur.status !== status) await logChange(accountId, "Status", "Status changed", cur.status, status);
  revalidatePath(`/accounts/${accountId}`);
}

export async function decideApproval(accountId: string, approve: boolean, reason = "") {
  const supabase = await createClient();
  const me = await getProfile();
  if (!me || me.role !== "admin") throw new Error("Admins only");
  const { data: a } = await supabase.from("accounts").select("business, approval_requested_by").eq("id", accountId).single();
  const { error } = await supabase.from("accounts").update({ approval: approve ? "approved" : "rejected", approval_decided_by: me.id, approval_decided_at: new Date().toISOString(), approval_reason: approve ? null : reason }).eq("id", accountId);
  if (error) throw new Error(error.message);
  await logChange(accountId, "Approval", approve ? "Approved" : "Rejected", "", approve ? "" : reason);
  await notifySlack(`${approve ? ":white_check_mark:" : ":x:"} ${me.name} ${approve ? "approved" : "rejected"} *${a?.business ?? "an account"}*${reason ? `: ${reason}` : ""}`, accountId);
  if (a?.approval_requested_by) await supabase.from("notifications").insert({ user_id: a.approval_requested_by, type: "approval", text: `${me.name} ${approve ? "approved" : "rejected"} ${a.business}${reason ? `: ${reason}` : ""}`, account_id: accountId });
  revalidatePath(`/accounts/${accountId}`);
  revalidatePath("/dashboard");
}

export async function resubmit(accountId: string) {
  const supabase = await createClient();
  const me = await getProfile();
  if (!me) throw new Error("Not signed in");
  await supabase.from("accounts").update({ approval: "pending", approval_requested_by: me.id, approval_requested_at: new Date().toISOString(), approval_reason: null }).eq("id", accountId);
  await logChange(accountId, "Approval", "Resubmitted for approval");
  revalidatePath(`/accounts/${accountId}`);
}

export async function saveTeam(accountId: string, formData: FormData) {
  const supabase = await createClient();
  const me = await getProfile();
  if (!me || !["admin", "lead"].includes(me.role)) throw new Error("Admins and team leads only");
  const cs_id = String(formData.get("cs_id") ?? "") || null;
  const lead_id = String(formData.get("lead_id") ?? "") || null;
  const sales_id = String(formData.get("sales_id") ?? "") || null;
  const rows: { user_id: string; specialty: string }[] = [];
  formData.getAll("backend_user").forEach((u, i) => {
    const sp = String(formData.getAll("backend_specialty")[i] ?? "SEO");
    if (u && !rows.some((r) => r.user_id === u && r.specialty === sp)) rows.push({ user_id: String(u), specialty: sp });
  });
  const { data: before } = await supabase.from("accounts").select("business, cs_id, lead_id, cs:profiles!accounts_cs_id_fkey(name), backend:account_backend(user_id, profile:profiles(name))").eq("id", accountId).single();
  const { error } = await supabase.from("accounts").update({ cs_id, lead_id, sales_id }).eq("id", accountId);
  if (error) throw new Error(error.message);
  await supabase.from("account_backend").delete().eq("account_id", accountId);
  if (rows.length) {
    const { error: e2 } = await supabase.from("account_backend").insert(rows.map((r) => ({ ...r, account_id: accountId })));
    if (e2) throw new Error(e2.message);
  }
  await logChange(accountId, "Team", "Team updated", "", rows.length ? `${rows.length} backend assignment${rows.length === 1 ? "" : "s"}` : "no backend");
  const newIds = new Set([cs_id, ...rows.map((r) => r.user_id)].filter(Boolean) as string[]);
  const oldIds = new Set([before?.cs_id, ...((before?.backend as unknown as { user_id: string }[]) ?? []).map((b) => b.user_id)].filter(Boolean) as string[]);
  const added = [...newIds].filter((id) => !oldIds.has(id) && id !== me.id);
  if (added.length) await supabase.from("notifications").insert(added.map((user_id) => ({ user_id, type: "assigned", text: `${me.name} assigned you to ${before?.business ?? "an account"}`, account_id: accountId })));
  revalidatePath(`/accounts/${accountId}`);
}

export async function markPaid(accountId: string, formData: FormData) {
  const supabase = await createClient();
  const me = await getProfile();
  if (!me || !["admin", "cs"].includes(me.role)) throw new Error("Not allowed");
  const month = String(formData.get("month")) + "-01";
  const amount = Number(formData.get("amount") ?? 0);
  const { error } = await supabase.from("payments").upsert({ account_id: accountId, month, amount, collected_by: me.id, collected_on: String(formData.get("collected_on") ?? "") || new Date().toISOString().slice(0, 10), note: String(formData.get("note") ?? "") || null });
  if (error) throw new Error(error.message);
  revalidatePath(`/accounts/${accountId}`);
}

export async function saveBilling(accountId: string, formData: FormData) {
  const supabase = await createClient();
  const me = await getProfile();
  if (!me || !["admin", "cs"].includes(me.role)) throw new Error("Not allowed");
  const { error } = await supabase.from("billing").upsert({
    account_id: accountId, mrr: Number(formData.get("mrr") ?? 0), billing_day: Number(formData.get("billing_day") ?? 1),
    method: String(formData.get("method") ?? "Card"), started_on: String(formData.get("started_on") ?? "") || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/accounts/${accountId}`);
}

export async function addUpsell(accountId: string, formData: FormData) {
  const supabase = await createClient();
  const me = await getProfile();
  if (!me || !["admin", "cs"].includes(me.role)) throw new Error("Not allowed");
  const { error } = await supabase.from("upsells").insert({
    account_id: accountId, name: String(formData.get("name")), amount: Number(formData.get("amount") ?? 0),
    recurring: formData.get("recurring") === "1", sold_on: String(formData.get("sold_on") ?? "") || new Date().toISOString().slice(0, 10), sold_by: me.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/accounts/${accountId}`);
}

export async function uploadReport(accountId: string, formData: FormData) {
  const supabase = await createClient();
  const me = await getProfile();
  if (!me || !["admin", "backend"].includes(me.role)) throw new Error("Not allowed");
  const month = String(formData.get("month")); // yyyy-mm
  const file = formData.get("file") as File | null;
  if (!file || file.type !== "application/pdf") throw new Error("Upload a PDF");
  const path = `${accountId}/${month}.pdf`;
  const { error } = await supabase.storage.from("reports").upload(path, file, { upsert: true, contentType: "application/pdf" });
  if (error) throw new Error(error.message);
  const { error: e2 } = await supabase.from("reports").upsert({ account_id: accountId, month: month + "-01", file_path: path, file_name: file.name, uploaded_by: me.id, uploaded_at: new Date().toISOString() });
  if (e2) throw new Error(e2.message);
  await logChange(accountId, "Reports", `Report uploaded`, "", month);
  const t0 = await teamFor(accountId);
  await notifySlack(`:page_facing_up: ${me.name} uploaded the ${month} report for *${t0?.business ?? "an account"}*`, accountId);
  const team = await teamFor(accountId);
  if (team?.cs_id && team.cs_id !== me.id) await supabase.from("notifications").insert({ user_id: team.cs_id, type: "report", text: `${me.name} uploaded the ${month} report for ${team.business}`, account_id: accountId });
  revalidatePath(`/accounts/${accountId}`);
}

export async function reportUrl(path: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("reports").createSignedUrl(path, 300);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
