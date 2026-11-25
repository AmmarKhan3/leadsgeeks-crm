"use client";
import { useState, useTransition } from "react";
import { BACKEND_SPECIALTIES, BILLING_METHODS } from "@/lib/constants";
import { monthLabel, thisMonth, lastMonth, fmtDate } from "@/lib/format";
import type { Profile } from "@/lib/supabase/server";
import { Icon } from "@/components/icons";
import { Modal, ModalForm } from "@/components/modal";
import { reportUrl, saveTeam, saveBilling, markPaid, addUpsell, uploadReport } from "./actions";

/** Reassign owners: the prototype's modal, saving through saveTeam. */
export function ReassignButton({ accountId, team, csId, leadId, salesId, backend, label, primary, autoOpen }: { accountId: string; team: Profile[]; csId: string | null; leadId: string | null; salesId: string | null; backend: { user_id: string; specialty: string }[]; label?: string; primary?: boolean; autoOpen?: boolean }) {
  const [open, setOpen] = useState(!!autoOpen);
  const [rows, setRows] = useState(backend.length ? backend : [{ user_id: "", specialty: "SEO" }]);
  const [busy, start] = useTransition();
  const by = (r: string) => team.filter((u) => u.active && u.role === r);
  const nextSpec = () => BACKEND_SPECIALTIES.find((s) => !rows.some((r) => r.specialty === s)) ?? "Ads";
  return (
    <>
      <button type="button" className={`btn sm ${primary ? "primary" : ""}`} onClick={() => setOpen(true)}>
        <Icon n="users" /> {label ?? "Reassign"}
      </button>
      {open ? (
        <ModalForm title="Reassign owners" onClose={() => setOpen(false)} submitLabel="Save" busy={busy} action={(fd) => start(async () => { await saveTeam(accountId, fd); setOpen(false); })}>
          <div className="field">
            <label htmlFor="m-cs">Contact owner (Customer Success)</label>
            <select id="m-cs" name="cs_id" defaultValue={csId ?? ""}>
              <option value="">None</option>
              {[...by("cs"), ...by("lead"), ...by("admin")].map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="m-lead">Team lead</label>
            <select id="m-lead" name="lead_id" defaultValue={leadId ?? ""}>
              <option value="">None</option>
              {by("lead").map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Backend team</label>
            <BackendRows rows={rows} setRows={setRows} people={by("backend")} />
            <span className="hint">One row per person. The SEO row is the primary owner.</span>
          </div>
          <div className="field">
            <label htmlFor="m-sales">Sales rep</label>
            <select id="m-sales" name="sales_id" defaultValue={salesId ?? ""}>
              <option value="">None</option>
              {by("sales").map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>
          <div className="banner info">
            <Icon n="info" />
            <div className="small">New team members get an in-app notification and a Slack post. Anyone removed loses access to this account unless they are a lead or admin.</div>
          </div>
          <button type="button" hidden onClick={() => setRows([...rows, { user_id: "", specialty: nextSpec() }])} />
        </ModalForm>
      ) : null}
    </>
  );
}

/** Rows of backend person + specialty, posting as backend_user[] / backend_specialty[]. */
export function BackendRows({ rows, setRows, people }: { rows: { user_id: string; specialty: string }[]; setRows: (r: { user_id: string; specialty: string }[]) => void; people: Profile[] }) {
  const nextSpec = () => BACKEND_SPECIALTIES.find((s) => !rows.some((r) => r.specialty === s)) ?? "Ads";
  return (
    <div>
      <div className="be-rows">
        {rows.length ? (
          rows.map((r, i) => (
            <div key={i} className="be-row">
              <select name="backend_user" value={r.user_id} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, user_id: e.target.value } : x)))} aria-label="Backend person">
                <option value="">Choose…</option>
                {people.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
              <select name="backend_specialty" value={r.specialty} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, specialty: e.target.value } : x)))} aria-label="Specialty">
                {BACKEND_SPECIALTIES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <button type="button" className="x" onClick={() => setRows(rows.filter((_, j) => j !== i))} title="Remove">
                <Icon n="x" />
              </button>
            </div>
          ))
        ) : (
          <span className="muted small">No backend person yet.</span>
        )}
      </div>
      <button type="button" className="btn sm" style={{ marginTop: 8 }} onClick={() => setRows([...rows, { user_id: "", specialty: nextSpec() }])}>
        <Icon n="plus" /> Add backend person
      </button>
    </div>
  );
}

