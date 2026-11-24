import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getProfile, createClient } from "@/lib/supabase/server";
import { ROLES } from "@/lib/constants";

export const metadata = { title: "Settings" };

async function saveProfile(formData: FormData) {
  "use server";
  const me = await getProfile();
  if (!me) redirect("/login");
  const supabase = await createClient();
  await supabase.from("profiles").update({ name: String(formData.get("name") ?? me.name).trim() || me.name }).eq("id", me.id);
  const pw = String(formData.get("password") ?? "");
  if (pw) {
    if (pw.length < 10) redirect("/settings?error=" + encodeURIComponent("Password needs at least 10 characters."));
    const { error } = await supabase.auth.updateUser({ password: pw });
    if (error) redirect("/settings?error=" + encodeURIComponent(error.message));
  }
  revalidatePath("/", "layout");
  redirect("/settings?msg=Saved");
}

async function saveSlack(formData: FormData) {
  "use server";
  const me = await getProfile();
  if (!me || me.role !== "admin") redirect("/settings");
  const supabase = await createClient();
  await supabase.from("app_settings").upsert({ key: "slack", value: { channel: String(formData.get("channel") ?? ""), enabled: formData.get("enabled") === "1" }, updated_by: me.id, updated_at: new Date().toISOString() });
  redirect("/settings?msg=Saved");
}

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  const sp = await searchParams;
  const me = (await getProfile())!;
  const supabase = await createClient();
  const { data: slack } = await supabase.from("app_settings").select("value").eq("key", "slack").maybeSingle();
  const sv = (slack?.value ?? {}) as { channel?: string; enabled?: boolean };
  return (
    <div className="flex flex-col gap-4 max-w-3xl">
      <h2 className="text-2xl">Settings</h2>
      {sp.msg ? <div className="banner info">{sp.msg}</div> : null}
      {sp.error ? <div className="banner bad">{sp.error}</div> : null}
      <form action={saveProfile} className="card">
        <div className="card-h">
          <h3>Profile</h3>
        </div>
        <div className="card-b grid md:grid-cols-2 gap-3">
          <div className="field">
            <label>Name</label>
            <input name="name" defaultValue={me.name} />
          </div>
          <div className="field">
            <label>Email</label>
            <input value={me.email} disabled />
          </div>
          <div className="field">
            <label>Role</label>
            <input value={ROLES[me.role].label} disabled />
          </div>
          <div className="field">
            <label>New password</label>
            <input name="password" type="password" autoComplete="new-password" placeholder="leave blank to keep" />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <button className="btn primary sm">Save</button>
          </div>
        </div>
      </form>
      <div className="card">
        <div className="card-h">
          <h3>Client logins</h3>
        </div>
        <div className="card-b text-sm text-fg-2">
          Client logins are stored encrypted with a key that is not in the database. Only the account team (CS owner, team lead, assigned backend) and admins can open one. Every open, reveal and copy is written to the account&apos;s log. A revealed password hides again after 20 seconds.
        </div>
      </div>
      {me.role === "admin" ? (
        <form action={saveSlack} className="card">
          <div className="card-h">
            <h3>Slack</h3>
            <span className="ml-auto text-xs text-fg-3">{process.env.SLACK_WEBHOOK_URL ? "Webhook configured" : "Add SLACK_WEBHOOK_URL in Vercel to enable"}</span>
          </div>
          <div className="card-b grid md:grid-cols-2 gap-3">
            <div className="field">
              <label>Channel (for display)</label>
              <input name="channel" defaultValue={sv.channel ?? "#client-updates"} />
            </div>
            <label className="field justify-end">
              <span className="inline-flex items-center gap-2 text-sm">
                <input type="checkbox" name="enabled" value="1" defaultChecked={sv.enabled ?? true} /> Post assignments, reports and approvals to Slack
              </span>
            </label>
            <div className="md:col-span-2 flex justify-end">
              <button className="btn primary sm">Save</button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}
