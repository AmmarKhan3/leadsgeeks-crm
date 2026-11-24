"use client";
import { useState, useTransition } from "react";
import { BACKEND_SPECIALTIES } from "@/lib/constants";
import type { Profile } from "@/lib/supabase/server";
import { reportUrl, saveTeam } from "./actions";

export function TeamEditor({ accountId, team, csId, leadId, salesId, backend }: { accountId: string; team: Profile[]; csId: string | null; leadId: string | null; salesId: string | null; backend: { user_id: string; specialty: string }[] }) {
  const [rows, setRows] = useState(backend.length ? backend : [{ user_id: "", specialty: "SEO" }]);
  const [busy, start] = useTransition();
  const by = (r: string) => team.filter((u) => u.active && u.role === r);
  return (
    <form action={(fd) => start(() => saveTeam(accountId, fd))} className="card">
      <div className="card-h">
        <h3>Reassign team</h3>
        <span className="ml-auto text-xs text-fg-3">Admins and team leads only</span>
      </div>
      <div className="card-b grid md:grid-cols-3 gap-3">
        <div className="field">
          <label>CS owner</label>
          <select name="cs_id" defaultValue={csId ?? ""}>
            <option value="">—</option>
            {[...by("cs"), ...by("lead"), ...by("admin")].map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Team lead</label>
          <select name="lead_id" defaultValue={leadId ?? ""}>
            <option value="">—</option>
            {by("lead").map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Sales rep</label>
          <select name="sales_id" defaultValue={salesId ?? ""}>
            <option value="">—</option>
            {by("sales").map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-3">
          <div className="eyebrow mb-2">Backend team</div>
          <div className="flex flex-col gap-2">
            {rows.map((r, i) => (
              <div key={i} className="flex gap-2 items-center">
                <select name="backend_user" value={r.user_id} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, user_id: e.target.value } : x)))} className="h-9 px-3 rounded-[var(--radius)] border border-line bg-surface text-sm flex-1">
                  <option value="">Pick a backend person</option>
                  {by("backend").map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <select name="backend_specialty" value={r.specialty} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, specialty: e.target.value } : x)))} className="h-9 px-3 rounded-[var(--radius)] border border-line bg-surface text-sm">
                  {BACKEND_SPECIALTIES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <button type="button" className="btn sm ghost" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn sm mt-2" onClick={() => setRows([...rows, { user_id: "", specialty: "GBP" }])}>
            Add backend person
          </button>
        </div>
      </div>
      <div className="px-5 py-3 border-t border-line flex justify-end gap-2">
        <a href={`/accounts/${accountId}`} className="btn">
          Cancel
        </a>
        <button className="btn primary" disabled={busy}>
          {busy ? "Saving…" : "Save team"}
        </button>
      </div>
    </form>
  );
}

export function ReportLink({ path, name }: { path: string; name: string }) {
  const [busy, start] = useTransition();
  return (
    <button className="btn sm" disabled={busy} onClick={() => start(async () => { const url = await reportUrl(path); window.open(url, "_blank", "noopener"); })} title={name}>
      {busy ? "Opening…" : "Open PDF"}
    </button>
  );
}

export function Confirm({ label, prompt, action }: { label: string; prompt: string; action: (reason: string) => Promise<void> }) {
  const [busy, start] = useTransition();
  return (
    <button
      className="btn sm"
      disabled={busy}
      onClick={() => {
        const r = window.prompt(prompt);
        if (r === null) return;
        start(() => action(r));
      }}
    >
      {label}
    </button>
  );
}
