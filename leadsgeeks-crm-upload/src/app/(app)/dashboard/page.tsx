import Link from "next/link";
import { getProfile, createClient } from "@/lib/supabase/server";
import { perms } from "@/lib/perms";
import { listAccounts, accountExtras } from "@/lib/data";
import { firstName, fmtDate, lastMonth, monthLabel, thisMonth, daysUntil } from "@/lib/format";
import { itemLabel } from "@/lib/constants";
import { Stat, Person, Empty, Pill, Avatar, TeamStack, ApprovalChip, PageHead } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Money } from "@/components/money";
import { PageTitle } from "@/components/page-title";
import { AccountsTable } from "@/components/accounts-table";
import { decideApproval } from "@/app/(app)/accounts/[id]/actions";
import { Confirm } from "@/app/(app)/accounts/[id]/widgets";

export const metadata = { title: "Dashboard" };

const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function DashboardPage() {
  const me = (await getProfile())!;
  const p = perms(me.role);
  const supabase = await createClient();
  const accounts = await listAccounts();
  const live = accounts.filter((a) => a.approval === "approved");
  const lm = lastMonth();
  const tm = thisMonth();

  const [extras, { data: requested }, { data: requests }, { data: notes }] = await Promise.all([
    accountExtras(accounts, p.billing),
    supabase.from("checklist_items").select("account_id, item_key").eq("status", "requested"),
    supabase.from("notes").select("id, account_id, body, due_on, created_at, author:profiles!notes_author_fkey(name), account:accounts(business)").eq("kind", "request").eq("status", "open").eq("assignee", me.id).order("due_on", { ascending: true, nullsFirst: false }),
    supabase.from("notes").select("id, account_id, body, kind, status, created_at, author:profiles!notes_author_fkey(name, role), account:accounts(business)").eq("is_private", false).order("created_at", { ascending: false }).limit(4),
  ]);
  type Named = { name: string; role?: string } | null;
  const nm = (x: unknown) => (x as Named)?.name ?? "someone";

  const active = live.filter((a) => a.status === "Active").length;
  const onboarding = live.filter((a) => a.status === "Onboarding");
  const queue = p.approve ? accounts.filter((a) => a.approval === "pending").sort((x, y) => (x.approval_requested_at ?? "") < (y.approval_requested_at ?? "") ? -1 : 1) : [];
  const missing = live.filter((a) => extras.get(a.id)?.missingReport);
  const gapsAll = live.filter((a) => (extras.get(a.id)?.access.requested ?? 0) > 0);
  const gapItems = gapsAll.reduce((s, a) => s + (extras.get(a.id)?.access.requested ?? 0), 0);
  const overdue = p.billing ? live.filter((a) => extras.get(a.id)?.pay.state === "overdue") : [];
  const dueSoon = p.billing ? live.filter((a) => { const s = extras.get(a.id)?.pay; return s?.state === "due" && (s.days ?? 99) <= 7; }) : [];
  const mrr = live.reduce((s, a) => s + (extras.get(a.id)?.mrr ?? 0), 0);
  const noBackend = p.reassign ? accounts.filter((a) => !a.backend.length && a.approval !== "rejected" && (p.manageUsers || a.lead_id === me.id)) : [];
  const forMe = requests ?? [];
  const forMeLate = forMe.filter((r) => r.due_on && daysUntil(r.due_on) < 0);
  const reqItems = (requested ?? []).reduce<Record<string, string[]>>((m, r) => ((m[r.account_id] ??= []).push(r.item_key), m), {});

  type Alert = { tone: "bad" | "warn" | "info"; id: string; business: string; t: string; s: React.ReactNode; tab?: string };
  const alerts: Alert[] = [
    ...forMe.map((r) => { const d = r.due_on ? daysUntil(r.due_on) : null; return { tone: d != null && d < 0 ? "bad" : "warn", id: r.account_id, business: nm(r.account) === "someone" ? "Account" : (r.account as unknown as { business: string }).business, tab: "notes", t: `Request from ${nm(r.author).split(" ")[0]}${d != null ? ` · ${d < 0 ? `${-d} day${-d === 1 ? "" : "s"} overdue` : d === 0 ? "due today" : `due ${fmtDate(r.due_on)}`}` : ""}`, s: r.body.length > 70 ? r.body.slice(0, 70) + "…" : r.body } as Alert; }),
    ...noBackend.map((a) => ({ tone: "warn" as const, id: a.id, business: a.business, t: "Backend team not assigned", s: `Created by ${a.requester?.name ?? a.cs?.name ?? "someone"} · team lead ${a.lead?.name ?? "not set"}`, tab: "overview" })),
    ...queue.map((a) => ({ tone: "warn" as const, id: a.id, business: a.business, t: "Awaiting your approval", s: `Created by ${a.requester?.name ?? "someone"} on ${fmtDate(a.approval_requested_at ?? a.created_at)}` })),
    ...(p.manageUsers ? [] : accounts.filter((a) => a.approval === "pending")).map((a) => ({ tone: "warn" as const, id: a.id, business: a.business, t: "Awaiting admin approval", s: `Created by ${a.requester?.name ?? "someone"} on ${fmtDate(a.approval_requested_at ?? a.created_at)}` })),
    ...accounts.filter((a) => a.approval === "rejected").map((a) => ({ tone: "bad" as const, id: a.id, business: a.business, t: "Rejected by admin", s: "Fix the details and resubmit" })),
    ...(p.reassign ? [] : accounts.filter((a) => !a.backend.length && a.approval !== "rejected")).map((a) => ({ tone: "warn" as const, id: a.id, business: a.business, t: "Backend team not assigned yet", s: `Waiting on ${a.lead?.name ?? "the team lead"} (team lead)` })),
    ...live.filter((a) => a.status === "Onboarding" && a.backend.length).map((a) => { const st = extras.get(a.id)!.access; return { tone: "info" as const, id: a.id, business: a.business, tab: "checklist", t: `Onboarding · ${st.have} of ${st.total} accesses in hand`, s: st.requested ? `${st.requested} still requested from the client` : "All access collected, ready to go Active" }; }),
    ...missing.map((a) => ({ tone: "bad" as const, id: a.id, business: a.business, tab: "reports", t: `${monthLabel(lm)} report not uploaded`, s: a.backend.length ? `SEO: ${(a.backend.find((b) => b.specialty === "SEO") ?? a.backend[0]).profile?.name}` : "No backend assigned" })),
    ...gapsAll.filter((a) => a.status !== "Onboarding").map((a) => { const n = extras.get(a.id)!.access.requested; return { tone: "warn" as const, id: a.id, business: a.business, tab: "checklist", t: `${n} access item${n > 1 ? "s" : ""} still requested`, s: (reqItems[a.id] ?? []).map(itemLabel).slice(0, 3).join(", ") }; }),
    ...overdue.map((a) => { const s = extras.get(a.id)!; return { tone: "bad" as const, id: a.id, business: a.business, tab: "billing", t: `${monthLabel(tm)} payment ${s.pay.days} day${s.pay.days === 1 ? "" : "s"} overdue`, s: <><Money value={s.mrr} /> · due {fmtDate(s.pay.date)} · {s.method}</> }; }),
    ...dueSoon.map((a) => { const s = extras.get(a.id)!; return { tone: "info" as const, id: a.id, business: a.business, tab: "billing", t: `Payment due ${s.pay.days === 0 ? "today" : `in ${s.pay.days} day${s.pay.days === 1 ? "" : "s"}`}`, s: <><Money value={s.mrr} /> · {fmtDate(s.pay.date)} · {s.method}</> }; }),
  ].sort((x, y) => ({ bad: 0, warn: 1, info: 2 })[x.tone] - ({ bad: 0, warn: 1, info: 2 })[y.tone]);

  const today = new Date();
  const tableRows = [...accounts].sort((x, y) => Number(!!extras.get(y.id)?.missingReport) - Number(!!extras.get(x.id)?.missingReport) || x.business.localeCompare(y.business)).slice(0, 8);

  return (
    <>
      <PageTitle title="Dashboard" />
      <PageHead eyebrow={`${MONTHS_LONG[today.getMonth()]} ${today.getDate()}, ${today.getFullYear()}`} title={`Welcome back, ${firstName(me.name)}`}>
        {p.create ? (
          <Link className="btn primary" href="/accounts/new">
            <Icon n="plus" /> New account
          </Link>
        ) : null}
      </PageHead>

      <div className="grid c5">
        <Stat label={p.seesAll ? "All accounts" : "My accounts"} value={accounts.length} detail={`${active} active · ${onboarding.length} onboarding`} href="/accounts" />
        <Stat label="Reports missing" value={missing.length} detail={`${monthLabel(lm)} reports due`} alert={!!missing.length} />
        <Stat label="Access gaps" value={gapsAll.length} detail={`${gapItems} item${gapItems === 1 ? "" : "s"} still requested`} alert={!!gapsAll.length} />
        <Stat label="Requests for me" value={forMe.length} detail={forMe.length ? `${forMeLate.length} overdue · ${forMe.length - forMeLate.length} on time` : "Nothing waiting on you"} alert={!!forMeLate.length} />
        {p.billing ? (
          <Stat label="Monthly recurring" value={<Money value={mrr} />} detail={<>{overdue.length ? <b style={{ color: "var(--bad)" }}>{overdue.length} overdue</b> : "0 overdue"} · {dueSoon.length} due this week</>} alert={!!overdue.length} />
        ) : p.reassign ? (
          <Stat label="Backend to assign" value={noBackend.length} detail={noBackend.length ? noBackend.map((a) => a.business).slice(0, 2).join(", ") : "All accounts have a backend team"} alert={!!noBackend.length} />
        ) : (
          <Stat label="Onboarding" value={onboarding.length} detail={onboarding.map((a) => a.business).slice(0, 2).join(", ") || "None in setup"} />
        )}
      </div>

      {p.reassign ? (
        <div className={`card queue ${noBackend.length ? "queue-hot" : ""}`}>
          <div className="card-h">
            <h3>Assign backend team</h3>
            <Pill tone={noBackend.length ? "warn" : "ok"} plain>{noBackend.length} account{noBackend.length === 1 ? "" : "s"}</Pill>
            <div className="spacer" />
            <span className="muted small">{p.manageUsers ? "Accounts waiting for a backend team." : "Accounts handed to you by Customer Success. Add the SEO, GBP and other backend people."}</span>
          </div>
          {noBackend.length ? (
            <div className="tablewrap">
              <table className="tbl compact">
                <thead>
                  <tr><th>Business</th><th>Created by</th><th>When</th><th>CS owner</th><th>Team lead</th><th></th></tr>
                </thead>
                <tbody>
                  {noBackend.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/accounts/${a.id}`} className="link">{a.business}</Link>
                        <span className="sub">{a.industry} · {a.city}, {a.state} <ApprovalChip approval={a.approval} /></span>
                      </td>
                      <td><Person name={a.requester?.name ?? a.cs?.name} role="cs" size="sm" /></td>
                      <td className="nowrap">{fmtDate(a.approval_requested_at ?? a.created_at)}</td>
                      <td><Person name={a.cs?.name} role="cs" size="sm" /></td>
                      <td><Person name={a.lead?.name} role="lead" size="sm" /></td>
                      <td className="r nowrap">
                        <Link href={`/accounts/${a.id}?tab=overview&edit=team`} className="btn primary sm"><Icon n="users" /> Assign backend team</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card-b muted small">Nothing waiting. Every account has at least one backend person.</div>
          )}
        </div>
      ) : null}

      {p.manageUsers ? (
        <div className="card queue">
          <div className="card-h">
            <h3>Pending approval</h3>
            <Pill tone={queue.length ? "warn" : "ok"} plain>{queue.length} account{queue.length === 1 ? "" : "s"}</Pill>
            <div className="spacer" />
            <span className="muted small">New accounts from CS and team leads go live once you approve them.</span>
          </div>
          {queue.length ? (
            <div className="tablewrap">
              <table className="tbl compact">
                <thead>
                  <tr><th>Business</th><th>Created by</th><th>When</th><th>CS owner</th><th>Backend</th><th></th></tr>
                </thead>
                <tbody>
                  {queue.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <Link href={`/accounts/${a.id}`} className="link">{a.business}</Link>
                        <span className="sub">{a.industry} · {a.city}, {a.state}</span>
                      </td>
                      <td><Person name={a.requester?.name} role="cs" size="sm" /></td>
                      <td className="nowrap">{fmtDate(a.approval_requested_at ?? a.created_at)}</td>
                      <td><Person name={a.cs?.name} role="cs" size="sm" /></td>
                      <td><TeamStack backend={a.backend} /></td>
                      <td className="r nowrap">
                        <span className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                          <form action={decideApproval.bind(null, a.id, true, "")}>
                            <button className="btn primary sm"><Icon n="check" /> Approve</button>
                          </form>
                          <Confirm label="Reject" prompt="Reason for rejecting (the creator sees this)" action={decideApproval.bind(null, a.id, false)} className="btn sm ghost danger" />
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="card-b muted small">Nothing waiting for approval.</div>
          )}
        </div>
      ) : null}

      <div className="grid c21">
        <div className="card">
          <div className="card-h">
            <h3>Needs attention</h3>
            <Pill tone={alerts.length ? "warn" : "ok"} plain>{alerts.length} item{alerts.length === 1 ? "" : "s"}</Pill>
          </div>
          {alerts.length ? (
            <div className="alist">
              {alerts.map((x, i) => (
                <Link key={i} href={`/accounts/${x.id}${x.tab ? `?tab=${x.tab}` : ""}`} className={`ai ${x.tone}`} style={{ textDecoration: "none" }}>
                  <span className="bar" />
                  <div>
                    <b>{x.business}</b>
                    <span>{x.t} · {x.s}</span>
                  </div>
                  <Icon n="chevron" size={16} style={{ color: "var(--fg-3)" }} />
                </Link>
              ))}
            </div>
          ) : (
            <Empty icon="check" title="All clear" text="Every account has this month's report and all requested access." />
          )}
        </div>
        <div className="card">
          <div className="card-h">
            <h3>Recent notes</h3>
          </div>
          <div className="card-b" style={{ paddingTop: 4, paddingBottom: 4 }}>
            <div className="timeline">
              {notes?.length ? (
                notes.map((n) => (
                  <div key={n.id} className="tl-item">
                    <Avatar name={nm(n.author)} role={(n.author as unknown as Named)?.role} size="sm" />
                    <div>
                      <div className="head">
                        <b>{nm(n.author)}</b>
                        <span className="faint">on</span>
                        <Link href={`/accounts/${n.account_id}?tab=notes`} className="link">{(n.account as unknown as { business: string } | null)?.business}</Link>
                        <time>{fmtDate(n.created_at)}</time>
                      </div>
                      <p className="small">
                        {n.kind === "request" ? <span className="spec" style={{ marginRight: 4 }}>{n.status === "open" ? "request" : "done"}</span> : null}
                        {n.body}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="muted" style={{ padding: "12px 0" }}>No notes yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-h">
          <h3>{p.seesAll ? "All accounts" : "My accounts"}</h3>
          <span className="muted small">{accounts.length} total</span>
          <div className="spacer" />
          <Link className="btn sm" href="/accounts">Open full list</Link>
        </div>
        <AccountsTable rows={tableRows} extras={extras} compact emptyTitle="No accounts assigned yet" emptyText={p.create ? "Create the first one from New account, or import your spreadsheet." : "When an admin or team lead assigns you to an account it will show up here."} />
      </div>
    </>
  );
}
