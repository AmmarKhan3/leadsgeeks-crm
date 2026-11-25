import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getProfile, createClient } from "@/lib/supabase/server";
import { ROLES } from "@/lib/constants";
import { perms } from "@/lib/perms";
import { Pill, PageHead, Switch } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Money, MoneySwitch } from "@/components/money";
import { PageTitle } from "@/components/page-title";

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
  const p = perms(me.role);
  const supabase = await createClient();
  const { data: slack } = await supabase.from("app_settings").select("value").eq("key", "slack").maybeSingle();
  const sv = (slack?.value ?? {}) as { channel?: string; enabled?: boolean };
  const hook = !!process.env.SLACK_WEBHOOK_URL;
  return (
    <>
      <PageTitle title="Settings" />
      <PageHead title="Settings" />
      {sp.msg ? <div className="banner info"><Icon n="info" /><div>{sp.msg}</div></div> : null}
      {sp.error ? <div className="banner bad"><Icon n="alert" /><div>{sp.error}</div></div> : null}
      <div className="grid c2">
        <div className="stack">
          <form action={saveProfile} className="card">
            <div className="card-h"><h3>Profile</h3></div>
            <div className="card-b form-grid">
              <div className="field"><label htmlFor="p-name">Name</label><input type="text" id="p-name" name="name" defaultValue={me.name} /></div>
              <div className="field"><label>Email</label><input type="email" value={me.email} disabled /></div>
              <div className="field"><label>Role</label><input type="text" value={ROLES[me.role].label} disabled /></div>
              <div className="field"><label htmlFor="p-pw">New password</label><input id="p-pw" type="password" name="password" autoComplete="new-password" placeholder="leave blank to keep" /><span className="hint">At least 10 characters.</span></div>
              <div className="span2 row" style={{ justifyContent: "flex-end" }}><button className="btn primary sm">Save</button></div>
            </div>
          </form>
          <div className="card">
            <div className="card-h"><Icon n="lock" size={18} /><h3>Client logins</h3></div>
            <div className="card-b stack" style={{ gap: 12 }}>
              <p className="small muted">Client logins are stored encrypted with a key that is not in the database. Only the account team (CS owner, team lead, assigned backend) and admins can open one. Every open, reveal and copy is written to the account&apos;s log. Copied passwords clear from your clipboard after 30 seconds, and a revealed password hides again after 20 seconds.</p>
            </div>
          </div>
          {p.billing ? (
            <div className="card">
              <div className="card-h"><h3>Privacy</h3></div>
              <div className="card-b stack" style={{ gap: 14 }}>
                <MoneySwitch />
                <div className="row"><span className="small muted">Example:</span><Money value={2400} /><span className="small muted">/mo</span></div>
              </div>
            </div>
          ) : null}
        </div>
        <div className="stack">
          {me.role === "admin" ? (
            <form action={saveSlack} className="card">
              <div className="card-h"><Icon n="slack" size={18} /><h3>Slack</h3>{hook ? <Pill tone="ok" plain>Connected</Pill> : <Pill tone="muted" plain>Not connected</Pill>}</div>
              <div className="card-b stack" style={{ gap: 14 }}>
                <div className="field">
                  <label>Incoming webhook URL</label>
                  <input type="text" value={hook ? "Set in Vercel · hooks.slack.com/services/••••••••" : "Not set"} disabled />
                  <span className="hint">Create one in Slack → Apps → Incoming Webhooks, then add it in Vercel as SLACK_WEBHOOK_URL and redeploy.</span>
                </div>
                <div className="field"><label htmlFor="s-chan">Channel</label><input type="text" id="s-chan" name="channel" defaultValue={sv.channel ?? "#client-updates"} /></div>
                <div className="eyebrow">Post to Slack when</div>
                <Switch name="enabled" defaultChecked={sv.enabled ?? true} label="An account is created, assigned, approved or gets a report" hint="New accounts, requests, approvals and report uploads" />
                <div className="row" style={{ justifyContent: "flex-end" }}><button className="btn primary sm">Save</button></div>
              </div>
            </form>
          ) : (
            <div className="card"><div className="card-h"><h3>Workspace</h3></div><div className="card-b muted">Slack and team settings are managed by admins.</div></div>
          )}
          <div className="card">
            <div className="card-h"><h3>Branding</h3><span className="muted small">White-label</span></div>
            <div className="card-b stack" style={{ gap: 10 }}>
              <div className="row"><span className="swatch"><span style={{ width: 40, height: 32, borderRadius: 4, background: "var(--accent)", border: "1px solid var(--line-strong)" }} /><span className="mono">#ff5f1f accent</span></span><span className="swatch"><span style={{ width: 40, height: 32, borderRadius: 4, background: "var(--ink)", border: "1px solid var(--line-strong)" }} /><span className="mono">#131313 sidebar</span></span></div>
              <span className="hint">Colours, logo and company name are brand tokens in the code. Ask for a change and it ships with the next deploy.</span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
