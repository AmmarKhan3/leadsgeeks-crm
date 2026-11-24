import Link from "next/link";
import { getProfile } from "@/lib/supabase/server";
import { perms } from "@/lib/perms";
import { listAccounts } from "@/lib/data";
import { STATUSES } from "@/lib/constants";
import { StatusPill, Person, Empty } from "@/components/ui";

export const metadata = { title: "Accounts" };

export default async function AccountsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const sp = await searchParams;
  const me = (await getProfile())!;
  const p = perms(me.role);
  const accounts = await listAccounts({ q: sp.q, status: sp.status });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <h2 className="text-2xl">{p.seesAll ? "All accounts" : me.role === "sales" ? "Closed accounts" : "My accounts"}</h2>
          <p className="text-fg-2">{accounts.length} accounts</p>
        </div>
        <div className="flex-1" />
        {p.create ? (
          <Link href="/accounts/new" className="btn primary">
            New account
          </Link>
        ) : null}
      </div>
      <form className="card p-3 flex gap-2 flex-wrap items-center">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Search business, city or industry" className="h-9 px-3 rounded-[var(--radius)] border border-line bg-bg text-sm flex-1 min-w-48 outline-none focus:border-accent" />
        <select name="status" defaultValue={sp.status ?? ""} className="h-9 px-3 rounded-[var(--radius)] border border-line bg-surface text-sm">
          <option value="">Any status</option>
          {STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <button className="btn">Filter</button>
        {sp.q || sp.status ? (
          <Link href="/accounts" className="btn ghost">
            Clear
          </Link>
        ) : null}
      </form>
      <div className="card overflow-x-auto">
        {accounts.length ? (
          <table className="tbl">
            <thead>
              <tr>
                <th>Business</th>
                <th>Industry</th>
                <th>Status</th>
                <th>CS owner</th>
                <th>Team lead</th>
                <th>Backend team</th>
                <th>Services</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((a) => (
                <tr key={a.id} className="link">
                  <td>
                    <Link href={`/accounts/${a.id}`} className="font-semibold block">
                      {a.business}
                    </Link>
                    <span className="text-xs text-fg-3">
                      {a.city}, {a.state}
                    </span>
                  </td>
                  <td className="text-fg-2">{a.industry}</td>
                  <td>
                    <StatusPill status={a.status} />
                    {a.approval === "pending" ? <span className="pill warn ml-1">Pending approval</span> : a.approval === "rejected" ? <span className="pill bad ml-1">Rejected</span> : null}
                  </td>
                  <td>
                    <Person name={a.cs?.name} size="sm" />
                  </td>
                  <td>
                    <Person name={a.lead?.name} size="sm" />
                  </td>
                  <td className="text-fg-2">
                    {a.backend.length ? (
                      a.backend.map((b) => (
                        <span key={b.user_id + b.specialty} className="inline-flex items-center gap-1 mr-2">
                          {b.profile?.name?.split(" ")[0]}
                          <span className="eyebrow">{b.specialty}</span>
                        </span>
                      ))
                    ) : (
                      <span className="text-fg-3">Not assigned</span>
                    )}
                  </td>
                  <td className="text-xs text-fg-2">{a.services.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Empty title="No accounts match" text={sp.q || sp.status ? "Try a different search or clear the filters." : "No accounts assigned to you yet."} />
        )}
      </div>
    </div>
  );
}
