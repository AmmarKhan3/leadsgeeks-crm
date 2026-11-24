import { redirect } from "next/navigation";
import { getProfile, createClient } from "@/lib/supabase/server";
import { listTeam } from "@/lib/data";
import { ROLES, type Role } from "@/lib/constants";
import { Person, Pill } from "@/components/ui";
import { inviteUser, setActive, setRole } from "./actions";

export const metadata = { title: "Team" };

const Y = "✓", N = "—";
const MATRIX: [string, string, string, string, string, string][] = [
  ["See all accounts & search everything", Y, Y, N, N, N],
  ["See only assigned accounts", N, N, Y, Y, Y],
  ["Create accounts (CS picks a team lead; CS & leads need admin approval)", Y, Y, Y, N, N],
  ["Approve or reject new accounts", Y, N, N, N, N],
  ["Assign / reassign CS owner & backend team", Y, Y, N, N, N],
  ["Edit account details & access checklist", Y, Y, Y, Y, N],
  ["Open stored client logins (URL, username, password)", Y, "Own accounts", "Own accounts", "Assigned accounts", N],
  ["Upload monthly reports", Y, N, N, Y, N],
  ["View monthly reports", Y, Y, Y, Y, Y],
  ["Billing: MRC, due date, method, upsells", Y, N, Y, N, N],
  ["Add notes & requests", Y, Y, Y, Y, N],
  ["Manage team & import", Y, N, N, N, N],
];

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  const me = (await getProfile())!;
  if (me.role !== "admin") redirect("/dashboard");
  const sp = await searchParams;
  const team = await listTeam();
  const supabase = await createClient();
  const { data: counts } = await supabase.from("accounts").select("cs_id, backend:account_backend(user_id)");
  const countFor = (id: string) => (counts ?? []).filter((a) => a.cs_id === id || (a.backend as { user_id: string }[]).some((b) => b.user_id === id)).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end gap-3">
        <div>
          <h2 className="text-2xl">Team</h2>
          <p className="text-fg-2">{team.filter((u) => u.active).length} active members</p>
        </div>
      </div>
      {sp.msg ? <div className="banner info">{sp.msg}</div> : null}
      {sp.error ? <div className="banner bad">{sp.error}</div> : null}
      <form action={inviteUser} className="card card-b grid md:grid-cols-[1fr_1fr_180px_auto] gap-3 items-end">
        <div className="field">
          <label>Full name</label>
          <input name="name" required />
        </div>
        <div className="field">
          <label>Work email</label>
          <input name="email" type="email" required />
        </div>
        <div className="field">
          <label>Role</label>
          <select name="role" defaultValue="cs">
            {(Object.keys(ROLES) as Role[]).map((r) => (
              <option key={r} value={r}>
                {ROLES[r].label}
              </option>
            ))}
          </select>
        </div>
        <button className="btn primary">Send invite</button>
        <span className="text-xs text-fg-3 md:col-span-4">They get an email with a link to set their password.</span>
      </form>
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th>Member</th>
              <th>Email</th>
              <th>Role</th>
              <th>Accounts</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {team.map((u) => (
              <tr key={u.id}>
                <td>
                  <Person name={u.name} />
                </td>
                <td className="text-fg-2">{u.email}</td>
                <td>
                  <form action={setRole.bind(null, u.id)} className="inline-flex gap-1">
                    <select name="role" defaultValue={u.role} disabled={u.id === me.id} className="h-7 px-2 rounded border border-line text-xs bg-surface">
                      {(Object.keys(ROLES) as Role[]).map((r) => (
                        <option key={r} value={r}>
                          {ROLES[r].label}
                        </option>
                      ))}
                    </select>
                    {u.id !== me.id ? <button className="btn sm">Set</button> : null}
                  </form>
                </td>
                <td>{countFor(u.id)}</td>
                <td>{u.active ? <Pill tone="ok">Active</Pill> : <Pill tone="muted">Deactivated</Pill>}</td>
                <td className="text-right">
                  {u.id !== me.id ? (
                    <form action={setActive.bind(null, u.id, !u.active)}>
                      <button className="btn sm ghost">{u.active ? "Deactivate" : "Reactivate"}</button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card">
        <div className="card-h">
          <h3>What each role can do</h3>
          <span className="ml-auto text-xs text-fg-3">Enforced by the database, not just the screens</span>
        </div>
        <div className="overflow-x-auto">
          <table className="tbl">
            <thead>
              <tr>
                <th>Permission</th>
                <th>Admin</th>
                <th>Team Lead</th>
                <th>CS</th>
                <th>Backend</th>
                <th>Sales</th>
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((r) => (
                <tr key={r[0]}>
                  {r.map((c, i) => (
                    <td key={i} className={i === 0 ? "" : c === Y ? "text-ok font-bold" : c === N ? "text-fg-3" : "text-xs text-fg-2"}>
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
