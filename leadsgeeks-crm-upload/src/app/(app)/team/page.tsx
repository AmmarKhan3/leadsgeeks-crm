import { redirect } from "next/navigation";
import { getProfile, createClient } from "@/lib/supabase/server";
import { listTeam } from "@/lib/data";
import { Person, RolePill, PageHead } from "@/components/ui";
import { Icon } from "@/components/icons";
import { PageTitle } from "@/components/page-title";
import { InviteButton, EditMemberButton, ActiveSwitch } from "./widgets";

export const metadata = { title: "Team" };

const Y = "Y", N = "N";
const MATRIX: [string, string, string, string, string, string][] = [
  ["See all accounts & search everything", Y, Y, N, N, N],
  ["See only assigned accounts", N, N, Y, Y, Y],
  ["Create accounts (CS picks a team lead; CS & leads need admin approval)", Y, Y, Y, N, N],
  ["Approve or reject new accounts", Y, N, N, N, N],
  ["Assign the backend team", Y, Y, N, N, N],
  ["Assign / reassign CS owner & backend team", Y, Y, N, N, N],
  ["Edit account details & access checklist", Y, Y, Y, Y, N],
  ["Open stored client logins (URL, username, password)", Y, "Own accounts", "Own accounts", "Assigned accounts", N],
  ["Upload monthly reports", Y, N, N, Y, N],
  ["View monthly reports", Y, Y, Y, Y, Y],
  ["Billing: MRR, due date, method, upsells", Y, N, Y, N, N],
  ["Add notes", Y, Y, Y, Y, N],
  ["Manage team & import", Y, N, N, N, N],
];

export default async function TeamPage({ searchParams }: { searchParams: Promise<{ msg?: string; error?: string }> }) {
  const me = (await getProfile())!;
  if (me.role !== "admin") redirect("/dashboard");
  const sp = await searchParams;
  const team = await listTeam();
  const supabase = await createClient();
  const { data: counts } = await supabase.from("accounts").select("cs_id, sales_id, backend:account_backend(user_id)");
  const all = counts?.length ?? 0;
  const countFor = (id: string) => (counts ?? []).filter((a) => a.cs_id === id || a.sales_id === id || (a.backend as { user_id: string }[]).some((b) => b.user_id === id)).length;

  return (
    <>
      <PageTitle title="Team" />
      <PageHead title="Team" sub={`${team.filter((u) => u.active).length} active members`}>
        <InviteButton />
      </PageHead>
      {sp.msg ? <div className="banner info"><Icon n="info" /><div>{sp.msg}</div></div> : null}
      {sp.error ? <div className="banner bad"><Icon n="alert" /><div>{sp.error}</div></div> : null}
      <div className="card">
        <div className="tablewrap">
          <table className="tbl">
            <thead>
              <tr><th>Member</th><th>Email</th><th>Role</th><th>Accounts</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {team.map((u) => (
                <tr key={u.id}>
                  <td><Person name={u.name} role={u.role} /></td>
                  <td className="muted">{u.email}</td>
                  <td><RolePill role={u.role} /></td>
                  <td className="num">{u.role === "admin" || u.role === "lead" ? <span className="muted">All ({all})</span> : countFor(u.id)}</td>
                  <td><ActiveSwitch userId={u.id} active={u.active} isMe={u.id === me.id} /></td>
                  <td className="r"><EditMemberButton user={u} isMe={u.id === me.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card">
        <div className="card-h"><h3>What each role can do</h3><span className="muted small">Enforced by the database, not just the screens</span></div>
        <div className="tablewrap">
          <table className="tbl compact">
            <thead>
              <tr><th>Permission</th><th>Admin</th><th>Team Lead</th><th>Customer Success</th><th>Backend</th><th>Sales</th></tr>
            </thead>
            <tbody>
              {MATRIX.map((r) => (
                <tr key={r[0]}>
                  <td>{r[0]}</td>
                  {r.slice(1).map((c, i) => (
                    <td key={i}>{c === Y ? <span style={{ color: "var(--ok)" }}><Icon n="check" size={16} /></span> : c === N ? <span className="faint">—</span> : c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
