import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile, createClient } from "@/lib/supabase/server";
import { perms, canOpenLogins } from "@/lib/perms";
import { getAccount, getChecklist, getLoginIndex, listTeam, ownerLabel, ord, type Account } from "@/lib/data";
import { CHANGE_AREAS, ROLES, type Role } from "@/lib/constants";
import { fmtDate, fmtDateTime, monthLabel, thisMonth, lastMonth, daysUntil } from "@/lib/format";
import { Person, StatusPill, ApprovalChip, Pill, Empty, Avatar, TeamList, Tags, Stat, Banner } from "@/components/ui";
import { Icon } from "@/components/icons";
import { Money } from "@/components/money";
import { PageTitle } from "@/components/page-title";
import { Checklist } from "./checklist";
import { ReassignButton, ReportLink, UploadReportButton, EditBillingButton, LogPaymentButton, AddUpsellButton, Confirm } from "./widgets";
import { addNote, decideApproval, resubmit, setRequestDone, setStatus, togglePin } from "./actions";
import { STATUSES } from "@/lib/constants";

type Tab = "overview" | "checklist" | "reports" | "billing" | "notes" | "changes";
type SP = { tab?: Tab; edit?: string; f?: string; view?: string; area?: string };

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const a = await getAccount((await params).id);
  return { title: a?.business ?? "Account" };
}

