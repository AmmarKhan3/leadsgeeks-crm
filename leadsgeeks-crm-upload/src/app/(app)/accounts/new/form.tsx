"use client";
import { useState, useTransition } from "react";
import { INDUSTRY_GROUPS, US_STATES, SERVICES, PLATFORMS, STATUSES, STATUS_HELP, BACKEND_SPECIALTIES, CHECKLIST_GROUPS, neededItems, checkLabel, SETUP_KEYS } from "@/lib/constants";
import type { Profile } from "@/lib/supabase/server";
import { createAccount } from "./actions";

const OWNERS: [string, string][] = [["us", "LeadsGeeks"], ["client", "Client"], ["agency", "Other"]];

export function NewAccountForm({ me, team }: { me: Profile; team: Profile[] }) {
  const [step, setStep] = useState(1);
  const [industry, setIndustry] = useState("");
  const [services, setServices] = useState<string[]>(["Local SEO", "GBP"]);
  const [platform, setPlatform] = useState("WordPress");
  const [owners, setOwners] = useState({ built_by: "us", hosted_by: "us", domain_by: "client" });
  const [checks, setChecks] = useState<Record<string, string>>({});
  const [backend, setBackend] = useState([{ user_id: "", specialty: "SEO" }]);
  const [busy, start] = useTransition();
  const [err, setErr] = useState("");
  const by = (r: string) => team.filter((u) => u.active && u.role === r);
  const needed = neededItems(services, platform);
  const defaultCheck = (k: string) => checks[k] ?? (k === "domain" && owners.domain_by === "us" ? "have" : k === "cms" && owners.built_by === "us" ? "have" : "pending");

  return (
    <form
      action={(fd) => {
        setErr("");
        start(async () => {
          try {
            await createAccount(fd);
          } catch (e) {
            setErr((e as Error).message);
          }
        });
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex gap-2 text-sm">
        {["Business & contact", "Services & website", "Team"].map((l, i) => (
          <button type="button" key={l} onClick={() => setStep(i + 1)} className={`px-3 h-8 rounded-full border ${step === i + 1 ? "bg-ink text-white border-ink" : "border-line text-fg-2"}`}>
            {i + 1}. {l}
          </button>
        ))}
      </div>
      {err ? <div className="banner bad">{err}</div> : null}

      {/* Step 1 (always mounted so values submit) */}
      <div className={`card card-b grid md:grid-cols-2 gap-3 ${step === 1 ? "" : "hidden"}`}>
        <div className="field md:col-span-2">
          <label>Business name *</label>
          <input name="business" required />
        </div>
        <div className="field">
          <label>Industry *</label>
          <select name="industry" required value={industry} onChange={(e) => setIndustry(e.target.value)}>
            <option value="">Pick one</option>
            {INDUSTRY_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.items.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        {industry === "Other (specify)" ? (
          <div className="field">
            <label>Which industry?</label>
            <input name="industry_other" required />
          </div>
        ) : (
          <div className="field">
            <label>Client since</label>
            <input name="client_since" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
          </div>
        )}
        <div className="field">
          <label>Business phone</label>
          <input name="phone" type="tel" />
        </div>
        <div className="field">
          <label>Business email</label>
          <input name="email" type="email" />
        </div>
        <div className="field md:col-span-2">
          <label>Street</label>
          <input name="street" />
        </div>
        <div className="field">
          <label>City *</label>
          <input name="city" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="field">
            <label>State *</label>
            <select name="state" required defaultValue="">
              <option value="">—</option>
              {US_STATES.map(([c, n]) => (
                <option key={c} value={c}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>ZIP</label>
            <input name="zip" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} />
          </div>
        </div>
        <div className="field">
          <label>Website</label>
          <input name="website" type="url" placeholder="https://" />
        </div>
        <div className="field">
          <label>Google Business Profile link</label>
          <input name="gbp_url" type="url" placeholder="https://maps.app.goo.gl/…" />
        </div>
        <div className="md:col-span-2 eyebrow mt-2">Primary contact</div>
        <div className="field">
          <label>Name *</label>
          <input name="contact_name" required />
        </div>
        <div className="field">
          <label>Title</label>
          <input name="contact_title" placeholder="Owner" />
        </div>
        <div className="field">
          <label>Phone</label>
          <input name="contact_phone" type="tel" />
        </div>
        <div className="field">
          <label>Email</label>
          <input name="contact_email" type="email" />
        </div>
      </div>

      {/* Step 2 */}
      <div className={`grid lg:grid-cols-[1.2fr_1fr] gap-4 items-start ${step === 2 ? "" : "hidden"}`}>
        <div className="card card-b flex flex-col gap-4">
          <div>
            <div className="font-semibold">Services for this client</div>
            <div className="text-xs text-fg-3 mb-2">Tick everything we handle for them.</div>
            <div className="flex flex-wrap gap-2">
              {SERVICES.map((s) => (
                <label key={s} className={`px-3 h-8 inline-flex items-center gap-2 rounded-full border cursor-pointer text-sm ${services.includes(s) ? "bg-accent-soft border-accent text-accent-deep" : "border-line"}`}>
                  <input type="checkbox" name="services" value={s} checked={services.includes(s)} onChange={(e) => setServices(e.target.checked ? [...services, s] : services.filter((x) => x !== s))} className="sr-only" />
                  {s}
                </label>
              ))}
            </div>
            <input name="service_other" placeholder="What else do we handle?" className="mt-2 h-9 px-3 rounded-[var(--radius)] border border-line bg-surface text-sm w-full" />
          </div>
          <div className="flex flex-col gap-2">
            {(["built_by", "hosted_by", "domain_by"] as const).map((k) => (
              <div key={k} className="flex items-center gap-3 flex-wrap">
                <span className="w-28 text-sm text-fg-2">{k === "built_by" ? "Built by" : k === "hosted_by" ? "Hosted by" : "Domain held by"}</span>
                <div className="inline-flex rounded-[var(--radius)] border border-line overflow-hidden">
                  {OWNERS.map(([v, l]) => (
                    <button type="button" key={v} onClick={() => setOwners({ ...owners, [k]: v })} className={`px-3 h-8 text-sm ${owners[k] === v ? "bg-ink text-white" : "bg-surface hover:bg-surface-2"}`}>
                      {k === "domain_by" && v === "agency" ? "Third party" : l}
                    </button>
                  ))}
                </div>
                <input type="hidden" name={k} value={owners[k]} />
                {owners[k] === "agency" ? <input name={`${k}_name`} placeholder="Who?" className="h-8 px-2 rounded-[var(--radius)] border border-line text-sm" /> : null}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="field">
              <label>Platform</label>
              <select name="platform" value={platform} onChange={(e) => setPlatform(e.target.value)}>
                {PLATFORMS.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Starting status</label>
              <select name="status" defaultValue="Signed">
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s} · {STATUS_HELP[s]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-h">
            <h3>What we&apos;ll need</h3>
            <span className="ml-auto text-xs text-fg-3">{needed.length} items</span>
          </div>
          <div className="card-b flex flex-col gap-3">
            {CHECKLIST_GROUPS.map((g) => {
              const items = needed.filter((i) => i.group === g.key);
              if (!items.length) return null;
              return (
                <div key={g.key}>
                  <div className="eyebrow mb-1">{g.label}</div>
                  {items.map((i) => {
                    const v = defaultCheck(i.key);
                    const setup = SETUP_KEYS.includes(i.key);
                    const opts: [string, string][] = setup ? [["have", "Set up"], ["pending", "Pending"], ["none", "Not needed"]] : [["have", "Have it"], ["requested", "Requested"], ["none", "Not needed"]];
                    return (
                      <div key={i.key} className="flex items-center gap-2 py-1.5 border-b border-line last:border-b-0">
                        <span className="flex-1 text-sm">{i.label}</span>
                        <div className="inline-flex rounded-[var(--radius)] border border-line overflow-hidden">
                          {opts.map(([ov, ol]) => (
                            <button type="button" key={ov} onClick={() => setChecks({ ...checks, [i.key]: ov })} className={`px-2 h-7 text-xs ${v === ov ? "bg-ink text-white" : "bg-surface hover:bg-surface-2"}`}>
                              {ol === "Have it" ? checkLabel(i.key, "have") : ol}
                            </button>
                          ))}
                        </div>
                        <input type="hidden" name={`check_${i.key}`} value={v} />
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Step 3 */}
      <div className={`card card-b grid md:grid-cols-3 gap-3 ${step === 3 ? "" : "hidden"}`}>
        <div className="field">
          <label>CS owner</label>
          {me.role === "cs" ? (
            <>
              <input value={me.name} disabled />
              <span className="hint">You&apos;ll be the CS owner. Admins and team leads can assign others.</span>
            </>
          ) : (
            <select name="cs_id" defaultValue="">
              <option value="">—</option>
              {[...by("cs"), ...by("lead"), ...by("admin")].map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="field">
          <label>Team lead {me.role === "cs" ? "*" : ""}</label>
          <select name="lead_id" defaultValue={me.role === "lead" ? me.id : ""} required={me.role === "cs"}>
            <option value="">—</option>
            {by("lead").map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          {me.role === "cs" ? <span className="hint">The team lead assigns the backend team.</span> : null}
        </div>
        <div className="field">
          <label>Sales rep</label>
          <select name="sales_id" defaultValue="">
            <option value="">—</option>
            {by("sales").map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
        {me.role !== "cs" ? (
          <div className="md:col-span-3">
            <div className="eyebrow mb-2">Backend team</div>
            {backend.map((r, i) => (
              <div key={i} className="flex gap-2 items-center mb-2">
                <select name="backend_user" value={r.user_id} onChange={(e) => setBackend(backend.map((x, j) => (j === i ? { ...x, user_id: e.target.value } : x)))} className="h-9 px-3 rounded-[var(--radius)] border border-line bg-surface text-sm flex-1">
                  <option value="">Pick a backend person</option>
                  {by("backend").map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <select name="backend_specialty" value={r.specialty} onChange={(e) => setBackend(backend.map((x, j) => (j === i ? { ...x, specialty: e.target.value } : x)))} className="h-9 px-3 rounded-[var(--radius)] border border-line bg-surface text-sm">
                  {BACKEND_SPECIALTIES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
                <button type="button" className="btn sm ghost" onClick={() => setBackend(backend.filter((_, j) => j !== i))}>
                  Remove
                </button>
              </div>
            ))}
            <button type="button" className="btn sm" onClick={() => setBackend([...backend, { user_id: "", specialty: "GBP" }])}>
              Add backend person
            </button>
          </div>
        ) : null}
        {me.role !== "admin" ? <div className="banner info md:col-span-3">An admin approves new accounts. Until then it stays visible to its team with a Pending banner.</div> : null}
      </div>

      <div className="flex gap-2 justify-end">
        {step > 1 ? (
          <button type="button" className="btn" onClick={() => setStep(step - 1)}>
            Back
          </button>
        ) : null}
        {step < 3 ? (
          <button type="button" className="btn primary" onClick={() => setStep(step + 1)}>
            Continue
          </button>
        ) : (
          <button className="btn primary" disabled={busy}>
            {busy ? "Creating…" : "Create account"}
          </button>
        )}
      </div>
    </form>
  );
}
