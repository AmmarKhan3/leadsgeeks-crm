"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getProfile, createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ROLES } from "@/lib/constants";

async function requireAdmin() {
  const me = await getProfile();
  if (!me || me.role !== "admin") throw new Error("Admins only");
  return me;
}

export async function inviteUser(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "cs");
  if (!(role in ROLES)) throw new Error("Bad role");
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { name, role },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password`,
  });
  if (error) redirect("/team?error=" + encodeURIComponent(error.message));
  redirect("/team?msg=" + encodeURIComponent(`Invite sent to ${email}.`));
}

export async function setRole(userId: string, formData: FormData) {
  const me = await requireAdmin();
  if (userId === me.id) return;
  const role = String(formData.get("role"));
  if (!(role in ROLES)) throw new Error("Bad role");
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

export async function setActive(userId: string, active: boolean) {
  const me = await requireAdmin();
  if (userId === me.id) return;
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ active }).eq("id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}
