import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile, createClient } from "@/lib/supabase/server";
import { perms, canOpenLogins } from "@/lib/perms";
import { getAccount, getChecklist, getLoginIndex, listTeam } from "@/lib/data";
import { STATUSES, BILLING_METHODS, CHANGE_AREAS } from "@/lib/constants";
import { fmtDate, fmtDateTime, monthLabel, thisMonth, lastMonth } from "@/lib/format";
import { Person, StatusPill, Pill, Empty, Avatar } from "@/components/ui";
import { Money } from "@/components/money";
import { Checklist } from "./checklist";
import { TeamEditor, ReportLink, Confirm } from "./widgets";
import { addNote, addUpsell, decideApproval, markPaid, resubmit, saveBilling, setRequestDone, setStatus, togglePin, uploadReport } from "./actions";

type Tab = "overview" | "checklist" | "reports" | "billing" | "notes" | "changes";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const a = await getAccount((await params).id);
  return { title: a?.business ?? "Account" };
}

export default async function AccountPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: Tab; edit?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const me = (await getProfile())!;
  const p = perms(me.role);
  const a = await getAccount(id);
  if (!a) notFound();
  const tab: Tab = sp.tab ?? "overview";
  const supabase = await createClient();
  const canLogins = canOpenLogins(me, a);
  const ownerName = (k: string, name: string | null) => (k === "us" ? "LeadsGeeks" : k === "client" ? "Client" : name || "Other");
  const tabs: [Tab, string][] = [["overview", "Overview"], ["checklist", "Access checklist"], ["reports", "Reports"], ...(p.billing ? ([["billing", "Billing"]] as [Tab, string][]) : []), ["notes", "Notes & requests"], ["changes", "Change log"]];

  return (
    <div className="flex flex-col gap-5">
      <div className="text-xs text-fg-3">
        <Link href="/accounts" className="hover:underline">
          Accounts
        </Link>{" "}
        / {a.business}
      </div>

      {a.approval !== "approved" ? (
        <div className={`banner ${a.approval === "pending" ? "warn" : "bad"} items-center`}>
          <div className="flex-1">
            <b>{a.approval === "pending" ? "Pending approval" : "Rejected"}</b> · created {fmtDate(a.approval_requested_at ?? a.created_at)}
            {a.approval_reason ? ` · ${a.approval_reason}` : ""}
            <span className="block text-xs opacity-80">Not counted in alerts, billing or report tracking until an admin approves it.</span>
          </div>
          {p.approve && a.approval === "pending" ? (
            <div className="flex gap-2">
              <form action={decideApproval.bind(null, a.id, true, "")}>
                <button className="btn primary sm">Approve</button>
              </form>
              <Confirm label="Reject" prompt="Reason for rejecting (the creator sees this)" action={decideApproval.bind(null, a.id, false)} />
            </div>
          ) : null}
          {a.approval === "rejected" && (p.approve || a.approval_requested_by === me.id) ? (
            <form action={resubmit.bind(null, a.id)}>
              <button className="btn sm">Resubmit for approval</button>
            </form>
          ) : null}
        </div>
      ) : null}

      <div className="card card-b">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-60">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl">{a.business}</h2>
              {p.editAccount ? (
                <form action={async (fd) => { "use server"; await setStatus(a.id, String(fd.get("status"))); }}>
                  <select name="status" defaultValue={a.status} className="pill muted h-7 pr-6 cursor-pointer" onChange={undefined}>
                    {STATUSES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                  <button className="btn sm ml-1">Set</button>
                </form>
              ) : (
                <StatusPill status={a.status} />
              )}
            </div>
            <div className="text-fg-2 text-sm mt-1">
              {a.industry === "Other (specify)" ? a.industry_other : a.industry} · {a.city}, {a.state} · Client since {fmtDate(a.client_since)}
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              {a.website ? (
                <a className="btn sm" href={a.website} target="_blank" rel="noopener">
                  Website ↗
                </a>
              ) : null}
              {a.gbp_url ? (
                <a className="btn sm" href={a.gbp_url} target="_blank" rel="noopener">
                  Google Business Profile ↗
                </a>
              ) : null}
              {p.editAccount ? (
                <Link className="btn sm ghost" href={`/accounts/${a.id}/edit`}>
                  Edit details
                </Link>
              ) : null}
            </div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5 pt-5 border-t border-line">
          <div>
            <div className="eyebrow mb-1.5">CS owner</div>
            <Person name={a.cs?.name} />
          </div>
          <div>
            <div className="eyebrow mb-1.5">Backend team</div>
            {a.backend.length ? (
              <div className="flex flex-col gap-1.5">
                {a.backend.map((b) => (
                  <span key={b.user_id + b.specialty} className="inline-flex items-center gap-2">
                    <Avatar name={b.profile?.name ?? "?"} /> {b.profile?.name} <span className="eyebrow">{b.specialty}</span>
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-warn text-sm">Not assigned yet{a.lead?.name ? ` · waiting on ${a.lead.name.split(" ")[0]}` : ""}</span>
            )}
          </div>
          <div>
            <div className="eyebrow mb-1.5">Team lead</div>
            <Person name={a.lead?.name} />
          </div>
          <div>
            <div className="eyebrow mb-1.5">Sales rep</div>
            <Person name={a.sales?.name} />
            {p.reassign ? (
              <Link href={`/accounts/${a.id}?tab=overview&edit=team`} className="text-xs text-accent-deep font-semibold mt-1 inline-block">
                Reassign
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex gap-1 border-b border-line overflow-x-auto">
        {tabs.map(([k, l]) => (
          <Link key={k} href={`/accounts/${a.id}?tab=${k}`} className={`px-4 h-10 inline-flex items-center text-sm font-semibold whitespace-nowrap border-b-2 -mb-px ${tab === k ? "border-accent text-fg" : "border-transparent text-fg-2 hover:text-fg"}`}>
            {l}
          </Link>
        ))}
      </div>

      {tab === "overview" ? <Overview a={a} ownerName={ownerName} editTeam={sp.edit === "team" && p.reassign} /> : null}
      {tab === "checklist" ? <Checklist accountId={a.id} rows={await getChecklist(a.id)} logins={canLogins ? await getLoginIndex(a.id) : await getLoginIndex(a.id)} canEdit={p.editChecklist} canLogins={canLogins} website={a.website} /> : null}
      {tab === "reports" ? <Reports a={a} canUpload={p.upload && a.approval === "approved" && (me.role === "admin" || a.backend.some((b) => b.user_id === me.id))} /> : null}
      {tab === "billing" && p.billing ? <Billing a={a} /> : null}
      {tab === "notes" ? <Notes a={a} meId={me.id} canAdd={p.addNote} /> : null}
      {tab === "changes" ? <Changes a={a} canLogins={canLogins} /> : null}
    </div>
  );

  // ------------------------------------------------------------ tabs
  async function Overview({ a, ownerName, editTeam }: { a: NonNullable<Awaited<ReturnType<typeof getAccount>>>; ownerName: (k: string, n: string | null) => string; editTeam: boolean }) {
    const team = editTeam ? await listTeam() : [];
    const primary = a.contacts.find((c) => c.is_primary) ?? a.contacts[0];
    return (
      <div className="grid lg:grid-cols-2 gap-4 items-start">
        {editTeam ? (
          <div className="lg:col-span-2">
            <TeamEditor accountId={a.id} team={team} csId={a.cs_id} leadId={a.lead_id} salesId={a.sales_id} backend={a.backend.map((b) => ({ user_id: b.user_id, specialty: b.specialty }))} />
          </div>
        ) : null}
        <div className="card">
          <div className="card-h">
            <h3>Business</h3>
          </div>
          <dl className="card-b grid grid-cols-[120px_1fr] gap-y-2 text-sm">
            <dt className="text-fg-3">Phone</dt>
            <dd>{a.phone || "—"}</dd>
            <dt className="text-fg-3">Email</dt>
            <dd>{a.email || "—"}</dd>
            <dt className="text-fg-3">Address</dt>
            <dd>
              {a.street ? `${a.street}, ` : ""}
              {a.city}, {a.state} {a.zip}
            </dd>
            <dt className="text-fg-3">Website</dt>
            <dd className="truncate">{a.website || "—"}</dd>
            <dt className="text-fg-3">Platform</dt>
            <dd>{a.platform}</dd>
            <dt className="text-fg-3">Built by</dt>
            <dd>{ownerName(a.built_by, a.built_by_name)}</dd>
            <dt className="text-fg-3">Hosted by</dt>
            <dd>{ownerName(a.hosted_by, a.hosted_by_name)}</dd>
            <dt className="text-fg-3">Domain held by</dt>
            <dd>{ownerName(a.domain_by, a.domain_by_name)}</dd>
          </dl>
        </div>
        <div className="flex flex-col gap-4">
          <div className="card">
            <div className="card-h">
              <h3>Contacts</h3>
            </div>
            {a.contacts.length ? (
              <ul className="divide-y divide-line">
                {a.contacts.map((c) => (
                  <li key={c.id} className="px-5 py-3 flex items-center gap-3">
                    <Avatar name={c.name} />
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold">
                        {c.name} {c.is_primary ? <Pill tone="accent">Primary</Pill> : null}
                      </div>
                      <div className="text-xs text-fg-3">
                        {c.title}
                        {c.phone ? ` · ${c.phone}` : ""}
                        {c.email ? ` · ${c.email}` : ""}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="No contacts yet" text={primary ? "" : "Add the owner or office manager from Edit details."} />
            )}
          </div>
          <div className="card">
            <div className="card-h">
              <h3>Services for this client</h3>
            </div>
            <div className="card-b flex gap-1.5 flex-wrap">
              {a.services.map((s) => (
                <Pill key={s} tone="muted">
                  {s}
                </Pill>
              ))}
              {a.service_other ? <Pill tone="muted">{a.service_other}</Pill> : null}
              {!a.services.length ? <span className="text-fg-3 text-sm">None recorded</span> : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  async function Reports({ a, canUpload }: { a: NonNullable<Awaited<ReturnType<typeof getAccount>>>; canUpload: boolean }) {
    const { data: reports } = await supabase.from("reports").select("id, month, file_path, file_name, uploaded_at, uploader:profiles(name)").eq("account_id", a.id).order("month", { ascending: false });
    const lm = lastMonth();
    const missing = ["Active", "Past due"].includes(a.status) && a.approval === "approved" && !(reports ?? []).some((r) => r.month.startsWith(lm));
    return (
      <div className="flex flex-col gap-4">
        {missing ? (
          <div className="banner warn">
            {monthLabel(lm)} report has not been uploaded yet.{a.backend.length ? ` Waiting on ${a.backend.map((b) => b.profile?.name?.split(" ")[0]).join(", ")}.` : ""}
          </div>
        ) : null}
        {canUpload ? (
          <form action={uploadReport.bind(null, a.id)} className="card card-b flex gap-3 items-end flex-wrap">
            <div className="field">
              <label>Month covered</label>
              <input type="month" name="month" defaultValue={lm} max={thisMonth()} required />
            </div>
            <div className="field flex-1 min-w-60">
              <label>PDF</label>
              <input type="file" name="file" accept="application/pdf" required className="pt-1.5" />
            </div>
            <button className="btn primary">Upload report</button>
          </form>
        ) : null}
        <div className="card">
          <div className="card-h">
            <h3>Monthly reports</h3>
            <span className="ml-auto text-xs text-fg-3">{reports?.length ?? 0} uploaded</span>
          </div>
          {reports?.length ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Uploaded by</th>
                  <th>Uploaded</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold">{monthLabel(r.month)}</td>
                    <td>
                      <Person name={(r.uploader as unknown as { name: string } | null)?.name} size="sm" />
                    </td>
                    <td className="text-fg-2">{fmtDate(r.uploaded_at)}</td>
                    <td className="text-right">
                      <ReportLink path={r.file_path} name={r.file_name} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty title="No reports yet" text="The backend team uploads one PDF per month." />
          )}
        </div>
      </div>
    );
  }

  async function Billing({ a }: { a: NonNullable<Awaited<ReturnType<typeof getAccount>>> }) {
    const [{ data: b }, { data: ups }, { data: pays }] = await Promise.all([
      supabase.from("billing").select("*").eq("account_id", a.id).maybeSingle(),
      supabase.from("upsells").select("*, seller:profiles(name)").eq("account_id", a.id).order("sold_on", { ascending: false }),
      supabase.from("payments").select("*").eq("account_id", a.id).order("month", { ascending: false }).limit(12),
    ]);
    const tm = thisMonth();
    const paidThisMonth = (pays ?? []).some((p) => p.month.startsWith(tm));
    const due = b ? new Date(new Date().getFullYear(), new Date().getMonth(), b.billing_day) : null;
    const overdue = !!b && !paidThisMonth && !!due && due < new Date() && ["Active", "Past due"].includes(a.status);
    return (
      <div className="grid lg:grid-cols-[1fr_1.3fr] gap-4 items-start">
        <div className="flex flex-col gap-4">
          <form action={saveBilling.bind(null, a.id)} className="card">
            <div className="card-h">
              <h3>Monthly charge</h3>
              {overdue ? <Pill tone="bad">Overdue</Pill> : paidThisMonth ? <Pill tone="ok">Paid this month</Pill> : null}
            </div>
            <div className="card-b grid grid-cols-2 gap-3">
              <div className="col-span-2 text-3xl font-semibold">{b ? <Money value={Number(b.mrr)} /> : <span className="text-fg-3 text-base">No billing set up</span>}</div>
              <div className="field">
                <label>MRC (per month)</label>
                <input name="mrr" type="number" min={0} step={1} defaultValue={b?.mrr ?? ""} required />
              </div>
              <div className="field">
                <label>Billing day</label>
                <input name="billing_day" type="number" min={1} max={28} defaultValue={b?.billing_day ?? 1} required />
              </div>
              <div className="field">
                <label>Method</label>
                <select name="method" defaultValue={b?.method ?? "Card"}>
                  {BILLING_METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Billing since</label>
                <input name="started_on" type="date" defaultValue={b?.started_on ?? a.client_since} />
              </div>
              <div className="col-span-2 flex justify-end">
                <button className="btn primary sm">Save billing</button>
              </div>
            </div>
          </form>
          <form action={markPaid.bind(null, a.id)} className="card">
            <div className="card-h">
              <h3>Mark collected</h3>
            </div>
            <div className="card-b flex gap-3 items-end flex-wrap">
              <div className="field">
                <label>Month</label>
                <input type="month" name="month" defaultValue={tm} required />
              </div>
              <div className="field">
                <label>Amount</label>
                <input type="number" name="amount" min={0} step={1} defaultValue={b?.mrr ?? 0} required />
              </div>
              <div className="field flex-1 min-w-40">
                <label>Note</label>
                <input name="note" placeholder="optional" />
              </div>
              <button className="btn sm">Mark collected</button>
            </div>
            {pays?.length ? (
              <ul className="divide-y divide-line text-sm">
                {pays.map((p) => (
                  <li key={p.id} className="px-5 py-2 flex justify-between">
                    <span>{monthLabel(p.month)}</span>
                    <span className="text-fg-2">
                      <Money value={Number(p.amount)} /> · {fmtDate(p.collected_on)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </form>
        </div>
        <div className="card">
          <div className="card-h">
            <h3>Upsells</h3>
          </div>
          <form action={addUpsell.bind(null, a.id)} className="card-b border-b border-line grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
            <div className="field col-span-2">
              <label>What</label>
              <input name="name" placeholder="e.g. Reputation add-on" required />
            </div>
            <div className="field">
              <label>Amount</label>
              <input name="amount" type="number" min={0} step={1} required />
            </div>
            <div className="field">
              <label>Type</label>
              <select name="recurring" defaultValue="0">
                <option value="0">One-time</option>
                <option value="1">Monthly</option>
              </select>
            </div>
            <div className="field">
              <label>Date</label>
              <input name="sold_on" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <button className="btn sm col-span-2 md:col-span-1 justify-self-start">Add upsell</button>
          </form>
          {ups?.length ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>What</th>
                  <th>Amount</th>
                  <th>Type</th>
                  <th>Date</th>
                  <th>Sold by</th>
                </tr>
              </thead>
              <tbody>
                {ups.map((u) => (
                  <tr key={u.id}>
                    <td className="font-semibold">{u.name}</td>
                    <td>
                      <Money value={Number(u.amount)} />
                    </td>
                    <td>{u.recurring ? "Monthly" : "One-time"}</td>
                    <td className="text-fg-2">{fmtDate(u.sold_on)}</td>
                    <td className="text-fg-2">{(u.seller as unknown as { name: string } | null)?.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty title="No upsells yet" />
          )}
        </div>
      </div>
    );
  }

  async function Notes({ a, meId, canAdd }: { a: NonNullable<Awaited<ReturnType<typeof getAccount>>>; meId: string; canAdd: boolean }) {
    const [{ data: notes }, team] = await Promise.all([supabase.from("notes").select("*, author_p:profiles!notes_author_fkey(name), assignee_p:profiles!notes_assignee_fkey(name)").eq("account_id", a.id).order("created_at", { ascending: false }), listTeam()]);
    type N = NonNullable<typeof notes>[number] & { author_p: { name: string } | null; assignee_p: { name: string } | null };
    const all = (notes ?? []) as N[];
    const openReqs = all.filter((n) => n.kind === "request" && n.status === "open" && !n.is_private).sort((x, y) => (x.due_on ?? "9").localeCompare(y.due_on ?? "9"));
    const rest = all.filter((n) => !openReqs.includes(n)).sort((x, y) => Number(y.pinned) - Number(x.pinned));
    const people = team.filter((u) => u.active && (u.id === a.cs_id || u.id === a.lead_id || a.backend.some((b) => b.user_id === u.id) || u.role === "admin"));
    return (
      <div className="flex flex-col gap-4">
        {canAdd ? (
          <form action={addNote.bind(null, a.id)} className="card card-b flex flex-col gap-3">
            <div className="flex gap-4 text-sm">
              <label className="inline-flex items-center gap-1.5">
                <input type="radio" name="kind" value="note" defaultChecked /> Note
              </label>
              <label className="inline-flex items-center gap-1.5">
                <input type="radio" name="kind" value="request" /> Request
              </label>
              <label className="inline-flex items-center gap-1.5 ml-auto text-fg-2">
                <input type="checkbox" name="is_private" value="1" /> Private (only you can see it)
              </label>
            </div>
            <textarea name="body" required placeholder="Write a note, or describe what you need. Mention people with @Name." className="min-h-20 px-3 py-2 rounded-[var(--radius)] border border-line bg-surface text-sm outline-none focus:border-accent" />
            <div className="flex gap-3 items-end flex-wrap">
              <div className="field">
                <label>Assign to (requests)</label>
                <select name="assignee" defaultValue="">
                  <option value="">—</option>
                  {people.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Due</label>
                <input type="date" name="due_on" />
              </div>
              <div className="flex-1" />
              <button className="btn primary">Post</button>
            </div>
          </form>
        ) : null}
        {openReqs.length ? (
          <div className="card">
            <div className="card-h">
              <h3>Open requests</h3>
              <span className="ml-auto text-xs text-fg-3">{openReqs.length}</span>
            </div>
            <ul className="divide-y divide-line">
              {openReqs.map((n) => (
                <li key={n.id} className="px-5 py-3 flex gap-3 items-start">
                  <Avatar name={n.author_p?.name ?? "?"} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-fg-3">
                      {n.author_p?.name?.split(" ")[0]} → {n.assignee_p?.name?.split(" ")[0] ?? "anyone"} · {fmtDate(n.created_at)}
                      {n.due_on ? <span className={`ml-2 pill ${new Date(n.due_on) < new Date() ? "bad" : "warn"}`}>Due {fmtDate(n.due_on)}</span> : null}
                    </div>
                    <div className="whitespace-pre-wrap">{n.body}</div>
                  </div>
                  {canAdd ? (
                    <form action={setRequestDone.bind(null, a.id, n.id, true)}>
                      <button className={`btn sm ${n.assignee === meId ? "primary" : ""}`}>Mark done</button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <div className="card">
          <div className="card-h">
            <h3>History</h3>
          </div>
          {rest.length ? (
            <ul className="divide-y divide-line">
              {rest.map((n) => (
                <li key={n.id} className={`px-5 py-3 flex gap-3 items-start ${n.pinned ? "bg-accent-soft/40" : ""}`}>
                  <Avatar name={n.author_p?.name ?? "?"} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-fg-3 flex gap-2 items-center flex-wrap">
                      <b className="text-fg">{n.author_p?.name}</b> {fmtDateTime(n.created_at)}
                      {n.is_private ? <Pill tone="muted">Private</Pill> : null}
                      {n.kind === "request" ? <Pill tone="ok">Done{n.done_at ? ` ${fmtDate(n.done_at)}` : ""}</Pill> : null}
                      {n.pinned ? <Pill tone="accent">Pinned</Pill> : null}
                    </div>
                    <div className="whitespace-pre-wrap">{n.body}</div>
                  </div>
                  {canAdd ? (
                    <form action={togglePin.bind(null, a.id, n.id, !n.pinned)}>
                      <button className="btn sm ghost text-fg-3">{n.pinned ? "Unpin" : "Pin"}</button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <Empty title="No notes yet" />
          )}
        </div>
      </div>
    );
  }

  async function Changes({ a, canLogins }: { a: NonNullable<Awaited<ReturnType<typeof getAccount>>>; canLogins: boolean }) {
    const [{ data: changes }, { data: reveals }] = await Promise.all([
      supabase.from("change_log").select("*, by_p:profiles(name)").eq("account_id", a.id).order("at", { ascending: false }).limit(200),
      canLogins ? supabase.from("login_reveals").select("*, user:profiles(name)").eq("account_id", a.id).order("at", { ascending: false }).limit(50) : Promise.resolve({ data: [] as never[] }),
    ]);
    const tone: Record<string, string> = { Details: "info", Contacts: "info", Status: "accent", Access: "ok", Login: "muted", Team: "warn", Approval: "bad", Reports: "muted", Account: "muted" };
    return (
      <div className="flex flex-col gap-4">
        <div className="card">
          <div className="card-h">
            <h3>Change log</h3>
            <span className="ml-auto text-xs text-fg-3">{changes?.length ?? 0} entries · {CHANGE_AREAS.join(", ")}</span>
          </div>
          {changes?.length ? (
            <table className="tbl">
              <thead>
                <tr>
                  <th>When</th>
                  <th>By</th>
                  <th>Area</th>
                  <th>Change</th>
                </tr>
              </thead>
              <tbody>
                {changes.map((c) => (
                  <tr key={c.id}>
                    <td className="font-mono text-xs whitespace-nowrap">{fmtDateTime(c.at)}</td>
                    <td>
                      <Person name={(c.by_p as unknown as { name: string } | null)?.name} size="sm" />
                    </td>
                    <td>
                      <Pill tone={tone[c.area] ?? "muted"}>{c.area}</Pill>
                    </td>
                    <td>
                      <b>{c.text}</b>
                      {c.from_value || c.to_value ? (
                        <div className="text-xs text-fg-2">
                          {c.from_value ? <s className="text-fg-3">{c.from_value}</s> : null}
                          {c.from_value && c.to_value ? " → " : ""}
                          {c.to_value}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty title="No changes yet" />
          )}
        </div>
        {canLogins ? (
          <div className="card">
            <div className="card-h">
              <h3>Logins opened</h3>
              <span className="ml-auto text-xs text-fg-3">who opened, copied or revealed a stored login</span>
            </div>
            {reveals?.length ? (
              <table className="tbl">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>By</th>
                    <th>Login</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reveals.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono text-xs whitespace-nowrap">{fmtDateTime(r.at)}</td>
                      <td>
                        <Person name={(r.user as unknown as { name: string } | null)?.name} size="sm" />
                      </td>
                      <td className="font-semibold">{r.item_key}</td>
                      <td>{r.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty title="Nobody has opened a stored login on this account yet." />
            )}
          </div>
        ) : null}
      </div>
    );
  }
}
