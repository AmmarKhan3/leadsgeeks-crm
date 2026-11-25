"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { INDUSTRY_GROUPS, INDUSTRIES, US_STATES, SERVICES, PLATFORMS, STATUSES, STATUS_HELP, CHECKLIST_GROUPS, ACCESS_NEEDS, neededItems, SETUP_KEYS } from "@/lib/constants";
import type { Profile } from "@/lib/supabase/server";
import { Icon } from "@/components/icons";
import { BackendRows } from "@/app/(app)/accounts/[id]/widgets";
import { createAccount } from "./actions";

const HINTS: Record<string, Record<string, string>> = {
  built_by: { us: "We built or are building it", client: "DIY or in-house", agency: "Freelancer or previous agency" },
  hosted_by: { us: "On our hosting", client: "Client's own hosting account", agency: "Previous agency's hosting" },
  domain_by: { us: "In our registrar account", client: "Client's GoDaddy, Namecheap, etc.", agency: "Held by a third party" },
};

export function NewAccountForm({ me, team }: { me: Profile; team: Profile[] }) {
  const [step, setStep] = useState(1);
  const [industry, setIndustry] = useState("");
  const [services, setServices] = useState<string[]>(["Local SEO", "GBP"]);
  const [other, setOther] = useState(false);
  const [platform, setPlatform] = useState("WordPress");
  const [owners, setOwners] = useState<Record<"built_by" | "hosted_by" | "domain_by", string>>({ built_by: "us", hosted_by: "us", domain_by: "client" });
  const [checks, setChecks] = useState<Record<string, string>>({});
  const [backend, setBackend] = useState(me.role === "cs" ? [] : [{ user_id: "", specialty: "SEO" }, { user_id: "", specialty: "GBP" }]);
  const [business, setBusiness] = useState("");
  const [status, setStatus] = useState("Onboarding");
  const [busy, start] = useTransition();
  const [err, setErr] = useState("");
  const by = (r: string) => team.filter((u) => u.active && u.role === r);
  const needed = neededItems(services, platform);
  const defaultCheck = (k: string) => {
    if (["cms", "hosting"].includes(k) && owners.built_by === "us" && owners.hosted_by === "us") return "have";
    if (k === "domain" && owners.domain_by === "us") return "have";
    return "requested";
  };
  const st = (k: string) => checks[k] ?? defaultCheck(k);
  const inHand = needed.filter((i) => st(i.key) === "have").length;
  const toReq = needed.filter((i) => st(i.key) === "requested").length;
  const groups = CHECKLIST_GROUPS.filter((g) => needed.some((i) => i.group === g.key));
  const labelOwner = (k: string, v: string) => (v === "us" ? "LeadsGeeks" : v === "client" ? "Client" : k === "domain_by" ? "Third party" : "Other");

  const f = (name: string, label: string, type = "text", ph = "", span = false, extra: React.ReactNode = null) => (
    <div className={`field ${span ? "span2" : ""}`}>
      <label htmlFor={`w-${name}`}>{label}</label>
      <input type={type} id={`w-${name}`} name={name} placeholder={ph} />
      {extra}
    </div>
  );

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
      className="stack"
      style={{ gap: 20 }}
    >
      <div className="steps">
        {["Business & contact", "Services & website", "Assign team"].map((l, i) => (
          <div key={l} className={step === i + 1 ? "on" : step > i + 1 ? "done" : ""} onClick={() => step > i + 1 && setStep(i + 1)} style={step > i + 1 ? { cursor: "pointer" } : undefined}>
            <i>{step > i + 1 ? "✓" : i + 1}</i>
            <span>{l}</span>
          </div>
        ))}
      </div>
      {err ? <div className="banner bad"><Icon n="alert" /><div>{err}</div></div> : null}

      <div className="card">
        {/* Step 1 — kept mounted so its values submit with the form */}
        <div className="card-b" hidden={step !== 1}>
          <div className="form-grid">
            <div className="field span2">
              <label htmlFor="w-business">Business name</label>
              <input type="text" id="w-business" name="business" placeholder="e.g. Summit Peak Roofing" required value={business} onChange={(e) => setBusiness(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="w-industry">Industry</label>
              <select id="w-industry" name="industry" required value={industry} onChange={(e) => setIndustry(e.target.value)}>
                <option value="">Choose…</option>
                {INDUSTRY_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.items.map((i) => (
                      <option key={i}>{i}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <span className="hint">{INDUSTRIES.length - 1} trades we serve, grouped as on the website.</span>
            </div>
            {industry === "Other (specify)" ? f("industry_other", "Which trade?", "text", "e.g. Appliance repair") : f("phone", "Business phone", "tel", "(555) 555-0100")}
            {industry === "Other (specify)" ? f("phone", "Business phone", "tel", "(555) 555-0100") : null}
            {f("email", "Business email", "email", "info@business.com")}
            {f("website", "Website", "url", "https://")}
            <div className="span2 eyebrow" style={{ marginTop: 6 }}>Business address · United States only</div>
            {f("street", "Street address", "text", "123 Main St, Suite 200", true)}
            <div className="field">
              <label htmlFor="w-city">City</label>
              <input type="text" id="w-city" name="city" required />
            </div>
            <div className="field">
              <label htmlFor="w-state">State</label>
              <select id="w-state" name="state" required defaultValue="">
                <option value="">Choose state…</option>
                {US_STATES.map(([c, n]) => (
                  <option key={c} value={c}>{n} ({c})</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="w-zip">ZIP code</label>
              <input type="text" id="w-zip" name="zip" placeholder="12345" inputMode="numeric" pattern="[0-9]{5}(-[0-9]{4})?" />
            </div>
            <div className="field">
              <label>Country</label>
              <input type="text" value="United States" disabled />
              <span className="hint">We only serve US businesses.</span>
            </div>
            {f("gbp_url", "Google Business Profile link", "url", "https://maps.google.com/…", true)}
            <div className="field">
              <label htmlFor="w-client_since">Client since</label>
              <input type="date" id="w-client_since" name="client_since" defaultValue={new Date().toISOString().slice(0, 10)} />
            </div>
            <div className="span2 eyebrow" style={{ marginTop: 6 }}>Primary contact</div>
            <div className="field">
              <label htmlFor="w-contact_name">Name</label>
              <input type="text" id="w-contact_name" name="contact_name" required />
            </div>
            {f("contact_title", "Title", "text", "Owner")}
            {f("contact_phone", "Phone", "tel")}
            {f("contact_email", "Email", "email")}
          </div>
        </div>

        {/* Step 2 */}
        <div className="splitb" hidden={step !== 2}>
          <div className="form">
            <div className="sec">
              <div className="sec-h"><h3>Services for this client</h3><span className="muted small">tick everything we handle for them</span></div>
              <div className="checks">
                {SERVICES.map((s) => {
                  const n = Object.values(ACCESS_NEEDS).filter((v) => v.includes(s)).length;
                  const on = services.includes(s);
                  return (
                    <button type="button" key={s} className={`ck ${on ? "on" : ""}`} onClick={() => setServices(on ? services.filter((x) => x !== s) : [...services, s])}>
                      <span className="box"><Icon n="check" /></span>
                      <b>{s}</b>
                      <span className="need">{n ? `needs ${n} access` : ""}</span>
                    </button>
                  );
                })}
                {services.map((s) => <input key={s} type="hidden" name="services" value={s} />)}
                <div className={`ck ${other ? "on" : ""}`}>
                  <button type="button" className="ckbtn" onClick={() => setOther(!other)}><span className="box"><Icon n="check" /></span><b>Other</b></button>
                  {other ? <input type="text" name="service_other" placeholder="What else do we handle? e.g. Yelp Ads, email newsletter" /> : null}
                </div>
              </div>
            </div>
            <div className="sec">
              <div className="sec-h"><h3>Website</h3></div>
              <div className="own-rows">
                {(["built_by", "hosted_by", "domain_by"] as const).map((k) => (
                  <div key={k} className="own-row">
                    <span className="own-lbl">{k === "built_by" ? "Built by" : k === "hosted_by" ? "Hosted by" : "Domain held by"}</span>
                    <span className="tri">
                      {["us", "client", "agency"].map((v) => (
                        <button type="button" key={v} className={`own ${owners[k] === v ? "on" : ""}`} onClick={() => setOwners({ ...owners, [k]: v })} title={HINTS[k][v]}>{labelOwner(k, v)}</button>
                      ))}
                    </span>
                    <input type="hidden" name={k} value={owners[k]} />
                    {owners[k] === "agency" ? <input type="text" className="own-name" name={`${k}_name`} placeholder={k === "domain_by" ? "Registrar or agency name" : "Agency or freelancer name"} /> : <span className="own-hint">{HINTS[k][owners[k]]}</span>}
                  </div>
                ))}
              </div>
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="w-platform">Platform</label>
                  <select id="w-platform" name="platform" value={platform} onChange={(e) => setPlatform(e.target.value)}>
                    {PLATFORMS.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="w-status">Starting status</label>
                  <select id="w-status" name="status" value={status} onChange={(e) => setStatus(e.target.value)}>
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>{s} · {STATUS_HELP[s]}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
          <aside className="side">
            <h3>What we&apos;ll need from the client<span className="cnt">{inHand}/{needed.length}</span></h3>
            <div className="muted small">Built from the services ticked. Set each item to what&apos;s true today; this becomes the account&apos;s Access checklist.</div>
            {needed.length ? (
              groups.map((g) => (
                <div key={g.key}>
                  <div className="acc-group">{g.label}</div>
                  <div className="side-list">
                    {needed.filter((i) => i.group === g.key).map((i) => {
                      const s = st(i.key);
                      const setup = SETUP_KEYS.includes(i.key);
                      return (
                        <div key={i.key} className={`item ${s}`}>
                          <span className="n">{i.label}</span>
                          <span className="tri sm">
                            {([["have", setup ? "Set up" : "Have it"], ["requested", setup ? "Pending" : "Requested"], ["none", "Not needed"]] as const).map(([v, l]) => (
                              <button type="button" key={v} className={`${v} ${s === v ? "on" : ""}`} onClick={() => setChecks({ ...checks, [i.key]: v })} title={l}>{l}</button>
                            ))}
                          </span>
                          <input type="hidden" name={`check_${i.key}`} value={s === "requested" && setup ? "pending" : s} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
            ) : (
              <div className="acc-empty">Tick a service to see what&apos;s needed.</div>
            )}
            <div className="foot">{toReq ? <>{toReq} item{toReq === 1 ? "" : "s"} will be marked <b>Requested</b> on the checklist.</> : "Nothing to request from the client."}</div>
          </aside>
        </div>

        {/* Step 3 */}
        <div className="card-b" hidden={step !== 3}>
          <div className="stack" style={{ gap: 20 }}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="w-cs">Contact owner (Customer Success)</label>
                {me.role === "cs" ? (
                  <>
                    <select id="w-cs" disabled defaultValue={me.id}><option value={me.id}>{me.name}</option></select>
                    <span className="hint">You&apos;ll be the CS owner. Admins and team leads can assign someone else.</span>
                  </>
                ) : (
                  <>
                    <select id="w-cs" name="cs_id" defaultValue="">
                      <option value="">Choose…</option>
                      {[...by("cs"), ...by("lead"), ...by("admin")].map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                    <span className="hint">Talks to the client and sees billing.</span>
                  </>
                )}
              </div>
              <div className="field">
                <label htmlFor="w-sales">Sales rep</label>
                <select id="w-sales" name="sales_id" defaultValue="">
                  <option value="">Choose…</option>
                  {by("sales").map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <span className="hint">View-only access to this account.</span>
              </div>
              <div className="field">
                <label htmlFor="w-lead">Team lead{me.role === "cs" ? " *" : ""}</label>
                <select id="w-lead" name="lead_id" defaultValue={me.role === "lead" ? me.id : ""} required={me.role === "cs"}>
                  <option value="">Choose…</option>
                  {by("lead").map((u) => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
                <span className="hint">{me.role === "cs" ? "Required. The team lead assigns the backend team." : "Responsible for the backend team on this account."}</span>
              </div>
              {me.role === "cs" ? (
                <div className="field span2">
                  <div className="banner info"><Icon n="info" /><div className="small">You don&apos;t assign backend people. Your team lead gets a notification and adds the SEO, GBP and other backend people after you create the account.</div></div>
                </div>
              ) : (
                <div className="field span2">
                  <label>Backend team</label>
                  <BackendRows rows={backend} setRows={setBackend} people={by("backend")} />
                  <span className="hint">Pre-filled from the services on step 2. The SEO person is the primary owner and gets the monthly report reminder; everyone listed can work the account.</span>
                </div>
              )}
            </div>
            <div className="banner ok">
              <Icon n="check" />
              <div>
                <b>{business || "This account"}</b> will be created as <b>{status}</b> with {inHand} access item{inHand === 1 ? "" : "s"} in hand and {toReq} still to collect, {services.length + (other ? 1 : 0)} service tag{services.length + (other ? 1 : 0) === 1 ? "" : "s"}, and the owners above will be notified.{me.role === "admin" ? "" : <> <b>An admin must approve it before it goes live.</b></>}
              </div>
            </div>
          </div>
        </div>

        <div className="modal-f" style={{ justifyContent: "space-between" }}>
          <div>{step > 1 ? <button type="button" className="btn" onClick={() => setStep(step - 1)}>Back</button> : <Link className="btn ghost" href="/accounts">Cancel</Link>}</div>
          <div className="row">
            {step < 3 ? (
              <button type="button" className="btn primary" onClick={() => { const form = document.getElementById("w-business")?.closest("form"); if (step === 1 && form && !form.reportValidity()) return; setStep(step + 1); }}>
                Continue <Icon n="chevron" />
              </button>
            ) : (
              <button className="btn primary" disabled={busy}><Icon n="check" /> {busy ? "Creating…" : "Create account"}</button>
            )}
          </div>
        </div>
      </div>
      {me.role !== "admin" ? <input type="hidden" name="needs_approval" value="1" /> : null}
    </form>
  );
}