export default async function AccountPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const { id } = await params;
  const sp = await searchParams;
  const me = (await getProfile())!;
  const p = perms(me.role);
  const a = await getAccount(id);
  if (!a) notFound();
  const tab: Tab = sp.tab ?? "overview";
  const supabase = await createClient();
  const canLogins = canOpenLogins(me, a);
  const live = a.approval === "approved";
  const lm = lastMonth();

  const [checks, logins, { data: reports }, { count: openReqCount }, { count: noteCount }, { count: changeCount }, team] = await Promise.all([
    getChecklist(a.id),
    getLoginIndex(a.id),
    supabase.from("reports").select("id, month, file_path, file_name, uploaded_at, uploader:profiles(name)").eq("account_id", a.id).order("month", { ascending: false }),
    supabase.from("notes").select("id", { count: "exact", head: true }).eq("account_id", a.id).eq("kind", "request").eq("status", "open").eq("is_private", false),
    supabase.from("notes").select("id", { count: "exact", head: true }).eq("account_id", a.id),
    supabase.from("change_log").select("id", { count: "exact", head: true }).eq("account_id", a.id),
    p.reassign || tab === "notes" ? listTeam() : Promise.resolve([]),
  ]);
  const rel = checks.filter((c) => c.status !== "none");
  const have = rel.filter((c) => c.status === "have").length;
  const requested = rel.filter((c) => c.status === "requested").length;
  const missingReport = live && ["Active", "Past due"].includes(a.status) && a.client_since.slice(0, 7) < lm && !(reports ?? []).some((r) => r.month.startsWith(lm));

  const tabs: [Tab, string, React.ReactNode][] = [
    ["overview", "Overview", null],
    ["checklist", "Access checklist", <span key="c" className={`badge ${requested ? "warn" : ""}`}>{have}/{rel.length}</span>],
    ["reports", "Reports", missingReport ? <span key="r" className="badge warn">overdue</span> : <span key="r" className="badge">{reports?.length ?? 0}</span>],
    ["billing", "Billing", p.billing ? null : <Icon key="b" n="lock" />],
    ["notes", "Notes & requests", openReqCount ? <span key="n" className="badge warn">{openReqCount} open</span> : <span key="n" className="badge">{noteCount ?? 0}</span>],
    ["changes", "Change log", <span key="g" className="badge">{changeCount ?? 0}</span>],
  ];

  return (
    <>
      <PageTitle title={a.business} />
      <div className="row small">
        <Link href="/accounts" className="link">{p.seesAll ? "All accounts" : "My accounts"}</Link>
        <span className="faint">/</span>
        <span className="muted">{a.business}</span>
      </div>

      {a.approval === "pending" ? (
        <Banner tone="warn" icon="shield" actions={p.approve ? (
          <>
            <form action={decideApproval.bind(null, a.id, true, "")}><button className="btn primary sm"><Icon n="check" /> Approve</button></form>
            <Confirm label="Reject" prompt="Reason for rejecting (the creator sees this)" action={decideApproval.bind(null, a.id, false)} className="btn sm ghost danger" />
          </>
        ) : undefined}>
          <b>Pending admin approval.</b> Created by {a.requester?.name ?? "someone"} on {fmtDate(a.approval_requested_at ?? a.created_at)}. {p.approve ? "Approve it to make it live; reports, billing and alerts start then." : "An admin will review it. You can keep filling in access and notes meanwhile; reports and billing start after approval."}
        </Banner>
      ) : a.approval === "rejected" ? (
        <Banner tone="bad" icon="alert" actions={p.approve || a.approval_requested_by === me.id ? (
          <>
            <form action={resubmit.bind(null, a.id)}><button className="btn primary sm">Resubmit for approval</button></form>
            {p.approve ? <form action={decideApproval.bind(null, a.id, true, "")}><button className="btn sm"><Icon n="check" /> Approve anyway</button></form> : null}
          </>
        ) : undefined}>
          <b>Rejected by {a.decider?.name ?? "an admin"} on {fmtDate(a.approval_decided_at)}.</b> {a.approval_reason ?? ""} {p.approve || a.approval_requested_by === me.id ? "Fix the details and resubmit." : ""}
        </Banner>
      ) : null}

      {!a.backend.length && a.approval !== "rejected" ? (
        <Banner tone="warn" icon="users" actions={p.reassign ? <ReassignButton accountId={a.id} team={team} csId={a.cs_id} leadId={a.lead_id} salesId={a.sales_id} backend={a.backend.map((b) => ({ user_id: b.user_id, specialty: b.specialty }))} label="Assign backend team" primary autoOpen={sp.edit === "team"} /> : undefined}>
          <b>No backend team yet.</b> {p.reassign ? "Add the SEO, GBP and other backend people so work can start." : `${a.lead?.name ?? "The team lead"} will assign the backend team.`}
        </Banner>
      ) : null}

      <div className="card acct-head">
        <div className="id">
          <div className="row">
            <h2>{a.business}</h2>
            {p.editAccount ? (
              <form action={async (fd) => { "use server"; await setStatus(a.id, String(fd.get("status"))); }} className="row" style={{ gap: 6 }}>
                <StatusSelect status={a.status} />
                <button className="btn sm ghost" title="Save status">Set</button>
              </form>
            ) : (
              <StatusPill status={a.status} />
            )}
            <ApprovalChip approval={a.approval} />
          </div>
          <div className="meta">
            <span>{a.industry === "Other (specify)" ? a.industry_other : a.industry}</span>
            <span className="faint">·</span>
            <span><Icon n="pin" size={14} style={{ display: "inline", verticalAlign: -2 }} /> {a.city}, {a.state}</span>
            <span className="faint">·</span>
            <span className="mono">Client since {fmtDate(a.client_since)}</span>
          </div>
          <div className="quick">
            {a.website ? <a className="btn sm" href={a.website} target="_blank" rel="noopener"><Icon n="globe" /> Website <Icon n="external" /></a> : null}
            {a.gbp_url ? <a className="btn sm" href={a.gbp_url} target="_blank" rel="noopener"><Icon n="pin" /> Google Business Profile <Icon n="external" /></a> : null}
            {p.editAccount ? <Link className="btn sm ghost" href={`/accounts/${a.id}/edit`}><Icon n="edit" /> Edit details</Link> : null}
          </div>
        </div>
        <div className="owners">
          <div className="owner"><span className="k">CS owner</span><Person name={a.cs?.name} role="cs" /></div>
          <div className="owner"><span className="k">Backend team</span>{a.backend.length ? <TeamList backend={a.backend} /> : <span className="muted small">Not assigned yet{a.lead?.name ? ` · waiting on ${a.lead.name.split(" ")[0]}` : ""}</span>}</div>
          <div className="owner"><span className="k">Team lead</span><Person name={a.lead?.name} role="lead" /></div>
          <div className="owner"><span className="k">Sales rep</span><Person name={a.sales?.name} role="sales" /></div>
          {p.reassign ? (
            <div className="owner"><span className="k">&nbsp;</span><ReassignButton accountId={a.id} team={team} csId={a.cs_id} leadId={a.lead_id} salesId={a.sales_id} backend={a.backend.map((b) => ({ user_id: b.user_id, specialty: b.specialty }))} autoOpen={sp.edit === "team" && a.backend.length > 0} /></div>
          ) : null}
        </div>
      </div>

      <div className="tabs">
        {tabs.map(([k, l, extra]) => (
          <Link key={k} href={`/accounts/${a.id}?tab=${k}`} className={`${tab === k ? "active" : ""} ${k === "billing" && !p.billing ? "locked" : ""}`}>
            {l}
            {extra}
          </Link>
        ))}
      </div>

      {tab === "overview" ? <Overview a={a} /> : null}
      {tab === "checklist" ? <Checklist accountId={a.id} rows={checks} logins={logins} canEdit={p.editChecklist} canLogins={canLogins} website={a.website} /> : null}
      {tab === "reports" ? <Reports a={a} reports={reports ?? []} missing={missingReport} canUpload={p.upload && (me.role === "admin" || a.backend.some((b) => b.user_id === me.id))} live={live} /> : null}
      {tab === "billing" ? (p.billing ? <Billing a={a} meName={me.name} /> : <div className="card"><Empty icon="lock" title="Billing is visible to Customer Success and Admins only" text={`Signed in as ${me.name} (${ROLES[me.role].label}). Ask the CS owner${a.cs?.name ? `, ${a.cs.name},` : ""} if you need billing details.`} /></div>) : null}
      {tab === "notes" ? <Notes a={a} me={me} canAdd={p.addNote} filter={sp.f ?? "all"} view={sp.view ?? "team"} team={team} /> : null}
      {tab === "changes" ? <Changes a={a} canLogins={canLogins} area={sp.area ?? "all"} /> : null}
    </>
  );

  // ------------------------------------------------------------ tabs
  function StatusSelect({ status }: { status: string }) {
    return (
      <select name="status" defaultValue={status} style={{ width: "auto", padding: "4px 28px 4px 10px", fontSize: 12.5, fontWeight: 600, borderRadius: 999 }}>
        {STATUSES.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>
    );
  }

  function Overview({ a }: { a: Account }) {
    const own = (v: string, name: string | null, domain = false) => (v === "us" ? <Pill tone="accent" plain>LeadsGeeks</Pill> : <Pill tone="muted" plain>{ownerLabel(v, name, domain)}</Pill>);
    return (
      <div className="grid c2">
        <div className="stack">
          <div className="card">
            <div className="card-h"><h3>Business details</h3></div>
            <div className="card-b">
              <dl className="dl">
                <dt>Phone</dt><dd className="num">{a.phone || <span className="faint">—</span>}</dd>
                <dt>Email</dt><dd>{a.email || <span className="faint">—</span>}</dd>
                <dt>Address</dt><dd>{a.street}{a.street ? <br /> : null}{a.city}, {a.state} {a.zip}<span className="sub faint small" style={{ display: "block" }}>United States</span></dd>
                <dt>Website</dt><dd>{a.website ? <a href={a.website} target="_blank" rel="noopener">{a.website.replace(/^https?:\/\//, "")}</a> : <span className="faint">—</span>}</dd>
                <dt>Google Business Profile</dt><dd>{a.gbp_url ? <a href={a.gbp_url} target="_blank" rel="noopener">Open listing</a> : <span className="faint">—</span>}</dd>
                <dt>Industry</dt><dd>{a.industry === "Other (specify)" ? a.industry_other : a.industry}</dd>
              </dl>
            </div>
          </div>
          <div className="card">
            <div className="card-h"><h3>Website</h3></div>
            <div className="card-b">
              <dl className="dl">
                <dt>Built by</dt><dd>{own(a.built_by, a.built_by_name)}</dd>
                <dt>Hosted by</dt><dd>{own(a.hosted_by, a.hosted_by_name)}</dd>
                <dt>Domain held by</dt><dd>{own(a.domain_by || "client", a.domain_by_name, true)}</dd>
                <dt>Platform</dt><dd>{a.platform}</dd>
              </dl>
              {a.built_by !== "us" && a.hosted_by !== "us" ? (
                <div className="banner info" style={{ marginTop: 14 }}>
                  <Icon n="info" />
                  <div>Client-owned site. We need CMS and hosting access before making changes. Check the <Link href={`/accounts/${a.id}?tab=checklist`} className="link">access checklist</Link>.</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
        <div className="stack">
          <div className="card">
            <div className="card-h">
              <h3>Contacts</h3>
              <div className="spacer" />
              {p.editAccount ? <Link className="btn sm ghost" href={`/accounts/${a.id}/edit`}><Icon n="plus" /> Add</Link> : null}
            </div>
            {a.contacts.length ? (
              <div className="tablewrap">
                <table className="tbl compact">
                  <tbody>
                    {a.contacts.map((c) => (
                      <tr key={c.id}>
                        <td><b>{c.name}</b> {c.is_primary ? <Pill tone="accent" plain>Primary</Pill> : null}<span className="sub">{c.title}</span></td>
                        <td className="num">{c.phone}</td>
                        <td>{c.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card-b muted small">No contacts yet. Add the owner or office manager from Edit details.</div>
            )}
          </div>
          <div className="card">
            <div className="card-h"><h3>Services</h3><span className="muted small">{a.services.length + (a.service_other ? 1 : 0)} active</span></div>
            <div className="card-b">{a.services.length || a.service_other ? <Tags items={[...a.services, ...(a.service_other ? [a.service_other] : [])]} /> : <span className="muted small">None recorded</span>}</div>
          </div>
          <div className="card">
            <div className="card-h"><h3>Team</h3></div>
            <div className="card-b">
              <dl className="dl narrow">
                <dt>CS owner</dt><dd><Person name={a.cs?.name} role="cs" size="sm" /></dd>
                <dt>Backend team</dt><dd>{a.backend.length ? <TeamList backend={a.backend} size="sm" /> : <span className="muted">Not assigned yet</span>}</dd>
                <dt>Team lead</dt><dd><Person name={a.lead?.name} role="lead" size="sm" /></dd>
                <dt>Sales rep</dt><dd><Person name={a.sales?.name} role="sales" size="sm" /></dd>
                <dt>Created</dt><dd className="muted">{fmtDate(a.created_at)}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function Reports({ a, reports, missing, canUpload, live }: { a: Account; reports: { id: string; month: string; file_path: string; file_name: string; uploaded_at: string; uploader: unknown }[]; missing: boolean; canUpload: boolean; live: boolean }) {
    const seo = a.backend.find((b) => b.specialty === "SEO") ?? a.backend[0];
    return (
      <>
        {missing ? (
          <Banner tone="warn" icon="alert"><b>{monthLabel(lm)} report is overdue.</b> {canUpload ? "Upload it from the button on the right." : `${seo?.profile?.name ?? "The backend owner"} hasn't uploaded it yet.`}</Banner>
        ) : a.status === "Onboarding" ? (
          <Banner tone="info" icon="info">First report is due after the first full month of service.</Banner>
        ) : null}
        <div className="card">
          <div className="card-h">
            <h3>Monthly reports</h3>
            <span className="muted small">{reports.length} on file</span>
            <div className="spacer" />
            {canUpload && live ? <UploadReportButton accountId={a.id} csName={a.cs?.name} missingMonth={missing ? lm : null} /> : canUpload ? <span className="muted small">Reports start after admin approval</span> : null}
          </div>
          {reports.length ? (
            <div className="tablewrap">
              <table className="tbl">
                <thead><tr><th>Month</th><th>File</th><th>Uploaded by</th><th>Date</th><th></th></tr></thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r.id}>
                      <td><b>{monthLabel(r.month)}</b></td>
                      <td><span className="row" style={{ gap: 6 }}><Icon n="file" size={16} style={{ color: "var(--accent-deep)" }} /><span className="mono">{r.file_name}</span></span></td>
                      <td><Person name={(r.uploader as { name: string } | null)?.name} role="backend" size="sm" /></td>
                      <td className="nowrap">{fmtDate(r.uploaded_at)}</td>
                      <td className="r nowrap"><ReportLink path={r.file_path} name={r.file_name} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="file" title="No reports yet" text={canUpload ? "Upload the first monthly progress report as a PDF." : "The backend owner uploads a PDF each month. It will appear here."} />
          )}
        </div>
      </>
    );
  }

  async function Billing({ a, meName }: { a: Account; meName: string }) {
    const [{ data: b }, { data: ups }, { data: pays }] = await Promise.all([
      supabase.from("billing").select("*").eq("account_id", a.id).maybeSingle(),
      supabase.from("upsells").select("*, seller:profiles(name)").eq("account_id", a.id).order("sold_on", { ascending: false }),
      supabase.from("payments").select("*, collector:profiles(name)").eq("account_id", a.id).order("month", { ascending: false }).limit(36),
    ]);
    const tm = thisMonth();
    const recurring = (ups ?? []).filter((u) => u.recurring).reduce((s, u) => s + Number(u.amount), 0);
    const effective = b ? Number(b.mrr) + recurring : 0;
    const paid = (pays ?? []).find((p) => p.month.startsWith(tm));
    const billable = live && ["Active", "Past due"].includes(a.status);
    let st: { state: string; v: string; d: string; alert?: boolean; date?: string } = { state: "na", v: "—", d: a.status === "Onboarding" ? "First charge after onboarding" : `${a.status}, not billed` };
    if (paid) st = { state: "paid", v: "Paid", d: `Received ${fmtDate(paid.collected_on)}` };
    else if (b && billable) {
      const due = new Date(new Date().getFullYear(), new Date().getMonth(), b.billing_day);
      const days = Math.round((due.getTime() - new Date(new Date().toDateString()).getTime()) / 86400000);
      st = days >= 0 ? { state: "due", v: days === 0 ? "Due today" : `Due in ${days} day${days === 1 ? "" : "s"}`, d: fmtDate(due), date: due.toISOString().slice(0, 10) } : { state: "overdue", v: `${-days} day${-days === 1 ? "" : "s"} overdue`, d: `Was due ${fmtDate(due)}`, alert: true, date: due.toISOString().slice(0, 10) };
    }
    const total = (pays ?? []).reduce((s, p) => s + Number(p.amount), 0);
    const paidMonths = (pays ?? []).map((p) => p.month.slice(0, 7));
    return (
      <>
        <div className="grid c4">
          <Stat label="Monthly charge (MRC)" value={b ? <Money value={effective} /> : <span className="muted" style={{ fontSize: 18 }}>Not set up</span>} detail={b ? <><Money value={Number(b.mrr)} /> base{recurring ? <> + <Money value={recurring} /> recurring upsells</> : null}</> : "Set the monthly charge in Billing details"} />
          <Stat label={monthLabel(tm)} value={st.v} detail={st.d} alert={st.alert} small />
          <Stat label="Billed on" value={b ? `The ${ord(b.billing_day)}` : "—"} detail={b ? `Every month · ${b.method} · month to month` : "No billing day yet"} small />
          <Stat label="Client since" value={fmtDate(b?.started_on ?? a.client_since)} detail={<>{pays?.length ?? 0} payment{pays?.length === 1 ? "" : "s"} · <Money value={total} /> collected</>} small />
        </div>
        <div className="grid c21">
          <div className="card">
            <div className="card-h">
              <h3>Payments</h3>
              <span className="muted small">MRC collected, newest first</span>
              <div className="spacer" />
              <LogPaymentButton accountId={a.id} amount={effective} method={b?.method ?? "Card"} paidMonths={paidMonths} primary={st.state === "due" || st.state === "overdue"} meName={meName} />
            </div>
            {pays?.length || st.state === "due" || st.state === "overdue" ? (
              <div className="tablewrap">
                <table className="tbl">
                  <thead><tr><th>Month</th><th>Amount</th><th>Received</th><th>Logged by</th><th>Note</th></tr></thead>
                  <tbody>
                    {st.state === "due" || st.state === "overdue" ? (
                      <tr style={{ background: st.state === "overdue" ? "var(--bad-soft)" : "var(--info-soft)" }}>
                        <td><b>{monthLabel(tm)}</b></td>
                        <td className="num"><Money value={effective} /></td>
                        <td colSpan={3}><Pill tone={st.state === "overdue" ? "bad" : "info"}>{st.state === "overdue" ? `Overdue · was due ${fmtDate(st.date)}` : `Due ${fmtDate(st.date)}`}</Pill></td>
                      </tr>
                    ) : null}
                    {(pays ?? []).map((pm) => (
                      <tr key={pm.id}>
                        <td><b>{monthLabel(pm.month)}</b></td>
                        <td className="num"><Money value={Number(pm.amount)} /></td>
                        <td className="nowrap">{fmtDate(pm.collected_on)}</td>
                        <td><Person name={(pm.collector as { name: string } | null)?.name} role="cs" size="sm" /></td>
                        <td className="small muted">{pm.note}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <Empty icon="dollar" title="No payments logged yet" text="When the client's first monthly charge comes in, log it here." />
            )}
          </div>
          <div className="stack">
            <div className="card">
              <div className="card-h"><h3>Billing details</h3><div className="spacer" /><EditBillingButton accountId={a.id} billing={b ? { mrr: Number(b.mrr), billing_day: b.billing_day, method: b.method, started_on: b.started_on } : null} clientSince={a.client_since} /></div>
              <div className="card-b">
                <dl className="dl narrow">
                  <dt>Base MRC</dt><dd className="num">{b ? <Money value={Number(b.mrr)} /> : <span className="faint">—</span>}</dd>
                  <dt>Billing day</dt><dd>{b ? `The ${ord(b.billing_day)} of each month` : <span className="faint">—</span>}</dd>
                  <dt>Method</dt><dd>{b?.method ?? <span className="faint">—</span>}</dd>
                  <dt>Terms</dt><dd>Month to month, no contract term</dd>
                  <dt>Client since</dt><dd>{fmtDate(b?.started_on ?? a.client_since)}</dd>
                </dl>
                <div className="banner info" style={{ marginTop: 16 }}>
                  <Icon n="shield" />
                  <div className="small">Only Customer Success and Admins can see this tab. Backend, Team Leads and Sales see a locked tab.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-h"><h3>Upsells</h3><span className="muted small">{ups?.length ?? 0} sold</span><div className="spacer" /><AddUpsellButton accountId={a.id} /></div>
          {ups?.length ? (
            <div className="tablewrap">
              <table className="tbl">
                <thead><tr><th>Upsell</th><th>Type</th><th>Amount</th><th>Date</th><th>Sold by</th></tr></thead>
                <tbody>
                  {ups.map((u) => (
                    <tr key={u.id}>
                      <td><b>{u.name}</b></td>
                      <td><Pill tone={u.recurring ? "accent" : "muted"} plain>{u.recurring ? "Recurring" : "One-time"}</Pill></td>
                      <td className="num"><Money value={Number(u.amount)} suffix={u.recurring ? "/mo" : undefined} /></td>
                      <td>{fmtDate(u.sold_on)}</td>
                      <td><Person name={(u.seller as { name: string } | null)?.name} role="cs" size="sm" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="dollar" title="No upsells yet" text="Log add-ons like extra ad management, a redesign or a second location here." />
          )}
        </div>
      </>
    );
  }

  async function Notes({ a, me, canAdd, filter, view, team }: { a: Account; me: { id: string; name: string; role: Role }; canAdd: boolean; filter: string; view: string; team: { id: string; name: string; role: Role; active: boolean }[] }) {
    const { data: notes } = await supabase.from("notes").select("*, author_p:profiles!notes_author_fkey(name, role), assignee_p:profiles!notes_assignee_fkey(name, role)").eq("account_id", a.id).order("created_at", { ascending: false });
    type N = NonNullable<typeof notes>[number] & { author_p: { name: string; role: Role } | null; assignee_p: { name: string; role: Role } | null };
    const all = (notes ?? []) as N[];
    const mine = all.filter((n) => n.is_private);
    const shared = all.filter((n) => !n.is_private);
    const open = shared.filter((n) => n.kind === "request" && n.status === "open").sort((x, y) => (x.due_on ?? "9").localeCompare(y.due_on ?? "9"));
    const counts = { all: shared.length, open: open.length, mine: shared.filter((n) => n.kind === "request" && (n.assignee === me.id || n.author === me.id)).length, notes: shared.filter((n) => n.kind !== "request").length };
    const pinnedReqs = filter === "notes" ? [] : filter === "mine" ? open.filter((r) => r.assignee === me.id || r.author === me.id) : open;
    const pinnedNotes = filter === "open" || filter === "mine" ? [] : shared.filter((n) => n.kind !== "request" && n.pinned);
    const history = shared.filter((n) => !(n.kind === "request" && n.status === "open") && !(n.kind !== "request" && n.pinned)).filter((n) => filter === "all" || (filter === "notes" && n.kind !== "request") || (filter === "mine" && n.kind === "request" && (n.assignee === me.id || n.author === me.id)));
    const people = team.filter((u) => u.active && u.id !== me.id && (u.id === a.cs_id || u.id === a.lead_id || u.id === a.sales_id || a.backend.some((b) => b.user_id === u.id) || u.role === "admin" || u.role === "lead"));
    const roleOf = (id: string) => (id === a.cs_id ? "CS owner" : a.backend.filter((b) => b.user_id === id).map((b) => b.specialty).join("/") || ROLES[team.find((u) => u.id === id)?.role ?? "cs"].label);
    const href = (q: Record<string, string>) => `/accounts/${a.id}?tab=notes&${new URLSearchParams({ view, f: filter, ...q }).toString()}`;

    const dueInfo = (r: N) => {
      if (!r.due_on) return null;
      const d = daysUntil(r.due_on);
      return { d, cls: d < 0 ? "late" : d <= 3 ? "soon" : "", label: d < 0 ? `${-d} day${-d === 1 ? "" : "s"} overdue` : d === 0 ? "Due today" : `Due ${fmtDate(r.due_on)}` };
    };
    const reqCard = (r: N) => {
      const due = dueInfo(r);
      if (r.status === "done")
        return (
          <div key={r.id} className="req done collapsed">
            <Icon n="check" />
            <span className="txt"><b>{r.author_p?.name.split(" ")[0]} → {r.assignee_p?.name.split(" ")[0] ?? "anyone"}</b> · {r.body}</span>
            <span className="faint small nowrap">done {fmtDate(r.done_at)}</span>
            {canAdd ? <form action={setRequestDone.bind(null, a.id, r.id, false)}><button className="btn sm ghost" title="Reopen">Reopen</button></form> : null}
          </div>
        );
      return (
        <div key={r.id} className={`req ${due && due.d < 0 ? "overdue" : "open"}`}>
          <div className="top">
            <span className="who"><Avatar name={r.author_p?.name ?? "?"} role={r.author_p?.role} size="sm" /><b>{r.author_p?.name.split(" ")[0]}</b></span>
            <span className="arrow"><Icon n="chevron" /></span>
            <span className="who"><Avatar name={r.assignee_p?.name ?? "?"} role={r.assignee_p?.role} size="sm" /><b>{r.assignee_p?.name.split(" ")[0] ?? "anyone"}</b></span>
            <span className="faint small">{fmtDate(r.created_at)}</span>
            {due ? <span className={`due ${due.cls}`}>{due.label}</span> : null}
          </div>
          <div className="txt">{r.body}</div>
          <div className="foot">
            {canAdd ? <form action={setRequestDone.bind(null, a.id, r.id, true)}><button className={`btn sm ${r.assignee === me.id ? "primary" : ""}`}><Icon n="check" /> Mark done</button></form> : null}
            <span className="faint small">{r.assignee === me.id ? "Assigned to you" : `Waiting on ${r.assignee_p?.name.split(" ")[0] ?? "anyone"}`}</span>
          </div>
        </div>
      );
    };
    const row = (n: N) => (
      <div key={n.id} className="tl-item">
        <Avatar name={n.author_p?.name ?? "?"} role={n.author_p?.role} size="sm" />
        <div>
          <div className="head">
            <b>{n.author_p?.name}</b>
            <span className="faint small">{n.author_p ? ROLES[n.author_p.role as Role].label : ""}</span>
            <time>{fmtDate(n.created_at)}</time>
            {n.kind === "request" ? <span className="faint small">· request</span> : canAdd ? <form action={togglePin.bind(null, a.id, n.id, !n.pinned)}><button className={`link small pinlink ${n.pinned ? "on" : ""}`} title={n.pinned ? "Unpin" : "Pin to the top"}><Icon n="pin" /> {n.pinned ? "Unpin" : "Pin"}</button></form> : null}
          </div>
          {n.kind === "request" ? reqCard(n) : <p style={{ whiteSpace: "pre-wrap" }}>{n.body}</p>}
        </div>
      </div>
    );
    const viewSwitch = (
      <div className="noteview">
        <div className="seg">
          <Link href={href({ view: "team" })} className={`btn ghost ${view !== "private" ? "on" : ""}`} style={{ border: 0, borderRadius: 0, padding: "7px 12px", background: view !== "private" ? "var(--ink)" : "var(--surface)", color: view !== "private" ? "#fff" : "inherit" }}><Icon n="users" /> Team</Link>
          <Link href={href({ view: "private" })} className="btn ghost" style={{ border: 0, borderLeft: "1px solid var(--line-strong)", borderRadius: 0, padding: "7px 12px", background: view === "private" ? "var(--ink)" : "var(--surface)", color: view === "private" ? "#fff" : "inherit" }}><Icon n="lock" /> Private</Link>
        </div>
        <span className="muted small">{view === "private" ? "Your own notes on this account. Nobody else can see them, not even admins." : "Shared with everyone on this account."}</span>
      </div>
    );

    if (view === "private") {
      return (
        <div className="card">
          {viewSwitch}
          {canAdd ? (
            <form action={addNote.bind(null, a.id)} className="composer2">
              <Avatar name={me.name} role={me.role} />
              <div className="body">
                <input type="hidden" name="kind" value="note" />
                <input type="hidden" name="is_private" value="1" />
                <div className="textwrap"><textarea name="body" required placeholder="A note just for you: reminders, impressions, things to bring up next call…" /></div>
                <div className="row"><button className="btn primary sm"><Icon n="lock" /> Save private note</button><span className="faint small">Only you can see this.</span></div>
              </div>
            </form>
          ) : null}
          <div className="card-b" style={{ paddingTop: 4, paddingBottom: 4 }}>
            <div className="timeline">{mine.length ? mine.sort((x, y) => Number(y.pinned) - Number(x.pinned)).map((n) => (
              <div key={n.id} className={`tl-item ${n.pinned ? "is-pinned" : ""}`}>
                <Avatar name={me.name} role={me.role} size="sm" />
                <div>
                  <div className="head"><b>You</b><time>{fmtDate(n.created_at)}</time>{n.pinned ? <Pill tone="accent" plain>Pinned</Pill> : null}<form action={togglePin.bind(null, a.id, n.id, !n.pinned)}><button className={`link small pinlink ${n.pinned ? "on" : ""}`}><Icon n="pin" /> {n.pinned ? "Unpin" : "Pin"}</button></form></div>
                  <p style={{ whiteSpace: "pre-wrap" }}>{n.body}</p>
                </div>
              </div>
            )) : <p className="muted" style={{ padding: "12px 0" }}>No private notes yet.</p>}</div>
          </div>
        </div>
      );
    }

    return (
      <div className="card">
        {viewSwitch}
        {canAdd ? (
          <form action={addNote.bind(null, a.id)} className="composer2">
            <Avatar name={me.name} role={me.role} />
            <div className="body">
              <div className="modeseg" role="radiogroup">
                <label style={{ cursor: "pointer" }}><input type="radio" name="kind" value="note" defaultChecked hidden /><Icon n="message" /> Note</label>
                <label style={{ cursor: "pointer" }}><input type="radio" name="kind" value="request" hidden /><Icon n="check" /> Request</label>
              </div>
              <div className="reqfields">
                <div className="field">
                  <label htmlFor="c-to">Assign to (for requests)</label>
                  <select id="c-to" name="assignee" defaultValue="">
                    <option value="">—</option>
                    {people.map((u) => (
                      <option key={u.id} value={u.id}>{u.name} · {roleOf(u.id)}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="c-due">Due (optional)</label>
                  <input type="date" id="c-due" name="due_on" />
                </div>
              </div>
              <div className="textwrap"><textarea id="c-text" name="body" required placeholder="Add a note for the team, or describe what you need and pick who should do it." /></div>
              <div className="row"><button className="btn primary sm">Post</button><span className="faint small">Visible to everyone on this account. Pick a request type and a person to assign it.</span></div>
            </div>
          </form>
        ) : null}
        <div className="filt">
          {([["all", "All"], ["open", "Open requests"], ["mine", "My requests"], ["notes", "Notes"]] as const).map(([k, l]) => (
            <Link key={k} href={href({ f: k })} className={`fbtn ${filter === k ? "on" : ""}`} style={{ textDecoration: "none" }}>{l}<span className="cnt">{counts[k]}</span></Link>
          ))}
        </div>
        {pinnedNotes.length ? (
          <div className="pinned pinned-notes"><h4><Icon n="pin" /> Pinned<Pill tone="accent" plain>{pinnedNotes.length}</Pill></h4><div className="timeline">{pinnedNotes.map(row)}</div></div>
        ) : null}
        {pinnedReqs.length ? (
          <div className="pinned"><h4>Open requests<Pill tone="warn" plain>{pinnedReqs.length}</Pill><span className="faint small" style={{ fontWeight: 400 }}>· sorted by due date</span></h4>{pinnedReqs.map(reqCard)}</div>
        ) : filter === "open" ? (
          <div className="empty" style={{ padding: 28 }}><Icon n="check" /><h4>No open requests</h4><p>Nothing is waiting on anyone for this account.</p></div>
        ) : null}
        {filter !== "open" ? (
          <div className="card-b" style={{ paddingTop: 4, paddingBottom: 4 }}>
            <div className="acc-group">{filter === "notes" ? "Notes" : "History"}</div>
            <div className="timeline">{history.length ? history.map(row) : <p className="muted" style={{ padding: "12px 0" }}>Nothing here yet.</p>}</div>
          </div>
        ) : null}
      </div>
    );
  }

  async function Changes({ a, canLogins, area }: { a: Account; canLogins: boolean; area: string }) {
    const [{ data: changes }, { data: reveals }] = await Promise.all([
      supabase.from("change_log").select("*, by_p:profiles(name, role)").eq("account_id", a.id).order("at", { ascending: false }).limit(300),
      canLogins ? supabase.from("login_reveals").select("*, user:profiles(name, role)").eq("account_id", a.id).order("at", { ascending: false }).limit(50) : Promise.resolve({ data: [] as never[] }),
    ]);
    const tone: Record<string, string> = { Details: "info", Contacts: "info", Status: "accent", Access: "ok", Login: "dark", Team: "warn", Approval: "bad", Reports: "muted", Account: "muted" };
    const all = changes ?? [];
    const list = all.filter((c) => area === "all" || c.area === area);
    type P = { name: string; role: Role } | null;
    return (
      <>
        <div className="card">
          <div className="card-h"><h3>Change log</h3><span className="muted small">{all.length} entries · visible to everyone on this account</span></div>
          <div className="filt">
            {[["all", "All"], ...CHANGE_AREAS.map((x) => [x, x])].map(([k, l]) => (
              <Link key={k} href={`/accounts/${a.id}?tab=changes&area=${k}`} className={`fbtn ${area === k ? "on" : ""}`} style={{ textDecoration: "none" }}>{l}<span className="cnt">{k === "all" ? all.length : all.filter((c) => c.area === k).length}</span></Link>
            ))}
          </div>
          {list.length ? (
            <div className="tablewrap">
              <table className="tbl compact changelog">
                <thead><tr><th>When</th><th>By</th><th>Area</th><th>Change</th></tr></thead>
                <tbody>
                  {list.map((c) => (
                    <tr key={c.id}>
                      <td className="nowrap mono">{fmtDateTime(c.at)}</td>
                      <td><Person name={(c.by_p as P)?.name} role={(c.by_p as P)?.role} size="sm" /></td>
                      <td><Pill tone={tone[c.area] ?? "muted"} plain>{c.area}</Pill></td>
                      <td><b>{c.text}</b>{c.from_value || c.to_value ? <span className="sub">{c.from_value ? <><s className="muted">{c.from_value}</s> → </> : null}<span>{c.to_value}</span></span> : null}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty icon="file" title="No changes yet" text="Edits to details, contacts, status and access will show up here." />
          )}
        </div>
        {canLogins ? (
          <div className="card">
            <div className="card-h"><h3>Logins opened</h3><span className="muted small">{reveals?.length ?? 0} entries · who opened, copied or revealed a stored login</span></div>
            {reveals?.length ? (
              <div className="tablewrap">
                <table className="tbl compact changelog">
                  <thead><tr><th>When</th><th>By</th><th>Login</th><th>Action</th></tr></thead>
                  <tbody>
                    {reveals.map((r) => (
                      <tr key={r.id}>
                        <td className="nowrap mono">{fmtDateTime(r.at)}</td>
                        <td><Person name={(r.user as P)?.name} role={(r.user as P)?.role} size="sm" /></td>
                        <td><b>{r.item_key}</b></td>
                        <td>{r.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="card-b muted small">Nobody has opened a stored login on this account yet.</div>
            )}
          </div>
        ) : null}
      </>
    );
  }
}