export function ReportLink({ path, name }: { path: string; name: string }) {
  const [busy, start] = useTransition();
  return (
    <button className="btn sm ghost" disabled={busy} onClick={() => start(async () => { const url = await reportUrl(path); window.open(url, "_blank", "noopener"); })} title={name} type="button">
      <Icon n="eye" /> {busy ? "Opening…" : "View"}
    </button>
  );
}

export function UploadReportButton({ accountId, csName, missingMonth }: { accountId: string; csName?: string | null; missingMonth?: string | null }) {
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const [file, setFile] = useState("");
  const months: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - 1 - i);
    months.push(d.toISOString().slice(0, 7));
  }
  return (
    <>
      <button type="button" className="btn primary sm" onClick={() => setOpen(true)}>
        <Icon n="upload" /> Upload report
      </button>
      {open ? (
        <ModalForm title="Upload monthly report" onClose={() => setOpen(false)} submitLabel={<><Icon n="upload" /> Upload</>} busy={busy} action={(fd) => start(async () => { await uploadReport(accountId, fd); setOpen(false); })}>
          <div className="field">
            <label htmlFor="m-month">Report covers</label>
            <select id="m-month" name="month" defaultValue={missingMonth ?? months[0]}>
              {months.map((m) => (
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>File</label>
            <label className="dropzone" htmlFor="m-file">
              <Icon n="file" />
              <div>{file ? <b>{file}</b> : <><b>Choose a PDF</b> or drop it here</>}</div>
              <input type="file" id="m-file" name="file" accept="application/pdf" required onChange={(e) => setFile(e.target.files?.[0]?.name ?? "")} />
            </label>
          </div>
          <div className="banner info">
            <Icon n="info" />
            <div className="small">{csName ? `${csName} (CS owner) will be notified in-app and on Slack.` : "The CS owner will be notified in-app and on Slack."}</div>
          </div>
        </ModalForm>
      ) : null}
    </>
  );
}

type BillingRow = { mrr: number; billing_day: number; method: string; started_on: string | null } | null;

export function EditBillingButton({ accountId, billing, clientSince }: { accountId: string; billing: BillingRow; clientSince: string }) {
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  return (
    <>
      <button type="button" className={`btn sm ${billing ? "" : "primary"}`} onClick={() => setOpen(true)}>
        <Icon n="edit" /> {billing ? "Edit" : "Set up billing"}
      </button>
      {open ? (
        <ModalForm title="Edit billing" onClose={() => setOpen(false)} submitLabel="Save" busy={busy} action={(fd) => start(async () => { await saveBilling(accountId, fd); setOpen(false); })}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="m-mrr">Monthly recurring charge ($)</label>
              <input type="number" id="m-mrr" name="mrr" defaultValue={billing?.mrr ?? ""} min={0} step={1} required />
            </div>
            <div className="field">
              <label htmlFor="m-day">Billing day of month</label>
              <input type="number" id="m-day" name="billing_day" defaultValue={billing?.billing_day ?? 1} min={1} max={28} required />
            </div>
            <div className="field">
              <label htmlFor="m-method">Billing method</label>
              <select id="m-method" name="method" defaultValue={billing?.method ?? "Card"}>
                {BILLING_METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="m-start">Client since</label>
              <input type="date" id="m-start" name="started_on" defaultValue={billing?.started_on ?? clientSince} />
            </div>
            <div className="field span2 hint">Billing is month to month: the charge is due on the billing day every month. There is no contract term or renewal date.</div>
          </div>
        </ModalForm>
      ) : null}
    </>
  );
}

export function LogPaymentButton({ accountId, amount, method, paidMonths, primary, meName }: { accountId: string; amount: number; method: string; paidMonths: string[]; primary?: boolean; meName: string }) {
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const months: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  const firstOpen = [...months].reverse().find((m) => !paidMonths.includes(m)) ?? thisMonth();
  return (
    <>
      <button type="button" className={`btn sm ${primary ? "primary" : ""}`} onClick={() => setOpen(true)}>
        <Icon n="plus" /> Log payment
      </button>
      {open ? (
        <ModalForm title="Log payment" onClose={() => setOpen(false)} submitLabel={<><Icon n="check" /> Mark collected</>} busy={busy} action={(fd) => start(async () => { await markPaid(accountId, fd); setOpen(false); })}>
          <div className="form-grid">
            <div className="field span2">
              <label htmlFor="m-pmonth">Month covered</label>
              <select id="m-pmonth" name="month" defaultValue={firstOpen}>
                {months.map((m) => (
                  <option key={m} value={m}>{monthLabel(m)}{paidMonths.includes(m) ? " · already logged" : ""}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="m-pamount">Amount received ($)</label>
              <input type="number" id="m-pamount" name="amount" defaultValue={amount} min={0} step={1} required />
            </div>
            <div className="field">
              <label htmlFor="m-pdate">Date received</label>
              <input type="date" id="m-pdate" name="collected_on" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="field">
              <label htmlFor="m-pmethod">Method</label>
              <select id="m-pmethod" name="method" defaultValue={method}>
                {BILLING_METHODS.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="m-pnote">Note</label>
              <input type="text" id="m-pnote" name="note" placeholder="Partial payment, late fee waived, check #…" />
            </div>
            <div className="banner info span2">
              <Icon n="info" />
              <div className="small">Logged as collected by {meName}. If a payment for that month already exists it will be replaced.</div>
            </div>
          </div>
        </ModalForm>
      ) : null}
    </>
  );
}

export function AddUpsellButton({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  return (
    <>
      <button type="button" className="btn primary sm" onClick={() => setOpen(true)}>
        <Icon n="plus" /> Add upsell
      </button>
      {open ? (
        <ModalForm title="Add upsell" onClose={() => setOpen(false)} submitLabel="Add upsell" busy={busy} action={(fd) => start(async () => { await addUpsell(accountId, fd); setOpen(false); })}>
          <div className="form-grid">
            <div className="field span2">
              <label htmlFor="m-uname">What was sold</label>
              <input type="text" id="m-uname" name="name" placeholder="e.g. Google Ads management, Website redesign" required />
            </div>
            <div className="field">
              <label htmlFor="m-uamount">Amount ($)</label>
              <input type="number" id="m-uamount" name="amount" min={0} step={1} placeholder="0" required />
            </div>
            <div className="field">
              <label htmlFor="m-ukind">Type</label>
              <select id="m-ukind" name="recurring" defaultValue="1">
                <option value="1">Recurring (adds to MRR)</option>
                <option value="0">One-time</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="m-udate">Date sold</label>
              <input type="date" id="m-udate" name="sold_on" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
          </div>
        </ModalForm>
      ) : null}
    </>
  );
}

export function Confirm({ label, prompt, action, className, icon }: { label: string; prompt: string; action: (reason: string) => Promise<void>; className?: string; icon?: string }) {
  const [busy, start] = useTransition();
  return (
    <button
      className={className ?? "btn sm"}
      disabled={busy}
      type="button"
      onClick={() => {
        const r = window.prompt(prompt);
        if (r === null) return;
        start(() => action(r));
      }}
    >
      {icon ? <Icon n={icon} /> : null}
      {label}
    </button>
  );
}

/** Small client wrapper so a server page can show a modal with arbitrary content behind a button. */
export function ModalButton({ label, title, className, children, icon }: { label: React.ReactNode; title: string; className?: string; children: React.ReactNode; icon?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className ?? "btn sm"} onClick={() => setOpen(true)}>
        {icon ? <Icon n={icon} /> : null}
        {label}
      </button>
      {open ? (
        <Modal title={title} onClose={() => setOpen(false)}>
          {children}
        </Modal>
      ) : null}
    </>
  );
}

export { fmtDate, lastMonth };
