import Link from "next/link";
import { getProfile, createClient } from "@/lib/supabase/server";
import { perms } from "@/lib/perms";
import { listAccounts } from "@/lib/data";
import { firstName, fmtDate, lastMonth, monthLabel } from "@/lib/format";
import { Stat, StatusPill, Person, Empty } from "@/components/ui";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const me = (await getProfile())!;
  const p = perms(me.role);
  const supabase = await createClient();
  const accounts = await listAccounts();
  const live = accounts.filter((a) => a.approval === "approved");
  const month = lastMonth();

  const [{ data: reportsDone }, { data: requested }, { data: requests }, { data: pendingApprovals }] = await Promise.all([
    supabase.from("reports").select("account_id").eq("month", month + "-01"),
    supabase.from("checklist_items").select("account_id, item_key").eq("status", "requested"),
    supabase.from("notes").select("id, account_id, body, due_on, author:profiles!notes_author_fkey(name), account:accounts(business)").eq("kind", "request").eq("status", "open").eq("assignee", me.id).order("due_on", { ascending: true, nullsFirst: false }),
    p.approve ? supabase.from("accounts").select("id, business, approval_requested_at, requester:profiles!accounts_approval_requested_by_fkey(name)").eq("approval", "pending") : Promise.resolve({ data: [] as never[] }),
  ]);

  const reported = new Set((reportsDone ?? []).map((r) => r.account_id));
  const needsReport = live.filter((a) => ["Active", "Past due"].includes(a.status) && !reported.has(a.id));
  const gaps = new Map<string, number>();
  (requested ?? []).forEach((r) => gaps.set(r.account_id, (gaps.get(r.account_id) ?? 0) + 1));
  const noBackend = p.seesAll ? live.filter((a) => a.backend.length === 0) : [];
  const onboarding = live.filter((a) => a.status === "Onboarding" || a.status === "Signed");

  type Alert = { tone: string; text: string; href: string; sub?: string };
  const alerts: Alert[] = [
    ...(pendingApprovals ?? []).map((a) => ({ tone: "bad", text: `${a.business} is waiting for your approval`, sub: `created by ${(a.requester as unknown as { name: string } | null)?.name ?? "someone"} · ${fmtDate(a.approval_requested_at)}`, href: `/accounts/${a.id}` })),
    ...noBackend.map((a) => ({ tone: "warn", text: `${a.business}: backend team not assigned`, href: `/accounts/${a.id}?tab=overview` })),
    ...(requests ?? []).map((r) => ({ tone: "info", text: `Request from ${(r.author as unknown as { name: string } | null)?.name ?? "someone"} on ${(r.account as unknown as { business: string } | null)?.business ?? "an account"}`, sub: r.body.slice(0, 90) + (r.due_on ? ` · due ${fmtDate(r.due_on)}` : ""), href: `/accounts/${r.account_id}?tab=notes` })),
    ...needsReport.map((a) => ({ tone: "warn", text: `${monthLabel(month)} report missing for ${a.business}`, sub: a.backend.map((b) => b.profile?.name).filter(Boolean).join(", ") || "no backend assigned", href: `/accounts/${a.id}?tab=reports` })),
    ...live.filter((a) => gaps.has(a.id)).map((a) => ({ tone: "muted", text: `${a.business}: ${gaps.get(a.id)} access item${gaps.get(a.id) === 1 ? "" : "s"} still requested`, href: `/accounts/${a.id}?tab=checklist` })),
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-2xl">Welcome back, {firstName(me.name)}</h2>
        <p className="text-fg-2">{p.seesAll ? `${live.length} accounts across the team` : `${live.length} accounts assigned to you`}</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label={p.seesAll ? "Accounts" : "My accounts"} value={live.length} href="/accounts" />
        <Stat label="Onboarding" value={onboarding.length} tone={onboarding.length ? "warn" : undefined} href="/accounts?status=Onboarding" />
        <Stat label={`Reports missing · ${monthLabel(month).split(" ")[0]}`} value={needsReport.length} tone={needsReport.length ? "bad" : undefined} />
        <Stat label="Requests for me" value={requests?.length ?? 0} tone={requests?.length ? "warn" : undefined} />
      </div>
      <div className="grid lg:grid-cols-[1fr_1.4fr] gap-6 items-start">
        <div className="card">
          <div className="card-h">
            <h3>Needs attention</h3>
            <span className="text-fg-3 text-xs ml-auto">{alerts.length} items</span>
          </div>
          {alerts.length ? (
            <ul className="divide-y divide-line">
              {alerts.slice(0, 12).map((al, i) => (
                <li key={i}>
                  <Link href={al.href} className="flex gap-3 px-5 py-3 hover:bg-surface-2/60">
                    <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${al.tone === "bad" ? "bg-bad" : al.tone === "warn" ? "bg-warn" : al.tone === "info" ? "bg-info" : "bg-fg-3"}`} />
                    <span className="min-w-0">
                      <span className="block font-medium">{al.text}</span>
                      {al.sub ? <span className="block text-xs text-fg-3 truncate">{al.sub}</span> : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="All clear" text="Nothing is waiting on you right now." />
          )}
        </div>
        <div className="card">
          <div className="card-h">
            <h3>{p.seesAll ? "Recently updated" : "My accounts"}</h3>
            <Link href="/accounts" className="ml-auto text-sm text-accent-deep font-semibold">
              See all
            </Link>
          </div>
          {accounts.length ? (
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Status</th>
                    <th>CS owner</th>
                    <th>Backend</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.slice(0, 10).map((a) => (
                    <tr key={a.id} className="link">
                      <td>
                        <Link href={`/accounts/${a.id}`} className="font-semibold block">
                          {a.business}
                        </Link>
                        <span className="text-xs text-fg-3">
                          {a.industry} · {a.city}, {a.state}
                        </span>
                      </td>
                      <td>
                        <StatusPill status={a.status} />
                        {a.approval === "pending" ? <span className="pill warn ml-1">Pending approval</span> : null}
                      </td>
                      <td>
                        <Person name={a.cs?.name} size="sm" />
                      </td>
                      <td className="text-fg-2">{a.backend.map((b) => b.profile?.name?.split(" ")[0]).filter(Boolean).join(", ") || <span className="text-fg-3">Not assigned</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty title="No accounts yet" text={p.create ? "Create the first one from New account, or import your spreadsheet." : "Nothing has been assigned to you yet."} />
          )}
        </div>
      </div>
    </div>
  );
}
